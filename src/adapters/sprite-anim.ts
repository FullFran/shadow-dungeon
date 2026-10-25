import { MOVES, type MoveId } from '../data/moves';
import { SPECIES } from '../data/species';
import { SPRITE_KEYS, SPRITES, type AnimMeta } from '../data/sprites';
import { TUNING } from '../data/tuning';
import type { EnemyState, PlayerState } from '../core/state';
import type { Vec2 } from '../core/vec';

/**
 * Pure animation selection and frame timing for the renderer. Sheets are
 * PMD-style: frames left to right, one row per direction in the order of
 * `SPRITES.directions` (down, downRight, right, upRight, up, upLeft, left,
 * downLeft). Durations are in 1/60 s ticks.
 */
export type SpriteKey = (typeof SPRITE_KEYS)[keyof typeof SPRITE_KEYS];

/** Sheet row for a facing vector (screen y grows down). */
export function directionRow(dir: Vec2): number {
  if (dir.x === 0 && dir.y === 0) return 0;
  const angle = Math.atan2(dir.y, dir.x);
  const index = Math.round((Math.PI / 2 - angle) / (Math.PI / 4));
  return ((index % 8) + 8) % 8;
}

const totalTicks = (durations: readonly number[]) => durations.reduce((sum, d) => sum + d, 0);

/** Frame shown after `ms` of playing; loops or holds the last frame. */
export function frameAtTime(durations: readonly number[], ms: number, loop: boolean): number {
  const total = totalTicks(durations);
  if (total <= 0 || durations.length === 0) return 0;
  let ticks = (Math.max(0, ms) * SPRITES.ticksPerSecond) / 1000;
  if (loop) ticks %= total;
  else if (ticks >= total) return durations.length - 1;
  for (let i = 0; i < durations.length; i++) {
    ticks -= durations[i]!;
    if (ticks < 0) return i;
  }
  return durations.length - 1;
}

/** Frame at `progress` (0..1) through the frames [from, to), with their own relative durations. */
function frameInRange(durations: readonly number[], from: number, to: number, progress: number): number {
  const slice = durations.slice(from, to);
  const total = totalTicks(slice);
  if (slice.length === 0 || total <= 0) return Math.min(from, durations.length - 1);
  const target = Math.min(0.9999, Math.max(0, progress)) * total;
  let acc = 0;
  for (let i = 0; i < slice.length; i++) {
    acc += slice[i]!;
    if (target < acc) return from + i;
  }
  return to - 1;
}

export type ActionPhaseName = 'windup' | 'active' | 'recovery';

/**
 * Frame of an attack animation stretched over a move's phases, so the sheet's
 * HitFrame lands on the first active tick and its ReturnFrame on recovery.
 * Without markers, or with a HitFrame of 0 or 1 (which would hold frame 0
 * through the whole windup), the whole sheet is spread over the move.
 * `windupFrom` skips the first frames of the windup, for a move whose windup
 * is much shorter than the sheet's (it would race through them).
 */
export function attackFrame(
  anim: Pick<AnimMeta, 'durations' | 'hitFrame' | 'returnFrame'>,
  phase: ActionPhaseName,
  progress: number,
  windupFrom = 0,
): number {
  const count = anim.durations.length;
  const hit = anim.hitFrame;
  if (hit === undefined || hit <= 1 || hit >= count) {
    const third = { windup: 0, active: 1, recovery: 2 }[phase];
    return frameInRange(anim.durations, 0, count, (third + progress) / 3);
  }
  const back = anim.returnFrame !== undefined && anim.returnFrame > hit && anim.returnFrame < count ? anim.returnFrame : Math.min(count, hit + 1);
  if (phase === 'windup') return frameInRange(anim.durations, Math.max(0, Math.min(windupFrom, hit - 1)), hit, progress);
  if (phase === 'active') return frameInRange(anim.durations, hit, back, progress);
  return frameInRange(anim.durations, back, count, progress);
}

export interface AnimChoice {
  sprite: SpriteKey;
  anim: string;
  /** Frame index inside the sheet row. */
  frame: number;
  row: number;
}

const animMeta = (sprite: SpriteKey, anim: string): AnimMeta | undefined => SPRITES.sprites[sprite]?.anims[anim];

/** Picks a looping animation at `timeMs`, falling back to Idle when the sheet is missing. */
function looping(sprite: SpriteKey, anim: string, timeMs: number, facing: Vec2): AnimChoice {
  const name = animMeta(sprite, anim) ? anim : 'Idle';
  const meta = animMeta(sprite, name);
  return { sprite, anim: name, frame: meta ? frameAtTime(meta.durations, timeMs, true) : 0, row: directionRow(facing) };
}

function once(sprite: SpriteKey, anim: string, timeMs: number, facing: Vec2): AnimChoice {
  const meta = animMeta(sprite, anim);
  if (!meta) return looping(sprite, 'Idle', timeMs, facing);
  return { sprite, anim, frame: frameAtTime(meta.durations, timeMs, false), row: directionRow(facing) };
}

/**
 * Sheet used by each player move (`attackSheet` picks a fallback when a
 * species lacks it). `windupFrom`: first windup frame (see `attackFrame`);
 * `turnAround`: a dash that carries the player past its target faces back
 * during recovery.
 */
export interface MoveAnim {
  charge?: string;
  attack: string;
  windupFrom?: number;
  turnAround?: boolean;
}

export const MOVE_ANIMS: Record<MoveId, MoveAnim> = {
  'shadow-claw': { attack: 'Attack' },
  'shadow-sneak': { attack: 'Strike' },
  'play-rough': { charge: 'Charge', attack: 'Double' },
  'shadow-ball': { charge: 'Charge', attack: 'Shoot' },
  'fury-swipes': { attack: 'Double' },
  'feint-attack': { attack: 'Strike', windupFrom: 2, turnAround: true },
  'night-daze': { charge: 'Charge', attack: 'SpAttack' },
  'foul-play': { charge: 'Charge', attack: 'Attack' },
  ember: { attack: 'Attack' },
  astonish: { attack: 'Attack' },
  hex: { charge: 'Charge', attack: 'Rotate' },
  inferno: { charge: 'Charge', attack: 'Double' },
  'bone-club': { attack: 'Attack' },
  'bone-rush': { attack: 'Double' },
  bonemerang: { charge: 'Charge', attack: 'Swing' },
  'stomping-tantrum': { charge: 'Charge', attack: 'SpAttack' },
};

/** Release sheets tried, in order, when a move's own sheet is missing or only a copy of Charge. */
const RELEASE_FALLBACKS = ['Double', 'Rotate', 'Attack'] as const;

/** Sheet a sprite plays for a move's windup, active and recovery phases. */
export function attackSheet(sprite: SpriteKey, moveId: MoveId): string {
  const usable = (name: string) => {
    const meta = animMeta(sprite, name);
    return meta !== undefined && (name === 'Charge' || meta.source !== 'Charge');
  };
  const wanted = MOVE_ANIMS[moveId].attack;
  if (usable(wanted)) return wanted;
  return RELEASE_FALLBACKS.find(usable) ?? 'Attack';
}

/** Sheet of a player: its species' sprite, or the spent one once its passive is used up (Mimikyu's Busted form). */
export function playerSprite(player: Pick<PlayerState, 'species' | 'disguiseBroken'>): SpriteKey {
  const species = SPECIES[player.species];
  return SPRITE_KEYS[species.spentSprite && player.disguiseBroken ? species.spentSprite : species.sprite];
}

export interface PlayerAnimContext {
  timeMs: number;
  /** Real time since the player was last hurt (Infinity if never). */
  sinceHurtMs: number;
  moving: boolean;
}

export function playerAnim(player: PlayerState, ctx: PlayerAnimContext): AnimChoice {
  const sprite = playerSprite(player);
  const facing = player.action?.aimDir ?? player.facing;
  if (player.hp <= 0) return once(sprite, 'Faint', ctx.sinceHurtMs, facing);
  if (player.roll) {
    const hop = animMeta(sprite, 'Hop') ? 'Hop' : 'Walk';
    const meta = animMeta(sprite, hop)!;
    const progress = player.roll.elapsedMs / TUNING.roll.durationMs;
    return { sprite, anim: hop, frame: frameInRange(meta.durations, 0, meta.durations.length, progress), row: directionRow(player.roll.dir) };
  }
  const action = player.action;
  if (action) {
    const anims = MOVE_ANIMS[action.moveId];
    if (action.phase === 'charging') return looping(sprite, anims.charge ?? 'Charge', action.chargeMs, facing);
    const move = MOVES[action.moveId];
    const duration = { windup: move.windupMs, active: move.activeMs, recovery: move.recoveryMs }[action.phase];
    const attack = attackSheet(sprite, action.moveId);
    const meta = animMeta(sprite, attack)!;
    const turned = anims.turnAround && action.phase === 'recovery' ? { x: -facing.x, y: -facing.y } : facing;
    return { sprite, anim: attack, frame: attackFrame(meta, action.phase, action.phaseMs / duration, anims.windupFrom), row: directionRow(turned) };
  }
  if (ctx.sinceHurtMs < 250) return once(sprite, 'Hurt', ctx.sinceHurtMs, facing);
  return looping(sprite, ctx.moving ? 'Walk' : 'Idle', ctx.timeMs, facing);
}

/** Sprite sheet of an enemy (Aegislash switches form with its stance, halfway through the transformation). */
export function enemySprite(enemy: EnemyState): SpriteKey {
  if (enemy.species !== 'aegislash') return SPRITE_KEYS[SPECIES[enemy.species].sprite];
  const stance = enemy.boss?.stance ?? 'shield';
  const transforming = enemy.ai.mode === 'transform' && enemy.ai.modeMs >= enemy.ai.modeDurationMs / 2;
  // Shield form: Shield, the planted Oaths shield and the start of the unsheathing; the other cards are the Blade.
  const now = stance === 'shield' || stance === 'oaths' || stance === 'unsheathe' ? 'shield' : 'blade';
  // Halfway through a change it shows what it turns into: Shield and the unsheathing become Blade, everything else Shield.
  const next = stance === 'shield' || stance === 'unsheathe' ? 'blade' : 'shield';
  return (transforming ? next : now) === 'shield' ? SPRITE_KEYS.aegislashShield : SPRITE_KEYS.aegislashBlade;
}

const ENEMY_ATTACK_ANIM: Record<EnemyState['species'], string> = {
  mimikyu: 'Attack',
  zorua: 'Attack',
  litwick: 'Shoot',
  cubone: 'Attack',
  poochyena: 'Attack',
  gastly: 'Shoot',
  aegislash: 'Attack',
  phantump: 'Attack',
  'pumpkaboo-small': 'Attack',
  'pumpkaboo-super': 'Attack',
  foongus: 'Shoot',
  spinarak: 'Shoot',
  hoothoot: 'Attack',
  trevenant: 'Attack',
  decidueye: 'Shoot',
  zubat: 'Attack',
  tentacool: 'Attack',
  chinchou: 'Shoot',
  corphish: 'Shoot',
  clauncher: 'Shoot',
  wooper: 'Attack',
  grimer: 'Attack',
  koffing: 'Shoot',
  ekans: 'Attack',
  croagunk: 'Attack',
  stunky: 'Shoot',
  houndour: 'Shoot',
  slugma: 'Shoot',
  litleo: 'Shoot',
  duskull: 'Shoot',
  golett: 'Attack',
  pawniard: 'Attack',
  sableye: 'Attack',
  'eclipse-nest': 'Idle',
  'eclipse-hunter': 'Attack',
};

export interface EnemyAnimContext {
  timeMs: number;
  /** Real time since it was defeated (Infinity while alive). */
  sinceDefeatMs: number;
}

export function enemyAnim(enemy: EnemyState, ctx: EnemyAnimContext): AnimChoice {
  const sprite = enemySprite(enemy);
  const { ai, facing } = enemy;
  if (!enemy.alive) return once(sprite, 'Faint', ctx.sinceDefeatMs, facing);
  if (enemy.hitstunMs > 0) return once(sprite, 'Hurt', 0, facing);
  switch (ai.mode) {
    case 'telegraph':
      return looping(sprite, 'Charge', ai.modeMs, facing);
    case 'attack': {
      const blade = enemy.boss?.stance === 'blade';
      const anim = blade ? 'Swing' : ENEMY_ATTACK_ANIM[enemy.species];
      const meta = animMeta(sprite, anim);
      if (!meta) return looping(sprite, 'Idle', ctx.timeMs, facing);
      const progress = ai.modeDurationMs > 0 ? ai.modeMs / ai.modeDurationMs : 1;
      return { sprite, anim, frame: attackFrame(meta, 'active', progress), row: directionRow(ai.attackDir) };
    }
    case 'transform':
      return looping(sprite, 'Rotate', ai.modeMs, facing);
    case 'approach':
    case 'reposition':
      return looping(sprite, 'Walk', ctx.timeMs, facing);
    default:
      return looping(sprite, 'Idle', ctx.timeMs, facing);
  }
}
