import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { simaSceneDue, type SimaFloorScenes } from '../../src/app/sima-scene-due';

/**
 * When the Sima's own scenes play on a floor (odd/tasks/shrine-fog.md T2):
 * a boss's scene (the first herald, its own shadow) once the fog is crossed;
 * the lost shadow's on arrival in the antechamber, before the player decides
 * whether to cross (its text speaks to the undecided player); a stratum's on arrival.
 */
const floor = (over: Partial<SimaFloorScenes>): SimaFloorScenes => ({ stratum: null, herald: false, ownShadow: false, stray: null, fogged: true, ...over });

describe('Sima scene timing', () => {
  it("the lost shadow's scene plays on arrival at its antechamber, never after crossing", () => {
    expect(simaSceneDue('entry', floor({ stray: 'someone' }))).toBe('someone');
    expect(simaSceneDue('entry', floor({ stray: 'someone-known' }))).toBe('someone-known');
    expect(simaSceneDue('crossed', floor({ stray: 'someone', fogged: false }))).toBeNull();
  });

  it("the first herald's and the own shadow's scenes wait for the crossing", () => {
    expect(simaSceneDue('entry', floor({ herald: true }))).toBeNull();
    expect(simaSceneDue('crossed', floor({ herald: true, fogged: false }))).toBe('first-name');
    expect(simaSceneDue('entry', floor({ ownShadow: false }))).toBeNull();
    // Behind the fog the Eco is not in the room yet; once crossed it is.
    expect(simaSceneDue('crossed', floor({ ownShadow: true, fogged: false }))).toBe('own-shadow');
  });

  it("a stratum's threshold plays on arrival, first", () => {
    expect(simaSceneDue('entry', floor({ stratum: 'stratum-forest', stray: 'someone' }))).toBe('stratum-forest');
    expect(simaSceneDue('crossed', floor({ stratum: 'stratum-forest', fogged: false }))).toBeNull();
  });

  it('a floor without fog plays everything on arrival, in the old order', () => {
    expect(simaSceneDue('entry', floor({ fogged: false, herald: true, stratum: 'stratum-forest' }))).toBe('first-name');
    expect(simaSceneDue('entry', floor({ fogged: false, ownShadow: true }))).toBe('own-shadow');
    expect(simaSceneDue('entry', floor({ fogged: false, stray: 'someone' }))).toBe('someone');
    expect(simaSceneDue('entry', floor({ fogged: false }))).toBeNull();
  });
});

describe('the game uses this timing', () => {
  it('simaMoment asks simaSceneDue, on arrival and after the crossing', () => {
    const game = readFileSync(join(__dirname, '../../src/app/game.ts'), 'utf8');
    expect(game).toContain('simaSceneDue(phase, {');
    expect(game).toContain("simaMoment('entry',");
    expect(game).toContain("simaMoment('crossed',");
  });
});
