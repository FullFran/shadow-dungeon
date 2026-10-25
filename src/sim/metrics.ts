import { TELEGRAPH_FLOOR } from '../data/difficulty';
import { TUNING } from '../data/tuning';
import type { WorldState } from '../core/state';
import { distance } from '../core/vec';
import { cameraRect, onScreen } from './observe';

/** A hit whose threat was on screen for less than this (the one-answer telegraph floor, less one tick) gave no fair warning. */
/** An enemy's wind-up still announces what it leaves behind (clouds, bursts) this long after its attack ends. */
const LINGER_MS = 600;

export const BLIND_WARNING_MS = TELEGRAPH_FLOOR.minMs - 1000 / TUNING.ticksPerSecond;

/**
 * What the harness measures on one floor or boss arena (docs/souls-difficulty-research.md P7).
 * Times are real (simulated) ms.
 */
export interface FloorMetrics {
  /** Floor time, from entering it to leaving it (or dying, or the timeout). */
  timeMs: number;
  /** HP lost to attacks and to the floor itself (collapse, fog chill). */
  damage: number;
  /** HP at the start, at the end, and the max HP. */
  hpStart: number;
  hpEnd: number;
  maxHp: number;
  /** Attacks that hurt the player. */
  hits: number;
  /** Of those, positional (`pierceRoll`) ones: rolling could not stop them. */
  hitsPierce: number;
  /** The biggest single hit as a share of max HP. */
  maxHitShare: number;
  kills: number;
  /** Per enemy killed: ms from waking (or the floor start for a fixed room) to falling. */
  enemyTtkMs: number[];
  /** The boss (a fixed arena's guardian or mid-boss): ms from first on screen to falling; null if not felled or no boss. */
  bossTtkMs: number | null;
  /** Each ordinary wind-up, ms from its telegraph to its attack firing. */
  telegraphMs: number[];
  /** Each positional (`pierceRoll`, a choice: where to walk) wind-up, ms from telegraph to attack. */
  choiceTelegraphMs: number[];
  /** Most wind-ups running at once (every enemy aims at the bot: solo). */
  maxSimultaneousTelegraphs: number;
  /** Wind-ups that started with their enemy off screen. */
  unseenAttacks: number;
  /** Most off-screen-started wind-ups running at once. */
  maxSimultaneousUnseen: number;
  /** Attacks with no wind-up of their own pending (combo follow-ups, bullets of a running card). */
  untelegraphedAttacks: number;
  /**
   * Hits with no fair warning: no threat near the player (a shot about to
   * touch it, a winding-up or attacking enemy close by; failing those, any
   * enemy winding up on screen) had been on screen for `BLIND_WARNING_MS`.
   */
  blindHits: number;
}

interface Pending {
  startMs: number;
  pierce: boolean;
  unseen: boolean;
}

interface Interval {
  start: number;
  end: number;
}

/** Most intervals overlapping at one time (an interval ending when another starts does not overlap it). */
export function maxOverlap(intervals: readonly Interval[]): number {
  const points = intervals.flatMap((i) => [
    { t: i.start, d: 1 },
    { t: i.end, d: -1 },
  ]);
  points.sort((a, b) => a.t - b.t || a.d - b.d);
  let current = 0;
  let best = 0;
  for (const p of points) {
    current += p.d;
    best = Math.max(best, current);
  }
  return best;
}

/** Records one floor, step by step: call `record(before, after)` after each step. */
export class FloorRecorder {
  private readonly startMs: number;
  private readonly fixedRoom: boolean;
  private readonly m: FloorMetrics;
  private readonly pending = new Map<string, Pending>();
  private readonly intervals: Interval[] = [];
  private readonly unseenIntervals: Interval[] = [];
  private readonly awakeAt = new Map<string, number>();
  private readonly alive = new Set<string>();
  private bossId: string | null = null;
  private bossSeenAt: number | null = null;
  /** First time each enemy shot was on screen; since when each on-screen enemy has been winding up or attacking. */
  private readonly shotSeen = new Map<string, number>();
  private readonly windupSince = new Map<string, { since: number; until: number | null }>();
  private endMs: number;

  constructor(world: WorldState) {
    this.startMs = world.timeMs;
    this.endMs = world.timeMs;
    this.fixedRoom = !world.arena.tiles;
    const p = world.player;
    this.m = {
      timeMs: 0,
      damage: 0,
      hpStart: p.hp,
      hpEnd: p.hp,
      maxHp: p.maxHp,
      hits: 0,
      hitsPierce: 0,
      maxHitShare: 0,
      kills: 0,
      enemyTtkMs: [],
      bossTtkMs: null,
      telegraphMs: [],
      choiceTelegraphMs: [],
      maxSimultaneousTelegraphs: 0,
      unseenAttacks: 0,
      maxSimultaneousUnseen: 0,
      untelegraphedAttacks: 0,
      blindHits: 0,
    };
    this.bossId = this.fixedRoom ? (world.enemies.find((e) => e.boss)?.id ?? null) : null;
    this.track(world);
  }

  private track(world: WorldState): void {
    for (const e of world.enemies) {
      if (!e.alive) continue;
      this.alive.add(e.id);
      if (!this.awakeAt.has(e.id) && (this.fixedRoom || e.ai.mode !== 'asleep')) this.awakeAt.set(e.id, world.timeMs);
    }
  }

  /** How long the best-announced threat near the player had been on screen (null: none). */
  private warningMs(before: WorldState, after: WorldState): number | null {
    const now = after.timeMs;
    const me = after.player.pos;
    let best: number | null = null;
    const consider = (since: number | undefined) => {
      if (since !== undefined) best = Math.max(best ?? 0, now - since);
    };
    for (const p of before.projectiles) if (p.owner === 'enemy' && distance(p.pos, me) <= p.radius + TUNING.player.radius + 12) consider(this.shotSeen.get(p.id));
    for (const e of before.enemies) if (distance(e.pos, me) <= e.radius + 160) consider(this.windupSince.get(e.id)?.since);
    if (best === null) for (const w of this.windupSince.values()) consider(w.since);
    return best;
  }

  /**
   * Keeps when each threat came on screen: an enemy from the start of its
   * wind-up (kept a moment after its attack ends), a shot from when it was
   * first seen, or, when it appears beside an enemy that was just winding up
   * (a lingering cloud, a burst), from that wind-up.
   */
  private watchThreats(world: WorldState): void {
    const now = world.timeMs;
    const view = cameraRect(world.player.pos, world.arena);
    for (const e of world.enemies) {
      const threatening = e.alive && (e.ai.mode === 'telegraph' || e.ai.mode === 'attack' || e.boss !== undefined);
      const w = this.windupSince.get(e.id);
      if (threatening) {
        if (!w && onScreen(e.pos, view, e.radius)) this.windupSince.set(e.id, { since: now, until: null });
        else if (w) w.until = null;
      } else if (w) {
        if (w.until === null) w.until = now;
        else if (now - w.until > LINGER_MS) this.windupSince.delete(e.id);
      }
    }
    for (const p of world.projectiles) {
      if (p.owner !== 'enemy' || this.shotSeen.has(p.id) || !onScreen(p.pos, view, p.radius)) continue;
      let since = now;
      for (const e of world.enemies) {
        const w = this.windupSince.get(e.id);
        if (w && distance(e.pos, p.pos) <= e.radius + p.radius + 200) since = Math.min(since, w.since);
      }
      this.shotSeen.set(p.id, since);
    }
  }

  record(before: WorldState, after: WorldState): void {
    const now = after.timeMs;
    this.endMs = now;
    const view = cameraRect(before.player.pos, before.arena);
    this.watchThreats(before);
    for (const ev of after.events) {
      if (ev.type === 'playerHurt') {
        const warned = this.warningMs(before, after);
        if (warned === null || warned < BLIND_WARNING_MS) this.m.blindHits += 1;
        this.m.damage += ev.damage;
        this.m.hits += 1;
        if (ev.pierceRoll) this.m.hitsPierce += 1;
        this.m.maxHitShare = Math.max(this.m.maxHitShare, ev.damage / after.player.maxHp);
      } else if (ev.type === 'collapseHurt') this.m.damage += ev.damage;
      else if (ev.type === 'enemyTelegraph') {
        const enemy = after.enemies.find((e) => e.id === ev.enemyId);
        const unseen = enemy ? !onScreen(enemy.pos, view, enemy.radius) : false;
        this.pending.set(ev.enemyId, { startMs: now, pierce: ev.pierceRoll === true, unseen });
      } else if (ev.type === 'enemyAttack') {
        const p = this.pending.get(ev.enemyId);
        if (!p) {
          this.m.untelegraphedAttacks += 1;
          continue;
        }
        this.pending.delete(ev.enemyId);
        const ms = now - p.startMs;
        (p.pierce ? this.m.choiceTelegraphMs : this.m.telegraphMs).push(ms);
        this.intervals.push({ start: p.startMs, end: now });
        if (p.unseen) {
          this.m.unseenAttacks += 1;
          this.unseenIntervals.push({ start: p.startMs, end: now });
        }
      }
    }
    if (this.bossId && this.bossSeenAt === null) {
      const boss = after.enemies.find((e) => e.id === this.bossId);
      if (boss && onScreen(boss.pos, cameraRect(after.player.pos, after.arena), boss.radius)) this.bossSeenAt = now;
    }
    for (const e of after.enemies) {
      if (e.alive || !this.alive.has(e.id)) continue;
      this.alive.delete(e.id);
      this.m.kills += 1;
      this.m.enemyTtkMs.push(now - (this.awakeAt.get(e.id) ?? this.startMs));
      if (e.id === this.bossId) this.m.bossTtkMs = now - (this.bossSeenAt ?? this.startMs);
    }
    this.track(after);
    this.m.hpEnd = after.player.hp;
    this.m.maxHp = after.player.maxHp;
  }

  finish(): FloorMetrics {
    return {
      ...this.m,
      timeMs: this.endMs - this.startMs,
      maxSimultaneousTelegraphs: maxOverlap(this.intervals),
      maxSimultaneousUnseen: maxOverlap(this.unseenIntervals),
    };
  }
}
