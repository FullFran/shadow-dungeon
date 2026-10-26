import { describe, expect, it } from 'vitest';
import type { ItemId } from '../../src/data/items';
import type { MoveId } from '../../src/data/moves';
import type { SpeciesId } from '../../src/data/species';
import { FULL_BUILD, MAX_RANK } from '../../src/data/tutor';
import type { StarterId } from '../../src/data/learnsets';
import { CARD_BOSSES } from '../../src/sim/prove';
import { AUDIT_BUILDS, auditBuild, tankFight } from '../../src/sim/tank';

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
/** Super-armor: a ward rests as long as it ran (half the time), plus a tick of rounding. */
const WARD_UPTIME_CEILING = 0.52;
/** Ranked i-frames: the audit's worst build is invulnerable about 20 % of a face-tanked fight. */
const IFRAME_UPTIME_CEILING = 0.25;

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

const build = (id: string) => AUDIT_BUILDS.find((b) => b.id === id)!;
const tankOf = (id: string, items: readonly ItemId[] = []) => {
  const b = build(id);
  return { species: b.species, loadout: b.loadout, moveRanks: ranked(b.loadout), items };
};

describe('degenerate builds: the audit fixes (B2)', () => {
  // Drain heals within its budget: these drain builds out-healed these cards forever before (zorua-iframes 30 of 46 cards bare).
  const DRAIN_CASES: readonly [string, SpeciesId, number][] = [
    ['zorua-iframes', 'aegislash', 0],
    ['zorua-iframes', 'decidueye', 1],
    ['mimikyu-drain', 'sableye', 2],
  ];
  for (const [id, species, card] of DRAIN_CASES) {
    it(`drain budget: ${id} face-tanking ${species} card ${card} dies within ${TANK_DEATH_MS / 1000} s`, () => {
      const r = tankFight(boss(species), 'nightmare', tankOf(id), LONG_MS, 1, card);
      expect(r.outcome).toBe('died');
      expect(r.ms).toBeLessThanOrEqual(TANK_DEATH_MS);
    });
  }

  it('Leftovers: the third stack is gone, so the sustain items heal at most the shared ceiling', () => {
    // Mimikyu face-tanking Dhelmise's second card was immortal with three Leftovers (31 s bare).
    const r = tankFight(boss('dhelmise'), 'nightmare', full('mimikyu', ['leftovers', 'leftovers', 'leftovers', 'shell-bell', 'shell-bell']), LONG_MS, 1, 1);
    expect(r.outcome).toBe('died');
    expect(r.ms).toBeLessThanOrEqual(TANK_DEATH_MS);
  });

  // Super-armor covers at most half the fight (a heavy move's ward was renewed by every swing: 90–99 % uptime).
  for (const id of ['mimikyu-full', 'cubone-armor', 'litwick-armor']) {
    it(`super-armor uptime: ${id} stays at most half the fight under a ward`, () => {
      const r = tankFight(boss('aegislash'), 'nightmare', tankOf(id), 60_000, 1, 0);
      expect(r.wardShare).toBeGreaterThan(0.2);
      expect(r.wardShare).toBeLessThanOrEqual(WARD_UPTIME_CEILING);
    });
  }

  // I-frames from ranked moves (Sombra Vil +2, Excavar +1, Golpe Bajo +1, Derribo +2...) never chain into near-permanent invulnerability.
  for (const id of ['mimikyu-iframes', 'cubone-iframes', 'litwick-armor']) {
    it(`i-frame uptime: ${id} is invulnerable at most ${IFRAME_UPTIME_CEILING * 100} % of the fight`, () => {
      const r = tankFight(boss('aegislash'), 'nightmare', tankOf(id), 60_000, 1, 0);
      expect(r.iframeShare).toBeGreaterThan(0);
      expect(r.iframeShare).toBeLessThanOrEqual(IFRAME_UPTIME_CEILING);
    });
  }
});

describe('degenerate builds: no ranked build out-heals a lethal card bare', () => {
  // The audit's worst bare builds (drain moves, Bulk Up ++ healing, Foul Play ++ drain): at most one card that kills the
  // bare, unranked default kit within a minute may become one the build holds forever (zorua-iframes held 30 of 46 cards before).
  for (const id of ['mimikyu-drain', 'zorua-iframes', 'cubone-kit']) {
    it(`${id} flips at most one fast card`, () => {
      expect(auditBuild(build(id)).flipped).toBeLessThanOrEqual(1);
    }, 120_000);
  }
});
