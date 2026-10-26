import { describe, expect, it } from 'vitest';
import { echoMimic } from '../../src/core/eclipse-echo';
import { startRun } from '../../src/core/run';
import type { WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { enemyAnim } from '../../src/adapters/sprite-anim';
import { PLAYABLE_SPECIES, SPECIES } from '../../src/data/species';
import { SPRITE_KEYS, SPRITES } from '../../src/data/sprites';
import { input } from './helpers';

/** The personal Sima echo (odd/tasks/shiny-echo.md B): a corrupted copy of the player, alternating in co-op. */
describe('the echo copies a player', () => {
  it('solo: always the player own species (its current form)', () => {
    for (const species of PLAYABLE_SPECIES) for (const floor of [10, 20, 30, 70]) expect(echoMimic(floor, [{ id: 'p1', species }])).toBe(species);
  });

  it('co-op: alternates among the party by echo encounter, over the player ids sorted, whatever order they come in', () => {
    const party = [
      { id: 'p3', species: 'abra' as const },
      { id: 'p1', species: 'zorua' as const },
      { id: 'p2', species: 'cubone' as const },
    ];
    expect([10, 20, 30, 40, 50].map((f) => echoMimic(f, party))).toEqual(['zorua', 'cubone', 'abra', 'zorua', 'cubone']);
    expect([10, 20, 30].map((f) => echoMimic(f, [...party].reverse()))).toEqual(['zorua', 'cubone', 'abra']);
  });

  it('nobody to copy: none (the plain Eco del Eclipse)', () => {
    expect(echoMimic(10, [])).toBeNull();
  });
});

describe('every playable species renders as the echo', () => {
  const { world } = startRun(7, {}, 10, 'eclipse-chasm');
  const echo = world.enemies.find((e) => e.species === 'eclipse-echo')!;
  const modes = ['idle', 'approach', 'telegraph', 'attack', 'recover'] as const;

  for (const species of PLAYABLE_SPECIES) {
    it(species, () => {
      const key = SPRITE_KEYS[SPECIES[species].sprite];
      const poses = [
        ...modes.map((mode) => ({ ...echo, ai: { ...echo.ai, mode, modeMs: 100, modeDurationMs: 400 } })),
        { ...echo, hitstunMs: 100 },
        { ...echo, alive: false },
      ];
      for (const pose of poses) {
        const choice = enemyAnim(pose, { timeMs: 200, sinceDefeatMs: 50, echoMimic: species });
        expect(choice.sprite, `${species} ${pose.ai.mode}`).toBe(key);
        expect(SPRITES.sprites[choice.sprite]?.anims[choice.anim], `${species} ${choice.anim}`).toBeDefined();
      }
    });
  }
});

describe('the echo fights the same whoever it copies', () => {
  it('its cards, shots and damage do not depend on the species it wears', () => {
    const play = (mimic: (typeof PLAYABLE_SPECIES)[number]) => {
      let world: WorldState = { ...startRun(7, {}, 20, 'eclipse-chasm').world, echoMimic: mimic };
      for (let tick = 0; tick < 900; tick++) world = step(world, input({ move: vec(Math.cos(tick / 25), Math.sin(tick / 40)) }), FIXED_DT_MS);
      const { echoMimic: _drop, ...rest } = world;
      return rest;
    };
    const base = play('mimikyu');
    expect(base.projectiles.length + base.player.hp).toBeGreaterThan(0);
    for (const species of PLAYABLE_SPECIES.slice(1)) expect(play(species), species).toEqual(base);
  });
});
