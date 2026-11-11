import { describe, expect, it } from 'vitest';
import { applyDot } from '../../src/core/afflictions';
import type { EnemyState, GameEvent, WorldState } from '../../src/core/state';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { updateToxic } from '../../src/core/toxic';
import { vec } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { DOT_IMMUNE_TYPES, DOTS, type DotKind } from '../../src/data/moves';
import { SPECIES, type SpeciesId } from '../../src/data/species';

/**
 * Issue #61 (from ticket SD-FFUTM7): as in the main series, Poison and Steel
 * types are never poisoned and Fire types are never burned. The hit itself
 * still lands; only the status does not stick.
 */
const KINDS = Object.keys(DOTS) as DotKind[];

function enemyOf(species: SpeciesId): EnemyState {
  const world = spawnEnemy(createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(40, 40) }), species, vec(400, 300));
  return world.enemies[0]!;
}

describe('status immunity by type (#61)', () => {
  it('names the main-series immunities', () => {
    expect(DOT_IMMUNE_TYPES).toEqual({ burn: ['fire'], poison: ['poison', 'steel'] });
  });

  it('every species keeps a burn or poison unless one of its types is immune to it', () => {
    for (const species of Object.keys(SPECIES) as SpeciesId[]) {
      const enemy = enemyOf(species);
      for (const kind of KINDS) {
        const immune = enemy.types.some((t) => DOT_IMMUNE_TYPES[kind].includes(t));
        const after = applyDot(enemy, kind, 40);
        expect(after.dot === undefined, `${kind} on ${species} (${enemy.types.join('/')})`).toBe(immune);
      }
    }
  });

  it('a Poison or Steel player is not poisoned by wading in a toxic pool; others still are', () => {
    const world = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300) });
    const pool = { x: 400, y: 300, radius: 40 };
    const wading = (types: WorldState['player']['types']): WorldState => ({ ...world, pools: [pool], player: { ...world.player, types } });
    for (const types of [['poison'], ['steel'], ['ghost', 'steel']] as const) {
      const events: GameEvent[] = [];
      const after = updateToxic(wading(types), FIXED_DT_MS, events);
      expect(after.player.poison, types.join('/')).toBeUndefined();
      expect(events.some((e) => e.type === 'poisoned')).toBe(false);
    }
    const events: GameEvent[] = [];
    expect(updateToxic(wading(['ghost']), FIXED_DT_MS, events).player.poison).toBeDefined();
    expect(events.some((e) => e.type === 'poisoned')).toBe(true);
  });
});
