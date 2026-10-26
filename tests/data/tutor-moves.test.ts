import { describe, expect, it } from 'vitest';
import { validateLoadout } from '../../src/core/loadout';
import { LEARNSETS, type StarterId } from '../../src/data/learnsets';
import { BASE_MOVE_IDS, MOVES, type MoveDef, type MoveId } from '../../src/data/moves';
import { PLAYER_SLOT_LAYOUT } from '../../src/data/slots';
import { originalKit, PLAYABLE_SPECIES, SPECIES } from '../../src/data/species';
import { GRANDFATHERED, movePrice, RECOMMENDED_BUILD, TUTOR_OFFER } from '../../src/data/tutor';
import { TUTOR_MOVE_IDS } from '../../src/data/tutor-moves';

const starters = PLAYABLE_SPECIES as readonly StarterId[];

/** Single-target damage per ms of a tap (multi-hit counted whole); area moves per second of cooldown. */
function rate(move: MoveDef): number {
  const total = move.power * (move.multiHit ?? 1) * (move.hitbox.kind === 'projectile' && move.hitbox.boomerang ? 2 : 1);
  if (move.slot === 'area') {
    const zone = move.hitbox.kind === 'projectile' && move.hitbox.linger ? Math.ceil(move.hitbox.lifetimeMs / move.hitbox.linger) : 1;
    return (total * zone) / (move.cooldownMs! / 1000);
  }
  const cycle = move.windupMs + move.activeMs + move.recoveryMs;
  return total / Math.max(cycle, move.cooldownMs ?? 0);
}

/** A move pays for extra damage: recoil, an HP cost or a cooldown on a heavy move. */
const drawback = (move: MoveDef) => Boolean(move.recoil || (move.slot === 'heavy' && move.cooldownMs));
const ranged = (move: MoveDef) => move.hitbox.kind === 'projectile';
const multi = (move: MoveDef) => (move.multiHit ?? 1) > 1 || (move.hitbox.kind === 'projectile' && Boolean(move.hitbox.boomerang));

describe('tutor moves: canon learnsets', () => {
  it.each(starters)("%s's movepool is its canon learnset (plus the grandfathered original moves)", (id) => {
    const canon = Object.keys(LEARNSETS[id]);
    const pool = SPECIES[id].movepool;
    expect(new Set(pool).size).toBe(pool.length);
    expect([...pool].sort()).toEqual([...canon, ...(GRANDFATHERED[id] ?? [])].sort());
  });

  it.each(starters)('%s has 20–30 moves, at least two per slot kind beyond its kit', (id) => {
    expect(SPECIES[id].movepool.length).toBeGreaterThanOrEqual(20);
    expect(SPECIES[id].movepool.length).toBeLessThanOrEqual(30);
    for (const kind of PLAYER_SLOT_LAYOUT) expect(TUTOR_OFFER[id].filter((m) => MOVES[m].slot === kind).length, kind).toBeGreaterThanOrEqual(2);
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
    const taught = new Set(starters.flatMap((id) => TUTOR_OFFER[id]));
    for (const id of TUTOR_MOVE_IDS) expect(taught.has(id), id).toBe(true);
    for (const id of starters) for (const m of TUTOR_OFFER[id]) expect(originalKit(id).includes(m), `${id} ${m}`).toBe(false);
  });

  it.each(starters)("%s's recommended build is a valid loadout of its learnable moves", (id) => {
    expect(validateLoadout(SPECIES[id], PLAYER_SLOT_LAYOUT, RECOMMENDED_BUILD[id])).toEqual([]);
  });
});

describe('tutor moves: damage budget', () => {
  // The ceiling of each slot is the best of the original kits, by shape (ranged and multi-hit apart); a move with a drawback may go 25 % past it.
  const base = BASE_MOVE_IDS.map((id) => MOVES[id]);
  const ceiling = (move: MoveDef) => {
    const peers = base.filter((b) => b.slot === move.slot && (move.slot === 'area' || (ranged(b) === ranged(move) && multi(b) === multi(move))));
    const pool = peers.length > 0 ? peers : base.filter((b) => b.slot === move.slot);
    return Math.max(...pool.map(rate)) * (drawback(move) ? 1.25 : 1);
  };

  it.each(TUTOR_MOVE_IDS.filter((id) => MOVES[id].slot !== 'boost'))('%s stays inside its slot budget', (id: MoveId) => {
    const move = MOVES[id];
    expect(rate(move)).toBeLessThanOrEqual(ceiling(move) + 1e-9);
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

  it('prices grow with power inside a slot', () => {
    for (const id of TUTOR_MOVE_IDS) expect(movePrice(MOVES[id])).toBeGreaterThan(0);
    expect(movePrice(MOVES['fire-blast'])).toBeGreaterThan(movePrice(MOVES['scorching-sands']));
    expect(movePrice(MOVES.thunder)).toBeGreaterThan(movePrice(MOVES['burning-jealousy']));
  });
});
