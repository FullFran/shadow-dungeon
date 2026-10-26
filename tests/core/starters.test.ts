import { describe, expect, it } from 'vitest';
import { wakeEnemies } from '../../src/core/activation';
import { computeDamage } from '../../src/core/damage';
import { validateLoadout } from '../../src/core/loadout';
import type { PlayerInput, WorldState } from '../../src/core/state';
import { hitPlayer, step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec, type Vec2 } from '../../src/core/vec';
import { createWorld, enterRoom, spawnEnemy } from '../../src/core/world';
import { ITEM_EFFECTS } from '../../src/data/items';
import { MOVES, type MoveId } from '../../src/data/moves';
import { PLAYER_SLOT_LAYOUT } from '../../src/data/slots';
import { PLAYABLE_SPECIES, SPECIES, type SpeciesId, originalKit } from '../../src/data/species';
import { TUNING } from '../../src/data/tuning';
import { ticksFor } from './helpers';

const PLAYER = vec(400, 300);
const RIGHT = vec(600, 300);

function arena(species: SpeciesId, loadout: [MoveId, MoveId], enemies: [SpeciesId, Vec2][] = []): WorldState {
  let state = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: PLAYER, species, loadout });
  for (const [enemy, pos] of enemies) state = spawnEnemy(state, enemy, pos, { dormant: true });
  return state;
}

const held = (slots: boolean[], aim = RIGHT): PlayerInput => ({
  move: vec(0, 0),
  aim,
  roll: false,
  slots,
  slotMouse: slots,
  lock: false,
  click: false,
  wheel: 0,
  view: { x: 0, y: 0, width: 800, height: 600 },
});

function advance(state: WorldState, playerInput: PlayerInput, ms: number) {
  let current = state;
  const events: WorldState['events'] = [];
  for (let i = 0; i < ticksFor(ms); i++) {
    current = step(current, playerInput, FIXED_DT_MS);
    events.push(...current.events);
  }
  return { state: current, events };
}

function use(state: WorldState, slot: number, holdMs: number, afterMs: number, aim = RIGHT) {
  const pressed = [false, false];
  pressed[slot] = true;
  const a = advance(state, held(pressed, aim), Math.max(holdMs, FIXED_DT_MS));
  const b = advance(a.state, held([false, false], aim), afterMs);
  return { state: b.state, events: [...a.events, ...b.events] };
}

const totalMs = (id: MoveId) => MOVES[id].windupMs + MOVES[id].activeMs + MOVES[id].recoveryMs;
const hitDamages = (events: WorldState['events']) => events.flatMap((e) => (e.type === 'enemyHit' ? [e.damage] : []));
const plain = (power: number, moveType: MoveId, species: SpeciesId, enemy: SpeciesId, multiplier = 1) =>
  computeDamage({ power, moveType: MOVES[moveType].type, attackerTypes: SPECIES[species].types, defenderTypes: SPECIES[enemy].types, multiplier }).damage;

describe('starter species data', () => {
  it('lists Mimikyu and the three starters as playable', () => {
    expect(PLAYABLE_SPECIES).toEqual(['mimikyu', 'zorua', 'litwick', 'cubone']);
  });

  it.each(PLAYABLE_SPECIES)('%s has two fast and two heavy moves, a valid default loadout and a passive', (id) => {
    const species = SPECIES[id];
    const kinds = originalKit(species.id).map((m) => MOVES[m].slot);
    expect(kinds.filter((k) => k === 'fast')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'heavy')).toHaveLength(2);
    expect(validateLoadout(species, PLAYER_SLOT_LAYOUT, species.defaultLoadout)).toEqual([]);
    expect(species.passive).toBeDefined();
  });

  it('starts the player with its species base HP', () => {
    expect(arena('cubone', ['bone-club', 'bonemerang']).player.maxHp).toBe(SPECIES.cubone.maxHp);
    expect(arena('litwick', ['ember', 'hex']).player.hp).toBe(SPECIES.litwick.maxHp);
  });

  it('gives Litwick a ranged option in both slots', () => {
    const ranged = originalKit('litwick').filter((m) => MOVES[m].hitbox.kind === 'projectile').map((m) => MOVES[m].slot);
    expect(ranged).toContain('fast');
    expect(ranged).toContain('heavy');
  });
});

describe('Illusion (Zorua)', () => {
  const ROOM = { x: 300, y: 200, width: 200, height: 200 };
  const sleeping = (playerPos: Vec2, enemyPos: Vec2): WorldState => {
    const base = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos, species: 'zorua' });
    return spawnEnemy(base, 'poochyena', enemyPos, { sleepIn: ROOM });
  };

  it('does not wake enemies when Zorua walks into their room', () => {
    expect(wakeEnemies(sleeping(vec(400, 300), vec(460, 300))).enemies[0]!.ai.mode).toBe('asleep');
  });

  it('wakes an enemy that Zorua touches', () => {
    expect(wakeEnemies(sleeping(vec(400, 300), vec(415, 300))).enemies[0]!.ai.mode).not.toBe('asleep');
  });

  it('wakes them once the illusion is broken, and Mimikyu always wakes them', () => {
    const broken = sleeping(vec(400, 300), vec(460, 300));
    expect(wakeEnemies({ ...broken, player: { ...broken.player, illusionBroken: true } }).enemies[0]!.ai.mode).not.toBe('asleep');
    const mimikyu = spawnEnemy(createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300) }), 'poochyena', vec(460, 300), { sleepIn: ROOM });
    expect(wakeEnemies(mimikyu).enemies[0]!.ai.mode).not.toBe('asleep');
  });

  it('makes the first hit from Illusion a critical hit, then breaks', () => {
    const start = arena('zorua', ['feint-attack', 'foul-play'], [['gastly', vec(440, 300)]]);
    const first = use(start, 0, FIXED_DT_MS, totalMs('feint-attack') + 50);
    const base = plain(MOVES['feint-attack'].power, 'feint-attack', 'zorua', 'gastly');
    const crit = plain(MOVES['feint-attack'].power, 'feint-attack', 'zorua', 'gastly', ITEM_EFFECTS.critMultiplier);
    expect(hitDamages(first.events)).toEqual([crit]);
    expect(first.state.player.illusionBroken).toBe(true);
    expect(first.events).toContainEqual({ type: 'passiveTriggered', passive: 'illusion' });
    const back = { ...first.state, player: { ...first.state.player, pos: PLAYER }, enemies: first.state.enemies.map((e) => ({ ...e, pos: vec(440, 300), hitstunMs: 0, knockback: vec(0, 0) })) };
    expect(hitDamages(use(back, 0, FIXED_DT_MS, totalMs('feint-attack') + 50).events)).toEqual([base]);
  });

  it('breaks when Zorua is hurt and comes back in the next room', () => {
    const hurt = hitPlayer(arena('zorua', ['feint-attack', 'foul-play']), { damage: 10 });
    expect(hurt.player.illusionBroken).toBe(true);
    expect(enterRoom(hurt).player.illusionBroken).toBe(false);
  });
});

describe('Flash Fire (Litwick)', () => {
  const litwick = () => arena('litwick', ['ember', 'hex'], [['poochyena', vec(460, 300)]]);

  it('absorbs a Fire hit: no damage, a small heal and a powered-up next heavy', () => {
    const start = litwick();
    const wounded = { ...start, player: { ...start.player, hp: 50 } };
    const after = hitPlayer(wounded, { damage: 20, type: 'fire' });
    expect(after.player.hp).toBe(50 + 20 * TUNING.passives.flashFireHeal);
    expect(after.player.flashFire).toBe(true);
    expect(after.events).toContainEqual({ type: 'passiveTriggered', passive: 'flash-fire' });
  });

  it('takes other types as usual', () => {
    expect(hitPlayer(litwick(), { damage: 20, type: 'ghost' }).player.hp).toBe(SPECIES.litwick.maxHp - 20);
    expect(hitPlayer(litwick(), { damage: 20 }).player.flashFire).toBe(false);
  });

  it('powers up the next heavy move once', () => {
    const boosted = { ...litwick(), player: { ...litwick().player, flashFire: true } };
    const shot = use(boosted, 1, FIXED_DT_MS, totalMs('hex') + 400);
    const base = plain(MOVES.hex.power, 'hex', 'litwick', 'poochyena');
    const powered = plain(MOVES.hex.power, 'hex', 'litwick', 'poochyena', TUNING.passives.flashFireBoost);
    expect(hitDamages(shot.events)).toEqual([powered]);
    expect(shot.state.player.flashFire).toBe(false);
    expect(powered).toBeGreaterThan(base);
  });

  it('a perfect dodge through a Fire attack counts as absorbing it', () => {
    const start = litwick();
    const rolling = { ...start, player: { ...start.player, roll: { elapsedMs: TUNING.roll.iframesStartMs + 10, dir: vec(1, 0) } } };
    const after = hitPlayer(rolling, { damage: 20, type: 'fire' });
    expect(after.events.some((e) => e.type === 'perfectDodge')).toBe(true);
    expect(after.player.flashFire).toBe(true);
  });
});

describe('Battle Armor (Cubone)', () => {
  const winding = (aim: Vec2): WorldState => {
    const start = arena('cubone', ['bone-club', 'stomping-tantrum']);
    return advance(start, held([false, true], aim), 2 * FIXED_DT_MS).state;
  };

  it('halves frontal hits while charging or winding up a heavy move', () => {
    const state = winding(RIGHT);
    expect(state.player.action?.phase).toBe('charging');
    const after = hitPlayer(state, { damage: 20, from: vec(450, 300) });
    expect(after.player.hp).toBe(SPECIES.cubone.maxHp - 10);
    expect(after.player.action).not.toBeNull();
    expect(after.events).toContainEqual({ type: 'passiveTriggered', passive: 'battle-armor' });
  });

  it('does not cover hits from behind or outside a heavy move', () => {
    expect(hitPlayer(winding(RIGHT), { damage: 20, from: vec(350, 300) }).player.hp).toBe(SPECIES.cubone.maxHp - 20);
    const idle = arena('cubone', ['bone-club', 'stomping-tantrum']);
    expect(hitPlayer(idle, { damage: 20, from: vec(450, 300) }).player.hp).toBe(SPECIES.cubone.maxHp - 20);
  });
});

describe('starter move mechanics', () => {
  it('Fury Swipes hits the same enemy several times in one use', () => {
    const start = arena('zorua', ['fury-swipes', 'night-daze'], [['aegislash', vec(430, 300)]]);
    const broken = { ...start, player: { ...start.player, illusionBroken: true } };
    const { events } = use(broken, 0, FIXED_DT_MS, totalMs('fury-swipes') + 50);
    expect(hitDamages(events)).toHaveLength(MOVES['fury-swipes'].multiHit!);
  });

  it('Night Daze hits all around Zorua', () => {
    const start = arena('zorua', ['feint-attack', 'night-daze'], [['poochyena', vec(370, 300)], ['poochyena', vec(430, 300)]]);
    const { events } = use({ ...start, player: { ...start.player, illusionBroken: true } }, 1, FIXED_DT_MS, totalMs('night-daze') + 50);
    expect(hitDamages(events)).toHaveLength(2);
  });

  it('Foul Play deals bonus damage to an enemy caught mid-attack', () => {
    const start = arena('zorua', ['feint-attack', 'foul-play'], [['poochyena', vec(460, 300)]]);
    const base = { ...start, player: { ...start.player, illusionBroken: true } };
    const attacking = { ...base, enemies: base.enemies.map((e) => ({ ...e, ai: { ...e.ai, mode: 'telegraph' as const, modeDurationMs: 60_000 } })) };
    const calm = hitDamages(use(base, 1, FIXED_DT_MS, totalMs('foul-play') + 50).events);
    const punished = hitDamages(use(attacking, 1, FIXED_DT_MS, totalMs('foul-play') + 50).events);
    expect(punished[0]).toBeGreaterThan(calm[0]!);
  });

  it('Hex deals double damage to a staggered enemy', () => {
    const start = arena('litwick', ['ember', 'hex'], [['poochyena', vec(460, 300)]]);
    const staggered = { ...start, enemies: start.enemies.map((e) => ({ ...e, hitstunMs: 5000 })) };
    const calm = hitDamages(use(start, 1, FIXED_DT_MS, totalMs('hex') + 400).events);
    const hexed = hitDamages(use(staggered, 1, FIXED_DT_MS, totalMs('hex') + 400).events);
    expect(hexed[0]).toBe(plain(MOVES.hex.power, 'hex', 'litwick', 'poochyena', 2));
    expect(calm[0]).toBe(plain(MOVES.hex.power, 'hex', 'litwick', 'poochyena'));
  });

  it('Bonemerang flies out and back, hitting on both passes', () => {
    const start = arena('cubone', ['bone-club', 'bonemerang'], [['poochyena', vec(470, 300)]]);
    const { events } = use(start, 1, FIXED_DT_MS, totalMs('bonemerang') + 1500);
    expect(hitDamages(events)).toHaveLength(2);
  });

  it('Stomping Tantrum hits harder after a move that missed', () => {
    const start = arena('cubone', ['bone-club', 'stomping-tantrum'], [['poochyena', vec(430, 300)]]);
    const calm = hitDamages(use(start, 1, FIXED_DT_MS, totalMs('stomping-tantrum') + 50).events);
    const missed = use(start, 0, FIXED_DT_MS, totalMs('bone-club') + 50, vec(200, 300));
    expect(hitDamages(missed.events)).toEqual([]);
    expect(missed.state.player.lastMoveMissed).toBe(true);
    const rage = hitDamages(use(missed.state, 1, FIXED_DT_MS, totalMs('stomping-tantrum') + 50).events);
    expect(rage[0]).toBeGreaterThan(calm[0]!);
  });
});
