import { describe, expect, it } from 'vitest';
import type { ItemId } from '../../src/data/items';
import type { MoveId } from '../../src/data/moves';
import type { SpeciesId } from '../../src/data/species';
import { FULL_BUILD, MAX_RANK } from '../../src/data/tutor';
import type { StarterId } from '../../src/data/learnsets';
import { CARD_BOSSES } from '../../src/sim/prove';
import { tankFight } from '../../src/sim/tank';

/**
 * Degenerate builds (odd/tasks/degenerate-builds.md): the tank bot
 * (src/sim/tank.ts) never dodges and face-tanks a Nightmare boss's first
 * card, held forever (its timer never ends it, its HP never drops), with a
 * full-investment build (FULL_BUILD, every move at rank +2). Every such
 * build without items dies within about 106 s; a build that is still
 * standing after `TANK_DEATH_MS` out-heals the card, which is immortality.
 */
const TANK_DEATH_MS = 150_000;
const LONG_MS = TANK_DEATH_MS + 30_000;

const ranked = (moves: readonly (MoveId | null)[]): Partial<Record<MoveId, number>> =>
  Object.fromEntries(moves.filter((m): m is MoveId => m !== null).map((m) => [m, MAX_RANK]));
const boss = (species: SpeciesId) => CARD_BOSSES.find((c) => c.species === species)!;
const full = (starter: StarterId, items: readonly ItemId[]) => ({ species: starter, loadout: FULL_BUILD[starter], moveRanks: ranked(FULL_BUILD[starter]), items });

describe('degenerate builds: face-tanking a Nightmare card is still lethal', () => {
  // The worst cases of the audit with two Shell Bells (each one was still alive after 180 s before the bell's cap).
  const BELL_CASES: readonly [StarterId, SpeciesId][] = [
    ['zorua', 'aegislash'],
    ['litwick', 'decidueye'],
    ['cubone', 'salazzle'],
  ];
  for (const [starter, species] of BELL_CASES) {
    it(`Shell Bell ×2: ${starter} full ++ face-tanking ${species} dies within ${TANK_DEATH_MS / 1000} s`, () => {
      const r = tankFight(boss(species), 'nightmare', full(starter, ['shell-bell', 'shell-bell']), LONG_MS, 1, 0);
      expect(r.outcome).toBe('died');
      expect(r.ms).toBeLessThanOrEqual(TANK_DEATH_MS);
    });
  }
});
