import { describe, expect, it } from 'vitest';
import { budgetRatio, costsOf } from '../../src/core/move-power';
import { validateLoadout } from '../../src/core/loadout';
import { DUNGEONS } from '../../src/data/dungeons';
import { lineOf, stageOf } from '../../src/core/evolution';
import { COMPETITIVE_SOURCES, LEARNSETS, type LineId } from '../../src/data/learnsets';
import { LINE_MOVE_IDS } from '../../src/data/line-moves';
import { BASE_MOVE_IDS, MOVES, type MoveId } from '../../src/data/moves';
import { PLAYER_SLOT_LAYOUT } from '../../src/data/slots';
import { originalKit, PLAYABLE_SPECIES, STARTER_SPECIES, SPECIES, type SpeciesId } from '../../src/data/species';
import { GRANDFATHERED, FULL_BUILD, MASTER_MOVES, movePrice, moveTier, RECOMMENDED_BUILD, TIER_BUDGET, TUTOR_OFFER, type MoveTier } from '../../src/data/tutor';
import { TUTOR_MOVE_IDS } from '../../src/data/tutor-moves';

const starters = STARTER_SPECIES;
/** Every line with a movepool (odd/tasks/roster-parity.md): the starters' and the gacha's, by first form. */
const LINES = Object.keys(LEARNSETS) as LineId[];
/** The forms of a line, first to last. */
const formsOf = (line: LineId): SpeciesId[] => PLAYABLE_SPECIES.filter((id) => lineOf(id) === line).sort((a, b) => stageOf(a) - stageOf(b));
/** The last form of a line: it can equip every move of the line. */
const finalOf = (line: LineId): SpeciesId => formsOf(line).at(-1)!;
/** Every move any form of the line can equip. */
const linePool = (line: LineId): MoveId[] => [...new Set(formsOf(line).flatMap((id) => SPECIES[id].movepool))];
const ALL: readonly MoveId[] = [...BASE_MOVE_IDS, ...TUTOR_MOVE_IDS, ...LINE_MOVE_IDS];

describe('tutor moves: canon learnsets', () => {
  it('every playable species belongs to a line with a learnset, an offer, builds and competitive sources', () => {
    expect(LINES).toEqual([...STARTER_SPECIES, 'abra', 'piplup', 'shinx', 'axew']);
    for (const id of PLAYABLE_SPECIES) expect(LINES, id).toContain(lineOf(id));
    for (const line of LINES) {
      expect(TUTOR_OFFER[line], line).toBeDefined();
      expect(FULL_BUILD[line], line).toBeDefined();
      expect(RECOMMENDED_BUILD[line], line).toBeDefined();
      expect(COMPETITIVE_SOURCES[line]?.length, line).toBeGreaterThan(0);
    }
  });

  it.each(LINES)("%s's line can learn exactly its canon learnset (plus the grandfathered original moves)", (line) => {
    const canon = Object.keys(LEARNSETS[line]);
    for (const id of formsOf(line)) expect(new Set(SPECIES[id].movepool).size, id).toBe(SPECIES[id].movepool.length);
    expect([...linePool(line)].sort()).toEqual([...canon, ...(GRANDFATHERED[line] ?? [])].sort());
  });

  it.each(LINES)('%s has 20–30 moves, at least two per slot kind beyond its kit', (line) => {
    expect(linePool(line).length).toBeGreaterThanOrEqual(20);
    expect(linePool(line).length).toBeLessThanOrEqual(30);
    for (const kind of PLAYER_SLOT_LAYOUT) expect(TUTOR_OFFER[line].filter((m) => MOVES[m].slot === kind).length, kind).toBeGreaterThanOrEqual(2);
  });

  it.each(LINES)('every form of %s shares the line\'s offer; its stage moves are known, never sold', (line) => {
    for (const id of formsOf(line)) {
      expect(SPECIES[id].movepool.filter((m) => !originalKit(id).includes(m))).toEqual([...TUTOR_OFFER[line]]);
      for (const m of TUTOR_OFFER[line]) expect(originalKit(finalOf(line)), `${id} ${m}`).not.toContain(m);
    }
  });

  it('keeps the original kits and default loadouts as they were', () => {
    expect(originalKit('mimikyu')).toEqual(['shadow-claw', 'shadow-sneak', 'play-rough', 'shadow-ball', 'swords-dance', 'dazzling-gleam', 'shadow-force']);
    expect(originalKit('zorua')).toEqual(['fury-swipes', 'feint-attack', 'night-daze', 'foul-play', 'nasty-plot', 'dark-pulse', 'snarl']);
    expect(originalKit('litwick')).toEqual(['ember', 'astonish', 'hex', 'inferno', 'will-o-wisp', 'flamethrower', 'heat-wave']);
    expect(originalKit('cubone')).toEqual(['bone-club', 'bone-rush', 'bonemerang', 'stomping-tantrum', 'bulk-up', 'earthquake', 'bulldoze']);
    expect(starters.map((id) => SPECIES[id].defaultLoadout)).toEqual([
      ['shadow-claw', 'play-rough', 'swords-dance', 'dazzling-gleam'],
      ['feint-attack', 'night-daze', 'nasty-plot', 'dark-pulse'],
      ['ember', 'hex', 'will-o-wisp', 'flamethrower'],
      ['bone-club', 'bonemerang', 'bulk-up', 'earthquake'],
    ]);
  });

  it('every tutor move is taught to someone, and the offers hold only moves outside each kit', () => {
    const taught = new Set(LINES.flatMap((id) => TUTOR_OFFER[id]));
    for (const id of TUTOR_MOVE_IDS) expect(taught.has(id), id).toBe(true);
    for (const id of LINES) for (const m of TUTOR_OFFER[id]) expect(originalKit(id).includes(m), `${id} ${m}`).toBe(false);
  });

  it.each(LINES)("%s's recommended build is a valid loadout of its line's last form", (line) => {
    expect(validateLoadout(SPECIES[finalOf(line)], PLAYER_SLOT_LAYOUT, RECOMMENDED_BUILD[line])).toEqual([]);
  });

  it.each(LINES)("%s's full-investment build is a valid loadout of its line's last form", (line) => {
    expect(validateLoadout(SPECIES[finalOf(line)], PLAYER_SLOT_LAYOUT, FULL_BUILD[line])).toEqual([]);
  });
});

describe('tutor moves: tier-aware damage budget', () => {
  // Effective damage rate against the best original move of the same slot and shape (core/move-power.ts).
  const damaging = ALL.filter((id) => MOVES[id].slot !== 'boost');

  it('every move has a tier: the original kits are Básico, the tutor sells Avanzado and Maestro', () => {
    for (const id of [...BASE_MOVE_IDS, ...LINE_MOVE_IDS]) expect(moveTier(id), id).toBe('basic');
    for (const id of TUTOR_MOVE_IDS) expect(['advanced', 'master'], id).toContain(moveTier(id));
  });

  it.each(damaging)('%s stays inside its tier budget, and pays for any power above the baseline', (id: MoveId) => {
    const move = MOVES[id];
    const ratio = budgetRatio(move);
    expect(ratio).toBeLessThanOrEqual(TIER_BUDGET[moveTier(id)] + 1e-9);
    // Above the baseline one real cost, above the Avanzado budget two.
    if (ratio > 1 + 1e-9) expect(costsOf(move).length, `${id} ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(1);
    if (ratio > TIER_BUDGET.advanced + 1e-9) expect(costsOf(move).length, `${id} ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(2);
  });

  it.each(LINES)('%s can buy at least two Maestro moves, and its damaging ones really are stronger (×1.25 or more)', (id) => {
    const masters = TUTOR_OFFER[id].filter((m) => moveTier(m) === 'master');
    expect(masters.length).toBeGreaterThanOrEqual(2);
    for (const m of masters.filter((x) => MOVES[x].slot !== 'boost')) expect(budgetRatio(MOVES[m]), m).toBeGreaterThanOrEqual(1.25);
    // A Maestro boost pays in HP.
    for (const m of masters.filter((x) => MOVES[x].slot === 'boost')) expect(MOVES[m].hpCost, m).toBeGreaterThan(0);
  });

  it.each(LINES)('%s has a Maestro move that only unlocks after clearing a dungeon', (id) => {
    const locked = TUTOR_OFFER[id].filter((m) => MASTER_MOVES[m]?.unlockedBy);
    expect(locked.length).toBeGreaterThanOrEqual(1);
    for (const m of locked) expect(DUNGEONS.some((d) => d.id === MASTER_MOVES[m]!.unlockedBy && !d.endless), m).toBe(true);
  });

  it('only tutor moves are Maestro', () => {
    for (const id of Object.keys(MASTER_MOVES)) expect((TUTOR_MOVE_IDS as readonly string[]).includes(id), id).toBe(true);
  });

  it('boosts never deal damage or cost stamina, and keep a cooldown of 12 s or more', () => {
    for (const id of TUTOR_MOVE_IDS.filter((m) => MOVES[m].slot === 'boost')) {
      const move = MOVES[id];
      expect(move.power, id).toBe(0);
      expect(move.staminaCost, id).toBe(0);
      expect(move.cooldownMs, id).toBeGreaterThanOrEqual(12000);
    }
  });

  it('area moves always have a cooldown and a stamina cost; heavy moves always cost stamina', () => {
    for (const id of TUTOR_MOVE_IDS) {
      const move = MOVES[id];
      if (move.slot === 'area') expect(move.cooldownMs && move.staminaCost > 0, id).toBeTruthy();
      if (move.slot === 'heavy') expect(move.staminaCost, id).toBeGreaterThan(0);
    }
  });

  it('prices grow with power inside a slot, and every Maestro move costs more than any Avanzado one of its slot', () => {
    for (const id of TUTOR_MOVE_IDS) expect(movePrice(MOVES[id])).toBeGreaterThan(0);
    expect(movePrice(MOVES['fire-blast'])).toBeGreaterThan(movePrice(MOVES['scorching-sands']));
    expect(movePrice(MOVES.thunder)).toBeGreaterThan(movePrice(MOVES['burning-jealousy']));
    const priced = (slot: string, tier: MoveTier) => TUTOR_MOVE_IDS.filter((m) => MOVES[m].slot === slot && moveTier(m) === tier).map((m) => movePrice(MOVES[m]));
    for (const slot of PLAYER_SLOT_LAYOUT) {
      if (priced(slot, 'master').length > 0) expect(Math.min(...priced(slot, 'master')), slot).toBeGreaterThan(Math.max(...priced(slot, 'advanced')));
    }
  });
});
