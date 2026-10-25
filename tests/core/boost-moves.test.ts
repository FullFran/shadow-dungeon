import { describe, expect, it } from 'vitest';
import { landHitOnPlayer } from '../../src/core/hits';
import type { GameEvent, PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { MOVES, type MoveId } from '../../src/data/moves';
import { PLAYABLE_SPECIES, SPECIES, type SpeciesId } from '../../src/data/species';
import { TUNING } from '../../src/data/tuning';
import { catalog } from '../../src/i18n';
import { IDLE } from './helpers';

const world = (species: SpeciesId): WorldState => {
  const w = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300), species });
  // No passive in the way (Disguise, Illusion's first-hit crit).
  return { ...w, player: { ...w.player, disguiseBroken: true, illusionBroken: true } };
};

function runFor(state: WorldState, ms: number, input: PlayerInput = IDLE): { state: WorldState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.ceil(ms / FIXED_DT_MS); i++) {
    current = step(current, input, FIXED_DT_MS);
    events.push(...current.events);
  }
  return { state: current, events };
}

const press = (slot: number, aim = vec(600, 300)): PlayerInput => ({ ...IDLE, aim, slots: [0, 1, 2, 3].map((i) => i === slot), slotMouse: [0, 1, 2, 3].map((i) => i === slot && i < 2) });
const moveTime = (id: MoveId) => MOVES[id].windupMs + MOVES[id].activeMs + MOVES[id].recoveryMs;

/** Presses `slot` once and waits for the move to finish. */
function use(state: WorldState, slot: number, aim?: { x: number; y: number }): { state: WorldState; events: GameEvent[] } {
  const id = state.player.loadout[slot]!;
  const pressed = runFor(state, FIXED_DT_MS, press(slot, aim));
  const after = runFor(pressed.state, moveTime(id) + 3 * FIXED_DT_MS, { ...IDLE, aim: aim ?? vec(600, 300) });
  return { state: after.state, events: [...pressed.events, ...after.events] };
}

/** Damage of one fast-slot swing at a fresh dormant Gastly right in front. */
function swingDamage(state: WorldState): { state: WorldState; damage: number } {
  const spawned = spawnEnemy({ ...state, enemies: [] }, 'gastly', vec(424, 300), { dormant: true });
  // Too tough to fall: no XP, so no level-up changes the damage between swings.
  const target = { ...spawned, enemies: spawned.enemies.map((e) => ({ ...e, hp: 9999, maxHp: 9999 })) };
  const swung = use(target, 0, vec(424, 300));
  const hit = swung.events.find((e) => e.type === 'enemyHit');
  if (hit?.type !== 'enemyHit') throw new Error('no hit');
  return { state: { ...swung.state, enemies: [] }, damage: hit.damage };
}

describe('boost moves: data', () => {
  it.each(PLAYABLE_SPECIES)('%s has one boost move on a cooldown, without stamina, equipped by default', (id) => {
    const boosts = SPECIES[id].movepool.filter((m) => MOVES[m].slot === 'boost');
    expect(boosts).toHaveLength(1);
    const move = MOVES[boosts[0]!];
    expect(move.hitbox.kind).toBe('self');
    expect(move.staminaCost).toBe(0);
    expect(move.cooldownMs).toBeGreaterThanOrEqual(10000);
    expect(move.buff).toBeDefined();
    expect(SPECIES[id].defaultLoadout[2]).toBe(boosts[0]);
  });

  it('use the official Spanish move names', () => {
    const es = catalog('es');
    expect(['swords-dance', 'nasty-plot', 'will-o-wisp', 'bulk-up'].map((id) => es[`move.${id}`])).toEqual(['Danza Espada', 'Maquinación', 'Fuego Fatuo', 'Corpulencia']);
  });
});

describe('boost moves: cooldown', () => {
  it('starts on use; pressing again before it runs out is denied, after it the move works again', () => {
    const cast = use(world('mimikyu'), 2);
    expect(cast.events.some((e) => e.type === 'moveStarted' && e.moveId === 'swords-dance')).toBe(true);
    const again = use(cast.state, 2);
    expect(again.events.some((e) => e.type === 'moveDenied' && e.moveId === 'swords-dance')).toBe(true);
    expect(again.events.some((e) => e.type === 'moveStarted')).toBe(false);
    const rested = runFor(again.state, MOVES['swords-dance'].cooldownMs!).state;
    expect(rested.player.cooldowns?.['swords-dance']).toBeUndefined();
    expect(use(rested, 2).events.some((e) => e.type === 'moveStarted' && e.moveId === 'swords-dance')).toBe(true);
  });

  it('a fresh player has no cooldowns and no buff fields at all (same state as before four-slots)', () => {
    const w = world('cubone');
    expect(w.player).not.toHaveProperty('cooldowns');
    expect(w.player).not.toHaveProperty('buff');
  });
});

describe('boost moves: effects', () => {
  it('Danza Espada: the next three hits deal more damage, the fourth is back to normal', () => {
    const base = swingDamage(world('mimikyu')).damage;
    let state = use(world('mimikyu'), 2).state;
    const buff = MOVES['swords-dance'].buff!;
    if (buff.kind !== 'power') throw new Error('power buff expected');
    const damages: number[] = [];
    for (let i = 0; i < buff.hits + 1; i++) {
      const swung = swingDamage(state);
      damages.push(swung.damage);
      state = swung.state;
    }
    for (const d of damages.slice(0, buff.hits)) expect(d).toBeGreaterThan(base);
    expect(damages.at(-1)).toBe(base);
    expect(state.player.buff).toBeUndefined();
  });

  it('Maquinación: Zorua runs faster for a while, then the buff ends', () => {
    const walk = { ...IDLE, move: vec(1, 0) };
    const plain = runFor(world('zorua'), 500, walk).state.player.pos.x;
    const cast = use(world('zorua'), 2).state;
    const start = cast.player.pos.x;
    const hasted = runFor(cast, 500, walk).state;
    expect(hasted.player.pos.x - start).toBeGreaterThan(plain - 400 + 1);
    const buff = MOVES['nasty-plot'].buff!;
    if (buff.kind !== 'haste') throw new Error('haste expected');
    expect(buff.critChance).toBeGreaterThan(0);
    expect(runFor(hasted, buff.durationMs).state.player.buff).toBeUndefined();
  });

  it('Fuego Fatuo: Litwick kindles Flash Fire at once (the next heavy move is powered up)', () => {
    expect(world('litwick').player.flashFire).toBe(false);
    expect(use(world('litwick'), 2).state.player.flashFire).toBe(true);
  });

  it('Corpulencia: Cubone takes less damage while it lasts', () => {
    const events: GameEvent[] = [];
    const plain = world('cubone');
    const guarded = use(plain, 2).state;
    const before = landHitOnPlayer(plain, { damage: 20 }, events).state.player.hp;
    const after = landHitOnPlayer(guarded, { damage: 20 }, events).state.player.hp;
    expect(plain.player.hp - before).toBe(20);
    expect(guarded.player.hp - after).toBeLessThan(20);
    expect(guarded.player.hp - after).toBeGreaterThan(0);
  });

  it('every boost shows itself: a buffStarted event when it takes hold', () => {
    for (const id of PLAYABLE_SPECIES) {
      const { events } = use(world(id), 2);
      expect(events.some((e) => e.type === 'buffStarted' && e.moveId === SPECIES[id].defaultLoadout[2]), id).toBe(true);
    }
  });

  it('a boost costs no stamina', () => {
    const state = use(world('zorua'), 2).state;
    expect(state.player.stamina).toBe(TUNING.stamina.max);
  });
});
