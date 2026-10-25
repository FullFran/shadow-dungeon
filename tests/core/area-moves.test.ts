import { describe, expect, it } from 'vitest';
import { isHeavyHit } from '../../src/adapters/juice';
import { playerVfx } from '../../src/adapters/move-vfx';
import { soundFor } from '../../src/adapters/audio';
import type { GameEvent, PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec, type Vec2 } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { MOVES, type MoveId } from '../../src/data/moves';
import { PLAYABLE_SPECIES, SPECIES, type SpeciesId } from '../../src/data/species';
import { TUNING } from '../../src/data/tuning';
import { catalog } from '../../src/i18n';
import { IDLE } from './helpers';

const AREA_NAMES: Record<string, string> = {
  'dazzling-gleam': 'Brillo Mágico',
  'shadow-force': 'Golpe Umbrío',
  'dark-pulse': 'Pulso Umbrío',
  snarl: 'Alarido',
  flamethrower: 'Lanzallamas',
  'heat-wave': 'Onda Ígnea',
  earthquake: 'Terremoto',
  bulldoze: 'Terratemblor',
};

/** A starter with `area` in its area slot, facing east, with tough dormant Gastlys at `at`. */
function arena(species: SpeciesId, area: MoveId, at: Vec2[]): WorldState {
  const base = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300), species });
  const loadout = [...SPECIES[species].defaultLoadout.slice(0, 3), area];
  let w: WorldState = { ...base, player: { ...base.player, loadout, facing: vec(1, 0), disguiseBroken: true, illusionBroken: true } };
  for (const pos of at) w = spawnEnemy(w, 'gastly', pos, { dormant: true });
  return { ...w, enemies: w.enemies.map((e) => ({ ...e, hp: 9999, maxHp: 9999 })) };
}

function runFor(state: WorldState, ms: number, input: PlayerInput = IDLE): { state: WorldState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.ceil(ms / FIXED_DT_MS); i++) {
    current = step(current, input, FIXED_DT_MS);
    events.push(...current.events);
  }
  return { state: current, events };
}

const pressArea: PlayerInput = { ...IDLE, aim: vec(600, 300), slots: [false, false, false, true], slotMouse: [false, false, false, false] };

/** Presses the area slot once and plays out the move (and its projectile). */
function useArea(state: WorldState, extraMs = 0): { state: WorldState; events: GameEvent[]; hit: Set<string> } {
  const id = state.player.loadout[3]!;
  const m = MOVES[id];
  const pressed = runFor(state, FIXED_DT_MS, pressArea);
  const after = runFor(pressed.state, m.windupMs + m.activeMs + m.recoveryMs + extraMs + 3 * FIXED_DT_MS);
  const events = [...pressed.events, ...after.events];
  return { state: after.state, events, hit: new Set(events.flatMap((e) => (e.type === 'enemyHit' ? [e.enemyId] : []))) };
}

const areaMoves = (id: SpeciesId) => SPECIES[id].movepool.filter((m) => MOVES[m].slot === 'area');

describe('area moves: data', () => {
  it.each(PLAYABLE_SPECIES)('%s has two area moves, slow and costly, with heavy juice and one equipped by default', (id) => {
    const moves = areaMoves(id);
    expect(moves).toHaveLength(2);
    for (const m of moves) {
      const move = MOVES[m];
      expect(move.cooldownMs, m).toBeGreaterThanOrEqual(5000);
      expect(move.staminaCost, m).toBeGreaterThanOrEqual(30);
      expect(move.juice, m).toBe('heavy');
      expect(move.charge, m).toBeUndefined();
      expect(move.windupMs, m).toBeGreaterThanOrEqual(220);
    }
    expect(moves).toContain(SPECIES[id].defaultLoadout[3]);
  });

  it('use the official Spanish move names', () => {
    const es = catalog('es');
    for (const [id, name] of Object.entries(AREA_NAMES)) expect(es[`move.${id}`], id).toBe(name);
    expect(PLAYABLE_SPECIES.flatMap(areaMoves).sort()).toEqual(Object.keys(AREA_NAMES).sort());
  });
});

describe('area moves: shapes', () => {
  it('a ring (Brillo Mágico, Pulso Umbrío, Terremoto, Terratemblor) hits all around, behind included', () => {
    for (const [species, move] of [['mimikyu', 'dazzling-gleam'], ['zorua', 'dark-pulse'], ['cubone', 'earthquake'], ['cubone', 'bulldoze']] as const) {
      const { hit } = useArea(arena(species, move, [vec(440, 300), vec(360, 300), vec(400, 340)]));
      expect(hit.size, move).toBe(3);
    }
  });

  it('a cone (Golpe Umbrío, Alarido, Onda Ígnea) hits a spread in front, never behind', () => {
    for (const [species, move] of [['mimikyu', 'shadow-force'], ['zorua', 'snarl'], ['litwick', 'heat-wave']] as const) {
      const { hit, state } = useArea(arena(species, move, [vec(450, 280), vec(450, 320), vec(340, 300)]));
      const [a, b, behind] = state.enemies.map((e) => e.id);
      expect(hit.has(a!) && hit.has(b!), move).toBe(true);
      expect(hit.has(behind!), move).toBe(false);
    }
  });

  it('a line wave (Lanzallamas) goes through every enemy in the line and does not come back', () => {
    const { hit, state } = useArea(arena('litwick', 'flamethrower', [vec(440, 300), vec(490, 300), vec(330, 300)]), 600);
    const [near, far, behind] = state.enemies.map((e) => e.id);
    expect(hit.has(near!) && hit.has(far!)).toBe(true);
    expect(hit.has(behind!)).toBe(false);
    expect(state.projectiles).toEqual([]);
  });
});

describe('area moves: cost', () => {
  it('pay stamina and start a cooldown; a second press before it runs out is denied', () => {
    const first = useArea(arena('cubone', 'earthquake', []));
    expect(first.state.player.stamina).toBeLessThan(TUNING.stamina.max);
    const again = useArea(first.state);
    expect(again.events.some((e) => e.type === 'moveDenied' && e.moveId === 'earthquake')).toBe(true);
  });

  it('land with heavy juice, sound their own whoosh and draw in their type colour mid-active', () => {
    const { events } = useArea(arena('zorua', 'dark-pulse', [vec(440, 300)]));
    const hit = events.find((e) => e.type === 'enemyHit');
    expect(hit?.type === 'enemyHit' && isHeavyHit(hit)).toBe(true);
    expect(soundFor({ type: 'moveStarted', moveId: 'dark-pulse', slotIndex: 3 })).toBe('area');
    const action = { slotIndex: 3, moveId: 'heat-wave' as const, phase: 'active' as const, phaseMs: 40, chargeMs: 0, chargeLevel: 0, aimDir: vec(1, 0), mouseAim: false, hitIds: [] };
    expect(playerVfx({ items: [], level: 1, action })).toMatchObject([{ kind: 'arc', type: 'fire' }]);
  });
});
