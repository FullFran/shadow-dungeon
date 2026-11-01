import { ENEMY_BEHAVIOUR } from '../../data/enemies';
import { MOVES, type MoveDef, type MoveId } from '../../data/moves';
import type { PokemonType } from '../../data/types';
import { playerStats } from '../../core/items';
import type { ActionState, EnemyState, GameEvent, PlayerState, RemotePlayer, WorldState } from '../../core/state';
import { enemyAttackType } from '../move-vfx';
import { arrivalCue, cueOfDrain, ERUPTION_CUE, ERUPTION_MOVES, HAND_DRAWN_SHOTS, moveWindup, VANISHING_MOVES, deathCue, enemyStrikeCue, eventCue, eventDoneCue, impactCue, moveCue, projectileCue, rollDustCue, stanceCue, type FxCue } from './cues';
import type { FxSpawn, FxSystem } from './system';

/**
 * Decides which effects play, from the same state every peer sees: moves and
 * rolls from each player's snapshot, enemy strikes and deaths from each enemy's
 * state (a guest runs no enemy AI and gets no events for them, core/sync.ts).
 * Events add only what the local player's own step knows. Nothing here touches
 * the game: the core stays deterministic.
 */

/** The height of a body above its feet, where a swing leaves from. */
const BODY_LIFT = 8;
/** Height of a shot's art against its radius. An enemy shot's solid body must not look smaller than what hits you (its art is mostly glow). */
export const SHOT_HEIGHT = { player: 3.5, enemy: 4.5 } as const;

interface PlayerSeen {
  moveId: MoveId | null;
  active: boolean;
  winding: boolean;
  rolling: boolean;
}

/** How long a vanishing user takes to fade out. */
const VANISH_MS = 120;
/** A new eruption every this many pixels of an Earth Power's path. */
const ERUPTION_STEP = 14;

/** How visible a player is: a vanishing move hides them while it winds up, and they come back for the blow. */
export function vanishAlpha(action: Pick<ActionState, 'moveId' | 'phase' | 'phaseMs'> | null | undefined): number {
  if (!action || !VANISHING_MOVES.has(action.moveId) || (action.phase !== 'windup' && action.phase !== 'charging')) return 1;
  return Math.max(0, 1 - action.phaseMs / VANISH_MS);
}

export const isGroundEruption = (moveId: string | undefined): boolean => moveId !== undefined && ERUPTION_MOVES.has(moveId);

/** Shorter than a real second hit on the same enemy by one peer, longer than a snapshot's round trip. */
const SPARK_GAP_MS = 300;

interface EnemySeen {
  mode: string;
  alive: boolean;
  hitstunMs: number;
  stance: string | undefined;
}

type ViewedEnemy = Pick<EnemyState, 'id' | 'species' | 'types' | 'pos' | 'radius' | 'alive' | 'hitstunMs' | 'ai' | 'boss'>;
export type DirectorView = {
  player: PlayerState;
  remotes: readonly Pick<RemotePlayer, 'id' | 'player'>[];
  enemies: readonly ViewedEnemy[];
  projectiles?: readonly { id: string; pos: { x: number; y: number }; moveId?: string | undefined }[];
  simaEvent?: { kind: string; pos: { x: number; y: number }; done?: boolean } | undefined;
};

/** Reach of a move as drawn: its hitbox with the charge and the held items' reach. */
function moveReach(move: MoveDef, player: Pick<PlayerState, 'action' | 'items' | 'upgrades' | 'level'>): number {
  const size = (move.charge?.[player.action?.chargeLevel ?? 0]?.sizeMultiplier ?? 1) * playerStats(player).reach;
  const hitbox = move.hitbox;
  if (hitbox.kind === 'arc') return hitbox.range * size;
  if (hitbox.kind === 'dash') return Math.max(hitbox.distance * 0.45, hitbox.radius * 2.5);
  return 26;
}

/** Where and how a move's effect plays. Pure, one per move: what a test walks over. */
export function moveSpawn(move: MoveDef, player: Pick<PlayerState, 'pos' | 'action' | 'items' | 'upgrades' | 'level'>): FxSpawn | null {
  const cue = moveCue(move);
  if (!cue) return null;
  const aim = player.action?.aimDir ?? { x: 1, y: 0 };
  const at = { x: player.pos.x, y: player.pos.y - BODY_LIFT };
  const fit = moveReach(move, player);
  // The art's far edge is a few loose sparks; its body should meet the hitbox's edge.
  const aimedFit = fit * 1.6;
  const hitbox = move.hitbox;
  // Under the telegraphs and everything standing: a player's own art never hides a dodge cue.
  if (hitbox.kind === 'self') return { cue, ...at, placement: 'body', layer: 'ground', fit: cue.selfFit ?? fit };
  if (hitbox.kind === 'arc' && hitbox.arcDegrees >= 360) return { cue, ...at, placement: 'body', layer: 'ground', fit };
  return { cue, ...at, placement: 'aim', layer: 'ground', angle: Math.atan2(aim.y, aim.x), fit: aimedFit };
}

export class FxDirector {
  private readonly players = new Map<string, PlayerSeen>();
  private readonly enemies = new Map<string, EnemySeen>();
  /** The floor's first look is what was already there: only later arrivals puff in. */
  private looked = false;
  private eventDone = false;
  private nowMs = 0;
  /** When each enemy last sparked, so a hit undone and confirmed again by snapshots sparks once. */
  private readonly lastSpark = new Map<string, number>();
  /** Enemies whose fall already played: a late snapshot can stand a dead one up again for a moment. */
  private readonly fallen = new Set<string>();
  /** Where each Earth Power last erupted. */
  private readonly eruptions = new Map<string, { x: number; y: number }>();

  constructor(readonly fx: FxSystem) {}

  /** A new floor or run: nothing carried over plays again. */
  reset(): void {
    this.players.clear();
    this.enemies.clear();
    this.fx.clear();
    this.looked = false;
    this.eventDone = false;
    this.lastSpark.clear();
    this.fallen.clear();
    this.eruptions.clear();
  }

  /** The art of the player's own moves, ready before the first press. */
  prepare(loadout: readonly (MoveId | null)[]): void {
    const cues: FxCue[] = [];
    for (const id of loadout) {
      if (!id) continue;
      const move = MOVES[id];
      const own = moveCue(move);
      if (own) cues.push(own);
      const windup = moveWindup(id);
      if (windup) cues.push(windup);
      if (isGroundEruption(id)) cues.push(ERUPTION_CUE);
      else if (move.hitbox.kind === 'projectile' && !HAND_DRAWN_SHOTS.has(id)) cues.push(projectileCue(move.type, id));
      if (move.drain) cues.push(cueOfDrain(move.type));
      cues.push(impactCue(move.type, false), impactCue(move.type, true));
    }
    this.fx.prepare(cues);
  }

  /** Reads this frame's state and plays what changed. */
  observe(view: DirectorView, nowMs = this.nowMs): void {
    this.nowMs = nowMs;
    this.observePlayer('local', view.player);
    for (const remote of view.remotes) this.observePlayer(remote.id, remote.player);
    for (const enemy of view.enemies) this.observeEnemy(enemy);
    this.observeEruptions(view.projectiles ?? []);
    const event = view.simaEvent;
    const done = Boolean(event?.done);
    if (event && done && !this.eventDone && this.looked) this.fx.spawn({ cue: eventDoneCue(event.kind), x: event.pos.x, y: event.pos.y - BODY_LIFT, placement: 'body', layer: 'top', fit: 30 });
    this.eventDone = done;
    this.looked = true;
  }

  /** Local shots only: a peer's shot carries no move id, so it flies as a ball of its type. */
  private observeEruptions(shots: NonNullable<DirectorView['projectiles']>): void {
    if (this.eruptions.size === 0 && !shots.some((s) => isGroundEruption(s.moveId))) return;
    const live = new Set<string>();
    for (const shot of shots) {
      if (!isGroundEruption(shot.moveId)) continue;
      live.add(shot.id);
      const last = this.eruptions.get(shot.id);
      if (last && Math.hypot(shot.pos.x - last.x, shot.pos.y - last.y) < ERUPTION_STEP) continue;
      this.fx.spawn({ cue: ERUPTION_CUE, x: shot.pos.x, y: shot.pos.y + 6, placement: 'ground', layer: 'ground', fitHeight: 34 });
      this.eruptions.set(shot.id, { x: shot.pos.x, y: shot.pos.y });
    }
    for (const id of this.eruptions.keys()) if (!live.has(id)) this.eruptions.delete(id);
  }

  private observePlayer(key: string, player: PlayerState): void {
    const seen = this.players.get(key);
    const action = player.action;
    const active = action?.phase === 'active';
    const moveId = action?.moveId ?? null;
    const rolling = Boolean(player.roll);
    const winding = action?.phase === 'windup' || action?.phase === 'charging';
    if (winding && moveId && !(seen?.winding && seen.moveId === moveId)) {
      const windup = moveWindup(moveId);
      if (windup) this.fx.spawn({ cue: windup, x: player.pos.x, y: player.pos.y - BODY_LIFT, placement: 'body', layer: 'top', fit: VANISHING_MOVES.has(moveId) ? 16 : 24 });
    }
    if (active && moveId && !(seen?.active && seen.moveId === moveId)) {
      const spawn = moveSpawn(MOVES[moveId], player);
      if (spawn) this.fx.spawn(spawn);
    }
    if (rolling && !seen?.rolling) this.fx.spawn({ cue: rollDustCue(), x: player.pos.x, y: player.pos.y, placement: 'body', layer: 'ground', fit: 13 });
    this.players.set(key, { moveId, active, winding, rolling });
  }

  private observeEnemy(enemy: ViewedEnemy): void {
    const seen = this.enemies.get(enemy.id);
    const mode = enemy.ai.mode;
    const stance = enemy.boss?.stance;
    const type = enemyAttackType(enemy);
    const at = { x: enemy.pos.x, y: enemy.pos.y - BODY_LIFT };
    if (!seen && this.looked && enemy.alive) this.fx.spawn({ cue: arrivalCue(), ...at, placement: 'body', layer: 'top', fit: enemy.radius * 2 });
    if (seen) {
      if (seen.alive && !enemy.alive) {
        if (!this.fallen.has(enemy.id)) this.fx.spawn({ cue: deathCue(enemy.types[0] ?? 'normal', Boolean(enemy.boss)), ...at, placement: 'body', layer: 'top', fit: enemy.boss ? enemy.radius * 4 : enemy.radius * 2.4 });
        this.fallen.add(enemy.id);
      } else if (enemy.alive) {
        if (mode === 'attack' && seen.mode !== 'attack') this.strike(enemy, type);
        if (stance !== seen.stance && stance !== undefined) this.fx.spawn({ cue: stanceCue(type), ...at, placement: 'body', layer: 'top', fit: enemy.radius * 3 });
        // A hit dealt by anyone: a guest learns of its peers' hits only from the snapshot.
        if (enemy.hitstunMs > seen.hitstunMs && this.nowMs - (this.lastSpark.get(enemy.id) ?? Number.NEGATIVE_INFINITY) >= SPARK_GAP_MS) {
          this.lastSpark.set(enemy.id, this.nowMs);
          this.impact(type, false, at.x, at.y);
        }
      }
    }
    this.enemies.set(enemy.id, { mode, alive: enemy.alive, hitstunMs: enemy.hitstunMs, stance });
  }

  private strike(enemy: ViewedEnemy, type: PokemonType): void {
    const kind = ENEMY_BEHAVIOUR[enemy.species]?.kind;
    const dir = enemy.ai.attackDir ?? { x: 1, y: 0 };
    const cue = enemyStrikeCue(kind, type);
    const aimed = cue.effect.startsWith('melee/') || cue.effect.endsWith('-breath');
    this.fx.spawn(aimed
      ? { cue, x: enemy.pos.x, y: enemy.pos.y - BODY_LIFT, placement: 'aim', layer: 'top', angle: Math.atan2(dir.y, dir.x), fit: enemy.radius * 3 }
      : { cue, x: enemy.pos.x, y: enemy.pos.y - BODY_LIFT, placement: 'body', layer: 'top', fit: enemy.radius * 2.6 });
  }

  private impact(type: PokemonType, strong: boolean, x: number, y: number): void {
    this.fx.spawn({ cue: impactCue(type, strong), x, y, placement: 'body', layer: 'top', fit: strong ? 34 : 22 });
  }

  /** What the local step knows that a snapshot does not: which move landed, and things only this player gets. */
  handleEvents(events: readonly GameEvent[], player: Pick<PlayerState, 'pos'>): void {
    for (const event of events) {
      if (event.type === 'enemyHit') {
        this.lastSpark.set(event.enemyId, this.nowMs);
        if (event.dot || event.minor) continue;
        const move = event.moveId ? MOVES[event.moveId] : null;
        const strong = event.effectiveness > 1 || Boolean(event.finisher) || move?.juice === 'heavy';
        this.impact(move?.type ?? 'normal', strong, event.pos.x, event.pos.y - BODY_LIFT);
        if (move?.drain) {
          const dx = event.pos.x - player.pos.x;
          const dy = event.pos.y - (player.pos.y - BODY_LIFT);
          this.fx.spawn({ cue: cueOfDrain(move.type), x: player.pos.x, y: player.pos.y - BODY_LIFT, placement: 'aim', layer: 'top', angle: Math.atan2(dy, dx), fit: Math.hypot(dx, dy) });
        }
        continue;
      }
      const cue = eventCue(event);
      if (cue) this.fx.spawn({ cue, x: player.pos.x, y: player.pos.y - BODY_LIFT, placement: 'body', layer: 'top', fit: event.type === 'levelUp' ? 40 : 22 });
    }
  }
}
