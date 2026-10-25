import { MOVES, type MoveDef } from '../data/moves';
import { TUNING } from '../data/tuning';
import { insideRect } from '../core/geometry';
import { nextRandom } from '../core/rng';
import type { PlayerInput, Rect } from '../core/state';
import { TILE, wallAt } from '../core/tiles';
import { add, distance, dot, length, normalize, scale, sub, vec, type Vec2 } from '../core/vec';
import { Navigator, roomCentre } from './nav';
import type { Observation, SeenEnemy } from './observe';

/**
 * The balance bots (docs/souls-difficulty-research.md P7). A bot sees the
 * screen (`Observation`) `reactionMs` late, like a player's perception lag
 * (its own body it feels at once), and answers with one `PlayerInput` per
 * tick. All its randomness comes from its own seeded generator (`core/rng.ts`),
 * so a bot and a run seed replay the same game.
 *
 * - perfect: no lag, rolls every ordinary wind-up and shot in its i-frames,
 *   walks out of positional (`pierceRoll`) ground, attacks only in the windows
 *   between enemy wind-ups.
 * - average: 230 ms lag (Woods et al. 2015) plus 100 ms to choose where to walk
 *   out of a positional attack, ±40 ms timing noise, small aim noise, and 15 %
 *   of its choices wrong (a dodge skipped or an attack into a wind-up).
 * - novice: 400 ms lag, ±90 ms noise, 40 % of its choices wrong, and it
 *   over-rolls (panics into a roll as soon as it sees a threat, burning stamina).
 * - masher: never dodges on purpose: spams attacks at the nearest enemy and
 *   rolls on a whim (measures raw damage and the biggest single hit).
 */
export type BotKind = 'perfect' | 'average' | 'novice' | 'masher';

export const BOT_KINDS: readonly BotKind[] = ['perfect', 'average', 'novice', 'masher'];

/**
 * Bot options. `slots`: the perfect and average bots also use the boost and
 * area slots (four-slots): the boost before a boss or a crowd, the area move
 * on a cluster or a boss in reach. Off by default, so the balance sweep keeps
 * measuring the fast slot alone unless asked (`npm run balance -- --slots`).
 */
export interface BotOptions {
  slots?: boolean;
}

/** How far an area move reaches from the user (a wave: as far as it flies). */
export function areaReach(move: MoveDef): number {
  const box = move.hitbox;
  if (box.kind === 'arc') return box.range;
  if (box.kind === 'projectile') return (box.speed * box.lifetimeMs) / 1000;
  if (box.kind === 'dash') return box.distance;
  return 0;
}

/** Enemies this close (beyond their body) count for the crowd that calls for a boost. */
const BOOST_CROWD_PX = 140;
/** A boss this close calls for the boost. */
const BOOST_BOSS_PX = 220;

export interface BotProfile {
  /** Perception lag: the bot acts on the screen as it was this long ago. */
  reactionMs: number;
  /** Extra time to pick a way out of a positional attack (choice reaction, Hick's law). */
  choiceMs: number;
  /** Uniform ± noise on the timing of each dodge. */
  timingNoiseMs: number;
  /** Uniform ± noise (radians) on each aim. */
  aimNoiseRad: number;
  /** Share of threat decisions taken wrong (dodge skipped, attack into a wind-up). */
  mistakeRate: number;
  /** Chance to panic-roll at once on seeing a threat. */
  overRollRate: number;
  dodges: boolean;
  /** Attacks whenever it can, wind-ups or not, and rolls on a whim. */
  mash: boolean;
  /** Knows when to use the boost and area slots (with `BotOptions.slots`). */
  usesSlots?: boolean;
}

export const BOT_PROFILES: Readonly<Record<BotKind, BotProfile>> = {
  perfect: { reactionMs: 0, choiceMs: 0, timingNoiseMs: 0, aimNoiseRad: 0, mistakeRate: 0, overRollRate: 0, dodges: true, mash: false, usesSlots: true },
  average: { reactionMs: 230, choiceMs: 100, timingNoiseMs: 40, aimNoiseRad: 0.08, mistakeRate: 0.15, overRollRate: 0, dodges: true, mash: false, usesSlots: true },
  novice: { reactionMs: 400, choiceMs: 150, timingNoiseMs: 90, aimNoiseRad: 0.2, mistakeRate: 0.4, overRollRate: 0.35, dodges: true, mash: false },
  masher: { reactionMs: 230, choiceMs: 0, timingNoiseMs: 0, aimNoiseRad: 0.1, mistakeRate: 0, overRollRate: 0, dodges: false, mash: true },
};

/** Map knowledge the screen does not carry: where the way on is (stairs, a fixed room's exit; null for a guardian's last room). */
export interface BotContext {
  exit: Rect | null;
  /** An urgent floor (collapse, fog, flood, gas: the game shows it): head for the way on, fight only what stands in the way. */
  urgent?: boolean;
  /** A floor gate still shut (core/gates.ts): where the marked enemy stands (minimap) and the dropped key, if any. */
  gate?: { marked: Vec2 | null; key: Vec2 | null };
}

export interface Bot {
  readonly kind: BotKind;
  decide(obs: Observation, context: BotContext): PlayerInput;
}

/** Enemies this close (beyond their body) are a melee threat when they wind up. */
const MELEE_THREAT = 120;
/** A roll is pressed this long before the hit lands, so the i-frames (30 to 300 ms) cover it. */
const ROLL_LEAD_MS = 70;
/** Shots closer than this (ms to closest approach) are dodged. */
const SHOT_HORIZON_MS = 200;
const SHOT_ROLL_MS = 120;
/** Distance kept from a target while hitting it (inside the fast move's 34 px reach). */
const STRIKE_GAP = 22;
const DT_MS = 1000 / TUNING.ticksPerSecond;
const HISTORY_MS = 1000;
/** An enemy chased this long without losing HP (out of reach in a wall, kiting) is left alone for a while. */
const CHASE_GIVE_UP_MS = 15_000;
const IGNORE_MS = 10_000;

interface Threat {
  /** Unit direction from the threat to the bot. */
  from: Vec2;
  /** Real time the hit lands. */
  hitAtMs: number;
  /** Rolling does not help: walk instead. */
  positional: boolean;
}

export function createBot(kind: BotKind, seed: number, profile: BotProfile = BOT_PROFILES[kind], options: BotOptions = {}): Bot {
  const useSlots = options.slots === true && profile.usesSlots === true;
  let rng = (seed ^ 0x5eed_b07) | 0;
  const random = (): number => {
    const r = nextRandom(rng);
    rng = r.state;
    return r.value;
  };
  const history: Observation[] = [];
  const decisions = new Map<string, { wrong: boolean; noiseMs: number; seenAtMs: number }>();
  const visited = new Set<number>();
  const nav = new Navigator();
  let lastPressTick = -100;
  let lastRollTick = -100;
  let lastPos: Vec2 | null = null;
  let stuckTicks = 0;
  let unstick: { dir: Vec2; ticks: number } | null = null;
  let whimTicks = 60;
  /** Per target: its HP when last hurt and the time chased since; enemies given up on until a time. */
  const chase = new Map<string, { hp: number; ms: number }>();
  const ignored = new Map<string, number>();

  const decision = (key: string, now: number) => {
    let d = decisions.get(key);
    if (!d) {
      d = { wrong: random() < profile.mistakeRate, noiseMs: (random() * 2 - 1) * profile.timingNoiseMs, seenAtMs: now };
      decisions.set(key, d);
      if (decisions.size > 512) decisions.delete(decisions.keys().next().value!);
    }
    return d;
  };

  /** The screen as it was `reactionMs` ago (the oldest kept when the bot just started). */
  const perceived = (now: number): Observation => {
    for (let i = history.length - 1; i >= 0; i--) if (history[i]!.timeMs <= now - profile.reactionMs) return history[i]!;
    return history[0]!;
  };

  const blocked = (obs: Observation, at: Vec2): boolean =>
    at.x < 8 || at.y < 8 || at.x > obs.arena.width - 8 || at.y > obs.arena.height - 8 || (obs.arena.tiles ? wallAt(obs.arena.tiles, at) : false) || (obs.arena.obstacles ?? []).some((o) => insideRect(at, o));

  /** Sideways from a threat, towards open ground. */
  const sidestep = (obs: Observation, from: Vec2): Vec2 => {
    const left = vec(-from.y, from.x);
    const right = vec(from.y, -from.x);
    const reach = TUNING.roll.distance * 0.6;
    const leftOk = !blocked(obs, add(obs.self.pos, scale(left, reach)));
    const rightOk = !blocked(obs, add(obs.self.pos, scale(right, reach)));
    const away = !blocked(obs, add(obs.self.pos, scale(from, reach)));
    if (leftOk && rightOk) return normalize(add(random() < 0.5 ? left : right, scale(from, 0.4)));
    if (leftOk) return left;
    if (rightOk) return right;
    return away ? from : scale(from, -1);
  };

  /** Where to walk out of positional ground, or null when standing clear of it. */
  const zoneEscape = (obs: Observation, e: SeenEnemy): Vec2 | null => {
    const zone = e.zone;
    const me = obs.self.pos;
    const margin = obs.self.radius + 8;
    if (!zone && !e.pierceRoll) return null;
    if (!zone || zone.kind === 'wall' || zone.kind === 'lanes' || zone.kind === 'shape') {
      // Unknown ground: off the attack's line, away from the enemy.
      if (distance(me, e.pos) > e.radius + MELEE_THREAT + 40 && (zone?.kind !== 'wall' && zone?.kind !== 'lanes')) return null;
      const line = length(e.attackDir) > 0 ? normalize(e.attackDir) : normalize(sub(me, e.pos));
      const side = vec(-line.y, line.x);
      const sign = dot(sub(me, e.pos), side) >= 0 ? 1 : -1;
      return normalize(add(scale(side, sign), scale(normalize(sub(me, e.pos)), 0.3)));
    }
    if (zone.kind === 'circle' || zone.kind === 'mark') {
      const centre = zone.kind === 'mark' ? zone.center : e.pos;
      const d = distance(me, centre);
      return d < zone.radius + margin ? (d > 0.01 ? normalize(sub(me, centre)) : vec(1, 0)) : null;
    }
    if (zone.kind === 'pockets') {
      let best: Vec2 | null = null;
      let bestD = Number.POSITIVE_INFINITY;
      for (const c of zone.centers) {
        const d = distance(me, c);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (!best || bestD < zone.radius - obs.self.radius - 2) return null;
      return normalize(sub(best, me));
    }
    // A closing ring: get out past its band.
    const d = distance(me, zone.center);
    return Math.abs(d - zone.radius) < zone.width / 2 + margin + 30 || d > zone.radius ? (d > 0.01 ? normalize(sub(me, zone.center)) : vec(1, 0)) : null;
  };

  const threats = (now: number, seen: Observation, self: Observation['self']): Threat[] => {
    const out: Threat[] = [];
    for (const e of seen.enemies) {
      if (!e.windup || e.zone || e.pierceRoll) continue;
      if (distance(self.pos, e.pos) > e.radius + MELEE_THREAT) continue;
      out.push({ from: normalize(sub(self.pos, e.pos)), hitAtMs: seen.timeMs + e.windup.remainingMs, positional: false });
    }
    const lag = (now - seen.timeMs) / 1000;
    for (const p of seen.projectiles) {
      const pos = add(p.pos, scale(p.vel, lag));
      const rel = sub(self.pos, pos);
      const speed2 = dot(p.vel, p.vel);
      if (speed2 < 1) {
        if (length(rel) < p.radius + self.radius + 4) out.push({ from: normalize(rel), hitAtMs: now, positional: p.pierceRoll });
        continue;
      }
      const t = dot(rel, p.vel) / speed2;
      if (t < 0 || t * 1000 > SHOT_HORIZON_MS) continue;
      const miss = length(sub(rel, scale(p.vel, t)));
      if (miss > p.radius + self.radius + 4) continue;
      out.push({ from: normalize(p.vel), hitAtMs: now + t * 1000 - SHOT_ROLL_MS + ROLL_LEAD_MS, positional: p.pierceRoll });
    }
    return out;
  };

  const navigate = (obs: Observation, context: BotContext): Vec2 => {
    const arena = obs.arena;
    const me = obs.self.pos;
    if (arena.tiles && context.urgent && context.exit) return nav.direction(arena, me, vec(context.exit.x + context.exit.width / 2, context.exit.y + context.exit.height / 2));
    // A shut gate: a dropped key is picked up at once; the marked enemy is hunted once the rooms are explored (below).
    if (arena.tiles && context.gate?.key) return nav.direction(arena, me, context.gate.key);
    if (arena.tiles && arena.rooms) {
      arena.rooms.forEach((room, i) => {
        if (insideRect(me, { x: room.x * TILE, y: room.y * TILE, width: room.width * TILE, height: room.height * TILE })) visited.add(i);
      });
      let goal: Vec2 | null = null;
      let best = Number.POSITIVE_INFINITY;
      arena.rooms.forEach((room, i) => {
        if (visited.has(i)) return;
        const centre = roomCentre(room);
        const d = nav.tilesTo(arena, me, centre);
        if (d >= 0 && d < best) {
          best = d;
          goal = centre;
        }
      });
      const exit = context.exit;
      const target = goal ?? context.gate?.marked ?? (exit ? vec(exit.x + exit.width / 2, exit.y + exit.height / 2) : null);
      return target ? nav.direction(arena, me, target) : vec(0, 0);
    }
    // A fixed room: look for the enemies in the middle, then take the exit once it opens.
    const exit = context.exit;
    if (obs.cleared && exit) return nav.direction(arena, me, vec(exit.x + exit.width / 2, exit.y + exit.height / 2));
    const middle = vec(arena.width / 2, arena.height / 2);
    return distance(me, middle) > 24 ? nav.direction(arena, me, middle) : vec(0, 0);
  };

  return {
    kind,
    decide(obs: Observation, context: BotContext): PlayerInput {
      history.push(obs);
      while (history.length > 2 && history[0]!.timeMs < obs.timeMs - HISTORY_MS - profile.reactionMs) history.shift();
      const now = obs.timeMs;
      const self = obs.self;
      const seen = perceived(now);
      let move: Vec2 = vec(0, 0);
      let roll = false;
      let attack = false;
      /** Four-slots: the boost (2) or area (3) slot pressed instead of the fast one. */
      let special: 2 | 3 | null = null;
      let aim = add(self.pos, vec(0, 1));
      const ready = (slot: number): MoveDef | null => {
        const id = self.loadout[slot];
        if (!id || (self.cooldowns[slot] ?? 0) > 0) return null;
        const move = MOVES[id];
        return self.stamina >= move.staminaCost + TUNING.roll.staminaCost ? move : null;
      };
      const canRoll = self.stamina >= TUNING.roll.staminaCost * 1.2 && !self.rolling && !self.acting;
      let busy = false;

      if (profile.dodges) {
        // Positional ground first: walk out (rolling through it does not help).
        for (const e of seen.enemies) {
          const out = zoneEscape(obs, e);
          if (!out) continue;
          const d = decision(`z:${e.id}:${e.mode}:${Math.round((e.windup?.remainingMs ?? 0) / 400)}`, now);
          if (d.wrong || now - d.seenAtMs < profile.choiceMs + d.noiseMs) continue;
          move = out;
          busy = true;
          break;
        }
        for (const threat of threats(now, seen, self)) {
          const key = `t:${Math.round(threat.hitAtMs / 60)}:${Math.round(threat.from.x * 4)},${Math.round(threat.from.y * 4)}`;
          const d = decision(key, now);
          if (random() < profile.overRollRate * (DT_MS / 250) && canRoll) {
            roll = true;
            move = sidestep(obs, threat.from);
            busy = true;
            break;
          }
          if (d.wrong) continue;
          if (threat.positional || !canRoll) {
            move = sidestep(obs, threat.from);
            busy = true;
            continue;
          }
          const rollAt = threat.hitAtMs - ROLL_LEAD_MS + d.noiseMs;
          if (now >= rollAt && now <= threat.hitAtMs + 120) {
            roll = true;
            move = sidestep(obs, threat.from);
            busy = true;
            break;
          }
          // Waiting for the moment: do not start a move that would root the bot through it.
          if (threat.hitAtMs - now < 450) busy = true;
        }
      }

      if (profile.mash && --whimTicks <= 0) {
        whimTicks = 40 + Math.floor(random() * 50);
        if (canRoll) {
          roll = true;
          const a = random() * Math.PI * 2;
          move = vec(Math.cos(a), Math.sin(a));
        }
      }

      // Offense: the nearest enemy on screen (on an urgent floor only one in the way), but not one chased for long without hurting it.
      let target: SeenEnemy | null = null;
      for (const e of seen.enemies) {
        if ((ignored.get(e.id) ?? -1) > now) continue;
        if (context.urgent && distance(self.pos, e.pos) > e.radius + 40) continue;
        if (!target || distance(self.pos, e.pos) < distance(self.pos, target.pos)) target = e;
      }
      if (target) {
        // Time spent on this target since it last lost HP (summed over the ticks it was the target).
        const c = chase.get(target.id);
        if (!c || c.hp !== target.hp) chase.set(target.id, { hp: target.hp, ms: 0 });
        else if ((c.ms += DT_MS) > CHASE_GIVE_UP_MS) {
          ignored.set(target.id, now + IGNORE_MS);
          chase.delete(target.id);
          target = null;
        }
      }
      if (target) {
        const gap = distance(self.pos, target.pos);
        const reach = target.radius + STRIKE_GAP;
        const noise = (random() * 2 - 1) * profile.aimNoiseRad;
        const dir = normalize(sub(target.pos, self.pos));
        const c = Math.cos(noise);
        const s = Math.sin(noise);
        aim = add(self.pos, scale(vec(dir.x * c - dir.y * s, dir.x * s + dir.y * c), Math.max(gap, 16)));
        const imminent = target.windup !== null && target.windup.remainingMs < 450 && gap < target.radius + MELEE_THREAT;
        const careless = profile.mash || decision(`a:${target.id}:${Math.floor(now / 500)}`, now).wrong;
        if (!busy && !roll) {
          if (gap > reach) move = nav.direction(obs.arena, self.pos, target.pos);
          else if (imminent && !careless) move = scale(dir, -0.5);
          if (gap <= reach + 6 && (!imminent || careless) && !self.acting && obs.tick - lastPressTick > 1) attack = true;
          // Four-slots: the area move on a cluster (or a boss in reach), never into a wind-up.
          const area = useSlots && !self.acting && !imminent && obs.tick - lastPressTick > 1 ? ready(3) : null;
          if (area) {
            const span = areaReach(area);
            const caught = seen.enemies.filter((e) => distance(self.pos, e.pos) <= span + e.radius).length;
            if (caught >= 2 || (target.boss && gap <= span + target.radius)) {
              special = 3;
              attack = false;
            }
          }
        }
      } else if (!busy && !roll) {
        move = navigate(obs, context);
      }

      // Unstick: walking but not getting anywhere.
      if (unstick) {
        if (!busy) move = unstick.dir;
        if (--unstick.ticks <= 0) unstick = null;
      } else if (lastPos && length(move) > 0.1 && !self.acting && distance(lastPos, self.pos) < 0.2) {
        if (++stuckTicks > 30) {
          const a = random() * Math.PI * 2;
          unstick = { dir: vec(Math.cos(a), Math.sin(a)), ticks: 25 };
          stuckTicks = 0;
        }
      } else stuckTicks = 0;
      lastPos = self.pos;

      if (roll) {
        if (obs.tick - lastRollTick < 4) roll = false;
        else lastRollTick = obs.tick;
      }
      // Four-slots: the boost before a boss or a crowd, when nothing threatens right now.
      if (useSlots && special === null && !busy && !roll && !self.acting && !self.buffed && obs.tick - lastPressTick > 1 && ready(2)) {
        const bossNear = seen.enemies.some((e) => e.boss && distance(self.pos, e.pos) <= BOOST_BOSS_PX);
        const crowd = seen.enemies.filter((e) => distance(self.pos, e.pos) <= BOOST_CROWD_PX + e.radius).length;
        if (bossNear || crowd >= 3) {
          special = 2;
          attack = false;
        }
      }
      if (attack || special !== null) lastPressTick = obs.tick;
      // Always the four slots (fast, heavy, boost, area); without the option boost and area are never pressed (the same play as the two-slot input).
      const slots = [attack, false, useSlots && special === 2, useSlots && special === 3];
      return {
        move,
        aim,
        roll,
        slots,
        slotMouse: [attack, false, false, useSlots && special === 3],
        lock: false,
        click: false,
        wheel: 0,
        view: obs.view,
      };
    },
  };
}
