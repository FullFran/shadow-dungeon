import { HEAVY_CHARGE } from './charge';
import type { HitboxDef, MoveDef } from './moves';
import type { SlotKind } from './slots';
import type { PokemonType } from './types';

/**
 * The move tutor's moves (odd/tasks/movepools.md, odd/tasks/roster-parity.md):
 * the starters' and the gacha lines' canon learnsets (data/learnsets.ts)
 * redesigned for real-time combat. Powers are
 * the official ones; the timings keep each slot inside the damage budget of
 * the original kits (tests/data/tutor-moves.test.ts): a stronger move is
 * slower, costs stamina or HP, or recoils. Simplified statuses: burn and
 * poison are a damage over time (`dot`), flinch and paralysis a longer
 * stagger (`hitstunMs`), priority a shorter wind-up; Grass Knot and Low Kick
 * get a fixed power since there is no weight. Moves of a variable or fixed
 * damage in the games (Night Shade) take a fixed power.
 */
export const TUTOR_MOVE_IDS = [
  // Mimikyu
  'slash',
  'x-scissor',
  'leech-life',
  'draining-kiss',
  'night-slash',
  'wood-hammer',
  'drain-punch',
  'giga-drain',
  'thunderbolt',
  'take-down',
  'hone-claws',
  'curse',
  'phantom-force',
  'burning-jealousy',
  'thunder',
  // Zorua
  'sucker-punch',
  'u-turn',
  'lash-out',
  'swift',
  'knock-off',
  'sludge-bomb',
  'grass-knot',
  'extrasensory',
  'calm-mind',
  'agility',
  'hyper-voice',
  // Litwick
  'smog',
  'night-shade',
  'flame-charge',
  'clear-smog',
  'fire-blast',
  'energy-ball',
  'overheat',
  'flare-blitz',
  'poltergeist',
  'solar-beam',
  'psychic',
  'temper-flare',
  'acid-armor',
  'minimize',
  'fire-spin',
  // Cubone
  'mud-slap',
  'headbutt',
  'double-kick',
  'low-kick',
  'fire-punch',
  'thunder-punch',
  'double-edge',
  'iron-head',
  'earth-power',
  'dig',
  'brick-break',
  'focus-punch',
  'scorching-sands',
  'focus-energy',
  'belly-drum',
  'iron-defense',
  'rock-slide',
  'ice-beam',
  // Abra's line
  'psycho-cut',
  'ice-punch',
  'psyshock',
  'reflect',
  'psybeam',
  'future-sight',
  // Piplup's line
  'aqua-jet',
  'metal-claw',
  'flash-cannon',
  'hydro-pump',
  // Shinx's line
  'thunder-fang',
  'ice-fang',
  'fire-fang',
  'crunch',
  'wild-charge',
  'charge',
  'howl',
  'discharge',
  'electroweb',
  // Axew's line
  'outrage',
  'dragon-dance',
] as const;

export type TutorMoveId = (typeof TUTOR_MOVE_IDS)[number];

type Extra = Omit<Partial<MoveDef>, 'id' | 'slot' | 'type' | 'power' | 'hitbox'>;

/** One move: wind-up, active and recovery in ms; heavy moves charge like the original ones (also data/line-moves.ts). */
export function def(id: MoveDef['id'], slot: SlotKind, type: PokemonType, power: number, timing: readonly [number, number, number], hitbox: HitboxDef, hitstunMs: number, knockback: number, extra: Extra = {}): MoveDef {
  const [windupMs, activeMs, recoveryMs] = timing;
  return {
    id,
    slot,
    type,
    power,
    windupMs,
    activeMs,
    recoveryMs,
    staminaCost: 0,
    hitbox,
    hitstunMs,
    knockback,
    ...(slot === 'heavy' ? { staminaCost: 30, charge: HEAVY_CHARGE } : {}),
    // Area hits feel heavy, but a lingering zone's ticks stay light.
    ...(slot === 'area' && !(hitbox.kind === 'projectile' && hitbox.linger) ? { juice: 'heavy' as const } : {}),
    ...extra,
  };
}

export const arc = (range: number, arcDegrees: number): HitboxDef => ({ kind: 'arc', range, arcDegrees });
export const dash = (distance: number, radius: number): HitboxDef => ({ kind: 'dash', distance, radius });
export const shot = (speed: number, radius: number, lifetimeMs: number, more: { wave?: boolean; homing?: number; linger?: number } = {}): HitboxDef => ({
  kind: 'projectile',
  speed,
  radius,
  lifetimeMs,
  ...(more.wave ? { wave: true } : {}),
  ...(more.homing ? { homing: more.homing } : {}),
  ...(more.linger ? { linger: more.linger } : {}),
});
const SELF: HitboxDef = { kind: 'self' };
/** Boost moves: a short rooted cast, no damage. */
const CAST = [160, 60, 220] as const;

export const TUTOR_MOVES: Record<TutorMoveId, MoveDef> = {
  // --- Mimikyu ---
  slash: def('slash', 'fast', 'normal', 70, [100, 80, 195], arc(34, 120), 220, 30, { critBonus: 0.25 }),
  'x-scissor': def('x-scissor', 'fast', 'bug', 80, [110, 80, 200], arc(36, 90), 260, 40),
  'leech-life': def('leech-life', 'fast', 'bug', 80, [120, 80, 260], arc(30, 100), 220, 25, { drain: 0.25 }),
  'draining-kiss': def('draining-kiss', 'fast', 'fairy', 50, [90, 80, 170], arc(28, 90), 200, 20, { drain: 0.4 }),
  'night-slash': def('night-slash', 'fast', 'dark', 70, [100, 80, 195], arc(36, 110), 220, 30, { critBonus: 0.25 }),
  'wood-hammer': def('wood-hammer', 'heavy', 'grass', 120, [300, 120, 320], arc(42, 120), 460, 90, { staminaCost: 35, recoil: 0.33, juice: 'heavy' }),
  'drain-punch': def('drain-punch', 'heavy', 'fighting', 75, [260, 100, 340], arc(40, 100), 400, 60, { drain: 0.5 }),
  'giga-drain': def('giga-drain', 'heavy', 'grass', 75, [280, 60, 340], shot(170, 9, 2200), 360, 40, { drain: 0.5 }),
  thunderbolt: def('thunderbolt', 'heavy', 'electric', 90, [300, 60, 420], shot(240, 8, 1800), 420, 50),
  'take-down': def('take-down', 'heavy', 'normal', 90, [280, 160, 340], dash(80, 16), 400, 80, { recoil: 0.25, juice: 'heavy' }),
  'hone-claws': def('hone-claws', 'boost', 'dark', 0, CAST, SELF, 0, 0, { cooldownMs: 13000, buff: { kind: 'haste', speed: 1.1, critChance: 0.3, durationMs: 6000 } }),
  curse: def('curse', 'boost', 'ghost', 0, [200, 60, 260], SELF, 0, 0, { cooldownMs: 16000, hpCost: 0.15, buff: { kind: 'power', multiplier: 1.6, hits: 4, durationMs: 10000 } }),
  'phantom-force': def('phantom-force', 'area', 'ghost', 90, [660, 200, 360], dash(120, 18), 420, 80, { staminaCost: 40, cooldownMs: 5600 }),
  'burning-jealousy': def('burning-jealousy', 'area', 'fire', 70, [280, 120, 360], arc(64, 120), 340, 50, { staminaCost: 30, cooldownMs: 7000, dot: 'burn' }),
  thunder: def('thunder', 'area', 'electric', 110, [660, 140, 440], arc(70, 360), 480, 80, { staminaCost: 45, cooldownMs: 6800 }),
  // --- Zorua ---
  'sucker-punch': def('sucker-punch', 'fast', 'dark', 70, [50, 120, 230], dash(64, 16), 240, 40, { bonus: { when: 'attacking', multiplier: 1.5 } }),
  'u-turn': def('u-turn', 'fast', 'bug', 70, [80, 140, 200], dash(70, 16), 220, 40),
  'lash-out': def('lash-out', 'fast', 'dark', 75, [110, 80, 190], arc(34, 120), 240, 40, { bonus: { when: 'afterMiss', multiplier: 1.5 } }),
  swift: def('swift', 'fast', 'normal', 60, [80, 60, 220], shot(260, 6, 900, { homing: 240 }), 180, 15),
  'knock-off': def('knock-off', 'fast', 'dark', 65, [100, 80, 180], arc(36, 100), 300, 70, { juice: 'heavy' }),
  'sludge-bomb': def('sludge-bomb', 'heavy', 'poison', 90, [480, 60, 180], shot(160, 10, 2400), 380, 50, { staminaCost: 40, dot: 'poison' }),
  'grass-knot': def('grass-knot', 'heavy', 'grass', 80, [260, 100, 360], arc(44, 60), 480, 30),
  extrasensory: def('extrasensory', 'heavy', 'psychic', 80, [260, 60, 370], shot(200, 9, 2000), 460, 50),
  'calm-mind': def('calm-mind', 'boost', 'psychic', 0, CAST, SELF, 0, 0, { cooldownMs: 15000, buff: { kind: 'focus', multiplier: 1.25, damageTaken: 0.8, durationMs: 7000 } }),
  agility: def('agility', 'boost', 'psychic', 0, [120, 60, 180], SELF, 0, 0, { cooldownMs: 12000, buff: { kind: 'haste', speed: 1.5, critChance: 0, durationMs: 5000 } }),
  'hyper-voice': def('hyper-voice', 'area', 'normal', 90, [660, 120, 380], arc(62, 360), 380, 70, { staminaCost: 40, cooldownMs: 5600 }),
  // --- Litwick ---
  smog: def('smog', 'fast', 'poison', 30, [80, 60, 160], shot(200, 7, 800), 160, 10, { dot: 'poison' }),
  'night-shade': def('night-shade', 'fast', 'ghost', 50, [90, 60, 190], shot(220, 7, 1000), 260, 20),
  'flame-charge': def('flame-charge', 'fast', 'fire', 50, [80, 140, 180], dash(70, 16), 200, 30),
  'clear-smog': def('clear-smog', 'fast', 'poison', 50, [90, 60, 190], shot(220, 7, 900), 200, 20),
  'fire-blast': def('fire-blast', 'heavy', 'fire', 110, [480, 60, 290], shot(140, 13, 2600), 460, 90, { staminaCost: 40, dot: 'burn', juice: 'heavy' }),
  'energy-ball': def('energy-ball', 'heavy', 'grass', 90, [300, 60, 420], shot(160, 10, 2400), 380, 60),
  overheat: def('overheat', 'heavy', 'fire', 130, [380, 60, 460], shot(150, 14, 2400), 480, 90, { staminaCost: 40, cooldownMs: 7000, juice: 'heavy' }),
  'flare-blitz': def('flare-blitz', 'heavy', 'fire', 120, [320, 180, 360], dash(90, 18), 460, 90, { staminaCost: 35, recoil: 0.33, dot: 'burn', juice: 'heavy' }),
  poltergeist: def('poltergeist', 'heavy', 'ghost', 110, [420, 100, 420], arc(54, 70), 440, 70, { staminaCost: 35, juice: 'heavy' }),
  'solar-beam': def('solar-beam', 'heavy', 'grass', 120, [620, 60, 420], shot(300, 12, 600, { wave: true }), 420, 60, { staminaCost: 35, juice: 'heavy' }),
  psychic: def('psychic', 'heavy', 'psychic', 90, [300, 60, 420], shot(180, 10, 2200), 400, 60),
  'temper-flare': def('temper-flare', 'heavy', 'fire', 75, [300, 100, 360], arc(42, 360), 400, 70, { bonus: { when: 'afterMiss', multiplier: 2 }, juice: 'heavy' }),
  'acid-armor': def('acid-armor', 'boost', 'poison', 0, [200, 60, 240], SELF, 0, 0, { cooldownMs: 16000, buff: { kind: 'guard', damageTaken: 0.5, durationMs: 5000 } }),
  minimize: def('minimize', 'boost', 'normal', 0, [120, 60, 180], SELF, 0, 0, { cooldownMs: 12000, buff: { kind: 'haste', speed: 1.25, critChance: 0.1, durationMs: 4000 } }),
  'fire-spin': def('fire-spin', 'area', 'fire', 30, [660, 60, 360], shot(0, 30, 2400, { linger: 600 }), 200, 10, { staminaCost: 40, cooldownMs: 8700, dot: 'burn' }),
  // --- Cubone ---
  'mud-slap': def('mud-slap', 'fast', 'ground', 20, [60, 60, 140], shot(240, 6, 700), 420, 15),
  headbutt: def('headbutt', 'fast', 'normal', 70, [100, 120, 200], dash(56, 16), 420, 50),
  'double-kick': def('double-kick', 'fast', 'fighting', 30, [80, 140, 170], arc(30, 100), 160, 15, { multiHit: 2 }),
  'low-kick': def('low-kick', 'fast', 'fighting', 60, [90, 80, 170], arc(32, 120), 260, 30),
  'fire-punch': def('fire-punch', 'fast', 'fire', 75, [110, 80, 235], arc(34, 100), 260, 40, { dot: 'burn' }),
  'thunder-punch': def('thunder-punch', 'fast', 'electric', 75, [110, 80, 200], arc(34, 100), 320, 40),
  'double-edge': def('double-edge', 'heavy', 'normal', 120, [300, 180, 280], dash(84, 17), 460, 90, { staminaCost: 35, recoil: 0.33, juice: 'heavy' }),
  'iron-head': def('iron-head', 'heavy', 'steel', 80, [260, 160, 320], dash(70, 16), 480, 70),
  'earth-power': def('earth-power', 'heavy', 'ground', 90, [320, 60, 400], shot(220, 11, 500, { wave: true }), 400, 60),
  dig: def('dig', 'heavy', 'ground', 80, [420, 200, 320], dash(110, 16), 400, 70),
  'brick-break': def('brick-break', 'heavy', 'fighting', 75, [240, 100, 340], arc(40, 110), 400, 60),
  'focus-punch': def('focus-punch', 'heavy', 'fighting', 150, [480, 100, 340], arc(40, 90), 560, 100, { staminaCost: 40, juice: 'heavy' }),
  'scorching-sands': def('scorching-sands', 'heavy', 'ground', 70, [260, 60, 320], shot(200, 9, 2000), 360, 50, { staminaCost: 35, dot: 'burn' }),
  'focus-energy': def('focus-energy', 'boost', 'normal', 0, CAST, SELF, 0, 0, { cooldownMs: 15000, buff: { kind: 'haste', speed: 1, critChance: 0.5, durationMs: 6000 } }),
  'belly-drum': def('belly-drum', 'boost', 'normal', 0, [240, 60, 280], SELF, 0, 0, { cooldownMs: 22000, hpCost: 0.5, buff: { kind: 'power', multiplier: 2, hits: 3, durationMs: 10000 } }),
  'iron-defense': def('iron-defense', 'boost', 'steel', 0, [200, 60, 240], SELF, 0, 0, { cooldownMs: 16000, buff: { kind: 'guard', damageTaken: 0.5, durationMs: 5000 } }),
  'rock-slide': def('rock-slide', 'area', 'rock', 75, [300, 120, 380], arc(66, 110), 420, 60, { staminaCost: 35, cooldownMs: 7000 }),
  'ice-beam': def('ice-beam', 'area', 'ice', 90, [660, 60, 380], shot(280, 12, 520, { wave: true }), 400, 50, { staminaCost: 40, cooldownMs: 5600 }),
  // --- Abra's line ---
  'psycho-cut': def('psycho-cut', 'fast', 'psychic', 70, [100, 80, 195], arc(36, 110), 220, 30, { critBonus: 0.25 }),
  'ice-punch': def('ice-punch', 'fast', 'ice', 75, [110, 80, 200], arc(34, 100), 320, 40),
  psyshock: def('psyshock', 'heavy', 'psychic', 80, [260, 60, 370], shot(200, 9, 2000), 420, 50),
  reflect: def('reflect', 'boost', 'psychic', 0, [200, 60, 240], SELF, 0, 0, { cooldownMs: 16000, buff: { kind: 'guard', damageTaken: 0.5, durationMs: 5000 } }),
  psybeam: def('psybeam', 'area', 'psychic', 65, [400, 60, 360], shot(280, 10, 520, { wave: true }), 340, 40, { staminaCost: 35, cooldownMs: 6000 }),
  'future-sight': def('future-sight', 'area', 'psychic', 120, [660, 140, 440], arc(70, 360), 480, 80, { staminaCost: 45, cooldownMs: 7600 }),
  // --- Piplup's line ---
  'aqua-jet': def('aqua-jet', 'fast', 'water', 40, [40, 120, 200], dash(64, 16), 200, 30),
  'metal-claw': def('metal-claw', 'fast', 'steel', 50, [90, 80, 170], arc(32, 100), 220, 25),
  'flash-cannon': def('flash-cannon', 'heavy', 'steel', 80, [280, 60, 380], shot(200, 10, 2000), 380, 50),
  'hydro-pump': def('hydro-pump', 'heavy', 'water', 110, [480, 60, 190], shot(170, 13, 2400), 460, 90, { staminaCost: 40, juice: 'heavy' }),
  // --- Shinx's line ---
  'thunder-fang': def('thunder-fang', 'fast', 'electric', 65, [100, 80, 200], arc(30, 90), 320, 30),
  'ice-fang': def('ice-fang', 'fast', 'ice', 65, [100, 80, 200], arc(30, 90), 320, 30),
  'fire-fang': def('fire-fang', 'fast', 'fire', 65, [100, 80, 200], arc(30, 90), 260, 30, { dot: 'burn', dotChance: 0.3 }),
  crunch: def('crunch', 'heavy', 'dark', 80, [260, 100, 340], arc(40, 90), 420, 60),
  'wild-charge': def('wild-charge', 'heavy', 'electric', 120, [300, 180, 280], dash(84, 17), 460, 90, { staminaCost: 35, recoil: 0.25, juice: 'heavy' }),
  charge: def('charge', 'boost', 'electric', 0, CAST, SELF, 0, 0, { cooldownMs: 14000, buff: { kind: 'power', multiplier: 1.5, hits: 2, durationMs: 8000 } }),
  howl: def('howl', 'boost', 'normal', 0, CAST, SELF, 0, 0, { cooldownMs: 14000, buff: { kind: 'power', multiplier: 1.25, hits: 3, durationMs: 8000 } }),
  discharge: def('discharge', 'area', 'electric', 80, [300, 120, 380], arc(64, 360), 400, 60, { staminaCost: 35, cooldownMs: 7000 }),
  electroweb: def('electroweb', 'area', 'electric', 55, [280, 120, 360], arc(66, 110), 420, 40, { staminaCost: 35, cooldownMs: 6000 }),
  // --- Axew's line ---
  outrage: def('outrage', 'heavy', 'dragon', 120, [280, 140, 300], arc(46, 140), 460, 90, { staminaCost: 40, cooldownMs: 780, juice: 'heavy' }),
  'dragon-dance': def('dragon-dance', 'boost', 'dragon', 0, CAST, SELF, 0, 0, { cooldownMs: 14000, buff: { kind: 'haste', speed: 1.25, critChance: 0.15, durationMs: 6000 } }),
};
