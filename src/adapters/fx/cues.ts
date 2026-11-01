import { MOVES, type MoveDef, type MoveId } from '../../data/moves';
import type { PokemonType } from '../../data/types';
import { TYPE_COLORS } from '../../ui/tokens';
import type { BakeRequest } from './bake';

/**
 * Which pixelfx effect each thing in the game plays. Pure data: the art comes
 * in the effect's own colours (`tint: null`, fire stays fire) or recoloured
 * with a type's ramp. Left out on purpose: effects that paint pixelfx's human
 * dummy (blink-in, curse, soul-rise, status/haste...) and cartoon-pow's English text.
 */

/** A type's ramp, or a colour some move has of its own. */
export type FxTint = PokemonType | 'sun';

export interface FxCue {
  effect: string;
  tint: FxTint | null;
  /** Frames baked: fewer frames, less memory. */
  frames: number;
  /** How long one play lasts; pixelfx plays slower than this game's moves. */
  playMs: number;
  /** Share of the effect's duration kept, for the ones that end in a long tail of smoke. */
  span?: number;
  /** A shot whose art is mostly halo: how much bigger to draw it so its body still reads. */
  shotScale?: number;
  /** A boost's art with a shape of its own: world pixels from the user to its edge, rather than the default burst. */
  selfFit?: number;
}

const cue = (effect: string, tint: FxTint | null, frames: number, playMs: number, span?: number): FxCue => ({ effect, tint, frames, playMs, ...(span ? { span } : {}) });

/** Dark to bright ramp of a type, what recolours an effect. */
export function typeRamp(type: FxTint): string[] {
  if (type === 'sun') return ['#3a2200', '#a86a00', '#ffb400', '#ffe45c', '#fffbe0'];
  if (type === 'dark') return ['#140a1f', '#3a1d52', '#7a43a8', '#e0324a', '#ffd0da'];
  const { edge, core, glow } = TYPE_COLORS[type];
  return ['#0c0a14', edge, core, glow, '#ffffff'];
}

export function cueKey(c: FxCue): string {
  return `${c.effect}|${c.tint ?? 'native'}|${c.frames}|${c.span ?? 1}`;
}

export function cueRequest(c: FxCue): BakeRequest {
  return { effect: c.effect, frames: c.frames, ...(c.span ? { span: c.span } : {}), ...(c.tint ? { options: { palette: typeRamp(c.tint) } } : {}) };
}

const SWING_MS = 320;
const HEAVY_SWING_MS = 460;
const RING_MS = 620;
const SELF_MS = 700;

/** Moves with a look of their own; the rest take the default of their hitbox and type. */
const MOVE_LOOKS: Partial<Record<string, FxCue>> = {
  // Claws and fangs.
  'fury-swipes': cue('melee/claw-swipe', 'normal', 7, SWING_MS),
  'hone-claws': cue('melee/claw-swipe', 'dark', 7, SELF_MS),
  'shadow-claw': cue('melee/claw-swipe', 'ghost', 7, SWING_MS),
  'metal-claw': cue('melee/claw-swipe', 'steel', 7, SWING_MS),
  'dragon-claw': cue('melee/claw-swipe', 'dragon', 7, SWING_MS),
  'night-slash': cue('melee/double-slash', 'dark', 7, SWING_MS),
  'x-scissor': cue('melee/double-slash', 'bug', 7, SWING_MS),
  'thunder-fang': cue('melee/claw-swipe', 'electric', 7, SWING_MS),
  'ice-fang': cue('melee/claw-swipe', 'ice', 7, SWING_MS),
  'fire-fang': cue('melee/claw-swipe', 'fire', 7, SWING_MS),
  crunch: cue('melee/claw-swipe', 'dark', 7, SWING_MS),
  // Blows.
  'play-rough': cue('impacts/crit-hit', 'fairy', 7, SWING_MS),
  astonish: cue('impacts/crit-hit', 'ghost', 7, SWING_MS),
  'focus-punch': cue('impacts/crit-hit', 'fighting', 8, HEAVY_SWING_MS),
  'fire-punch': cue('melee/uppercut', 'fire', 7, SWING_MS),
  'thunder-punch': cue('melee/uppercut', 'electric', 7, SWING_MS),
  'ice-punch': cue('melee/uppercut', 'ice', 7, SWING_MS),
  'brick-break': cue('melee/hammer-smash', 'fighting', 8, HEAVY_SWING_MS, 0.5),
  'bone-club': cue('melee/hammer-smash', 'ground', 8, HEAVY_SWING_MS, 0.5),
  'wood-hammer': cue('melee/hammer-smash', 'grass', 8, HEAVY_SWING_MS, 0.5),
  'knock-off': cue('melee/thrust', 'dark', 6, SWING_MS),
  'low-kick': cue('impacts/blunt-hit', 'fighting', 6, SWING_MS, 0.45),
  'double-kick': cue('impacts/blunt-hit', 'fighting', 6, SWING_MS, 0.45),
  // Draining.
  'leech-life': cue('shadow/life-steal', 'bug', 8, HEAVY_SWING_MS),
  'draining-kiss': cue('shadow/life-steal', 'fairy', 8, HEAVY_SWING_MS),
  'drain-punch': cue('shadow/life-steal', 'fighting', 8, HEAVY_SWING_MS),
  // Cones and lines.
  'heat-wave': cue('fire/fire-ring', null, 9, RING_MS),
  'burning-jealousy': cue('fire/flamethrower', null, 8, HEAVY_SWING_MS),
  snarl: cue('ice/frost-breath', 'dark', 8, HEAVY_SWING_MS),
  electroweb: cue('ice/frost-breath', 'electric', 8, HEAVY_SWING_MS),
  'grass-knot': cue('nature/thorns', null, 8, HEAVY_SWING_MS),
  'rock-slide': cue('nature/earth-spike', null, 8, RING_MS),
  poltergeist: cue('shadow/dark-explosion', null, 8, RING_MS, 0.6),
  // Rings.
  'night-daze': cue('shadow/dark-explosion', null, 9, RING_MS, 0.6),
  'stomping-tantrum': cue('nature/quake', null, 8, RING_MS, 0.6),
  earthquake: cue('nature/quake', null, 8, RING_MS, 0.6),
  bulldoze: cue('nature/quake', null, 8, RING_MS, 0.6),
  'dazzling-gleam': cue('holy/sunburst', 'fairy', 8, RING_MS),
  'dark-pulse': cue('explosions/plasma-explosion', 'dark', 9, RING_MS),
  thunder: cue('lightning/thunderclap', null, 9, RING_MS),
  discharge: cue('lightning/thunderclap', null, 9, RING_MS),
  'hyper-voice': cue('explosions/plasma-explosion', 'normal', 9, RING_MS),
  'temper-flare': cue('fire/fire-ring', null, 9, RING_MS),
  'future-sight': cue('arcane/mana-burst', 'psychic', 9, RING_MS),
  surf: cue('water/wave-crash', null, 9, RING_MS),
  // Dashes: tackles land a blow, electric ones crackle, bones keep hitting.
  headbutt: cue('impacts/blunt-hit', 'normal', 6, SWING_MS, 0.45),
  'take-down': cue('impacts/blunt-hit', 'normal', 6, HEAVY_SWING_MS, 0.45),
  'double-edge': cue('impacts/crit-hit', 'normal', 7, HEAVY_SWING_MS),
  'iron-head': cue('impacts/blunt-hit', 'steel', 6, SWING_MS, 0.45),
  spark: cue('lightning/zap-hit', null, 6, SWING_MS),
  'wild-charge': cue('lightning/zap-hit', null, 6, HEAVY_SWING_MS),
  'bone-rush': cue('melee/dagger-flurry', 'ground', 7, HEAVY_SWING_MS),
  'aqua-jet': cue('water/water-jet', null, 6, SWING_MS),
  'flare-blitz': cue('fire/flamethrower', null, 6, HEAVY_SWING_MS),
  'flame-charge': cue('fire/flamethrower', null, 6, SWING_MS),
  'phantom-force': cue('melee/heavy-cleave', 'ghost', 8, HEAVY_SWING_MS),
  'shadow-sneak': cue('melee/thrust', 'ghost', 6, SWING_MS),
  dig: cue('spawn/poof', 'ground', 6, HEAVY_SWING_MS),
  // Boosts.
  'swords-dance': { ...cue('custom/sword-orbit', null, 12, 900), selfFit: 40 },
  'bulk-up': cue('status/rage', 'fighting', 6, SELF_MS),
  reflect: cue('holy/divine-shield', 'psychic', 8, SELF_MS),
  'iron-defense': cue('holy/divine-shield', 'steel', 8, SELF_MS),
  'acid-armor': cue('holy/divine-shield', 'poison', 8, SELF_MS),
  minimize: cue('holy/divine-shield', 'normal', 8, SELF_MS),
  'will-o-wisp': { ...cue('custom/wisp-orbit', null, 14, 1100), selfFit: 34 },
  curse: cue('shadow/shadow-flames', null, 8, SELF_MS),
};

/** What a move plays when it goes off; a projectile move's flight look is `projectileCue`. */
export function moveCue(move: MoveDef): FxCue | null {
  const own = MOVE_LOOKS[move.id];
  if (own) return own;
  const { hitbox, type } = move;
  switch (hitbox.kind) {
    case 'self':
      return cue('arcane/mana-burst', type, 8, SELF_MS);
    case 'dash':
      return cue('melee/thrust', type, 6, move.juice === 'heavy' ? HEAVY_SWING_MS : SWING_MS);
    case 'arc':
      if (hitbox.arcDegrees >= 360) return cue('arcane/mana-burst', type, 9, RING_MS);
      if (move.multiHit && move.multiHit >= 3) return cue('melee/dagger-flurry', type, 7, SWING_MS);
      if (move.multiHit === 2) return cue('melee/double-slash', type, 7, SWING_MS);
      if (hitbox.arcDegrees <= 60) return cue('melee/thrust', type, 6, SWING_MS);
      return move.juice === 'heavy' ? cue('melee/heavy-cleave', type, 8, HEAVY_SWING_MS) : cue('melee/sword-slash', type, 7, SWING_MS);
    case 'projectile':
      return null;
  }
}

/** Shots whose move is not just "a ball of its type". */
const SHOT_LOOKS: Partial<Record<string, FxCue>> = {
  'shadow-ball': { ...cue('arcane/arcane-orb', 'ghost', 8, 800), shotScale: 1.9 },
  'energy-ball': { ...cue('arcane/arcane-orb', 'grass', 8, 800), shotScale: 1.9 },
  'giga-drain': { ...cue('arcane/arcane-orb', 'grass', 8, 800), shotScale: 1.9 },
  'dragon-pulse': { ...cue('arcane/arcane-orb', 'dragon', 8, 800), shotScale: 1.9 },
  thunderbolt: { ...cue('lightning/ball-lightning', null, 8, 600), shotScale: 2.2 },
  'bubble-beam': { ...cue('water/water-orb', null, 8, 700), shotScale: 1.8 },
  swift: { ...cue('pickups/power-star', 'electric', 6, 400), shotScale: 1.5 },
  smog: cue('spawn/poof', 'poison', 6, 700, 0.5),
  'clear-smog': cue('spawn/poof', 'poison', 6, 700, 0.5),
  'solar-beam': { ...cue('projectiles/plasma-shot', 'sun', 5, 400), shotScale: 1.3 },
  'mud-slap': cue('spawn/poof', 'ground', 6, 500, 0.5),
  'scorching-sands': cue('spawn/poof', 'ground', 6, 500, 0.5),
};

/** The look of a shot in flight: its move's own if it has one; a remote shot carries no move id, only its type. */
export function projectileCue(type: PokemonType, moveId?: string): FxCue {
  const own = moveId ? SHOT_LOOKS[moveId] : undefined;
  if (own) return own;
  switch (type) {
    case 'fire':
      return cue('fire/fireball', null, 6, 400);
    case 'ice':
      return cue('ice/ice-lance', null, 5, 400);
    case 'psychic':
      return cue('projectiles/energy-disc', type, 5, 300);
    default:
      return cue('projectiles/plasma-shot', type, 5, 400);
  }
}

/** A landed hit. `strong`: super effective, a finisher or a heavy move. */
export function impactCue(type: PokemonType, strong: boolean): FxCue {
  if (strong) return cue('impacts/crit-hit', type, 6, 360);
  switch (type) {
    case 'electric':
      return cue('lightning/zap-hit', null, 5, 280);
    case 'fighting':
    case 'ground':
    case 'rock':
      return cue('impacts/blunt-hit', type, 5, 280);
    default:
      return cue('impacts/hit-spark', type, 5, 240);
  }
}

/** Every look the game can ask for a move and its hits: what a test walks over. */
export function allMoveCues(moves: readonly MoveDef[]): FxCue[] {
  return moves.flatMap((m) => [moveCue(m), projectileCue(m.type), projectileCue(m.type, m.id), impactCue(m.type, false), impactCue(m.type, true)].filter((c): c is FxCue => c !== null));
}

/** An enemy's attack going off, by its behaviour; every kind has one, and an unknown species the default. */
export function enemyStrikeCue(kind: string | undefined, type: PokemonType): FxCue {
  switch (kind) {
    case 'lunger':
    case 'counter':
      return cue('melee/thrust', type, 6, SWING_MS);
    case 'slammer':
      return cue('melee/hammer-smash', type, 8, HEAVY_SWING_MS, 0.5);
    case 'caster':
    case 'mortar':
      return cue('impacts/hit-spark', type, 5, 240);
    case 'spore':
    case 'bomber':
      return cue('nature/spore-burst', null, 8, RING_MS, 0.6);
    case 'beam':
    case 'cone':
      return cue('ice/frost-breath', type, 8, HEAVY_SWING_MS);
    case 'pulse':
      return cue('explosions/plasma-explosion', type, 9, RING_MS);
    default:
      return cue('melee/heavy-cleave', type, 8, HEAVY_SWING_MS);
  }
}

/** An enemy falling: a puff in its colours; a boss goes out with a blast. */
export function deathCue(type: PokemonType, boss: boolean): FxCue {
  return boss ? cue('explosions/plasma-explosion', type, 10, 900) : cue('spawn/poof', type, 7, 520);
}

/** Something pulled out of nowhere mid-fight (a summon, a wave). */
export function arrivalCue(): FxCue {
  return cue('spawn/poof', 'ghost', 6, 400);
}

/** A floor event paying out (the chest opened, the crystal taken). */
export function eventDoneCue(kind: string): FxCue {
  return kind === 'crystal' ? cue('ice/ice-shatter', null, 8, 600, 0.6) : cue('pickups/collect-burst', 'electric', 7, 600);
}

export function rollDustCue(): FxCue {
  return cue('spawn/poof', 'normal', 5, 300);
}

/** A boss changing stance. */
export function stanceCue(type: PokemonType): FxCue {
  return cue('arcane/mana-burst', type, 9, RING_MS);
}

/** Things that happen to the local player, drawn on them. */
export function eventCue(event: { type: string }): FxCue | null {
  switch (event.type) {
    case 'levelUp':
      return cue('holy/sunburst', null, 8, 800);
    case 'berryEaten':
      return cue('pickups/collect-burst', 'grass', 7, 500);
    case 'perfectDodge':
      return cue('pickups/collect-burst', 'normal', 7, 400);
    case 'playerHurt':
      return cue('impacts/hit-spark', 'dark', 5, 240);
    case 'cardCaptured':
      return cue('pickups/collect-burst', 'fairy', 7, 600);
    case 'disguiseBroken':
      return cue('spawn/poof', 'ghost', 7, 500);
    default:
      return null;
  }
}

/** Fire Spin and other still fires stand in place: a tornado rather than a shot in flight. */
export function stillShotCue(type: PokemonType): FxCue | null {
  return type === 'fire' ? cue('fire/fire-tornado', null, 10, 700) : null;
}

/** Looping looks of things in the world. */
export const WORLD_CUES = {
  timeCrystal: cue('ice/ice-crystal', null, 12, 1500),
  bonfire: cue('fire/campfire', null, 12, 1200),
  memory: cue('pickups/xp-orb', 'psychic', 10, 900),
  sparkleGem: cue('pickups/gem-spin', 'water', 12, 1200),
  chest: cue('pickups/chest-open', null, 12, 1300),
  altar: cue('shadow/shadow-flames', null, 10, 1200),
  caveCrystalCold: cue('pickups/crystal-shard', 'ice', 10, 2400),
  caveCrystalViolet: cue('pickups/crystal-shard', 'ghost', 10, 2400),
  burn: cue('status/burning', null, 8, 900),
  poison: cue('pickups/xp-orb', 'poison', 8, 1000),
  exit: cue('arcane/rune-circle', 'fairy', 12, 2400),
} as const satisfies Record<string, FxCue>;

/** Moves that vanish while winding up and come back for the blow (Shadow Force, Phantom Force, Dig). Only how it looks: the hitbox and timing do not change. */
export const VANISHING_MOVES: ReadonlySet<string> = new Set(['shadow-force', 'phantom-force', 'dig']);

/** What plays while a move winds up: Solar Beam gathering sunlight, a puff where a vanishing user was. */
export function moveWindup(moveId: string): FxCue | null {
  if (moveId === 'solar-beam') return cue('arcane/spell-charge', 'sun', 10, MOVES[moveId as MoveId].windupMs);
  if (VANISHING_MOVES.has(moveId)) return cue('spawn/poof', moveId === 'dig' ? 'ground' : 'ghost', 6, 420, 0.5);
  return null;
}

/** Shots that keep their own hand-drawn look. */
export const HAND_DRAWN_SHOTS: ReadonlySet<string> = new Set(['bonemerang']);

/** Earth Power is not a ball: it bursts out of the ground along its path. */
export const ERUPTION_MOVES: ReadonlySet<string> = new Set(['earth-power']);
export const ERUPTION_CUE: FxCue = cue('nature/earth-spike', null, 7, 460, 0.6);

/** A draining hit's motes flowing back to the user, in the move's colours. */
export function cueOfDrain(type: PokemonType): FxCue {
  return cue('custom/drain-motes', type, 8, 620);
}
