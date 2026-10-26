import { describe, expect, it } from 'vitest';
import { buffValue, rankedRatio } from '../../src/core/move-power';
import { rankedMove } from '../../src/core/rank-effects';
import { rankCooldown, rankDamage } from '../../src/core/tutor';
import { BASE_MOVE_IDS, MOVES, type MoveId } from '../../src/data/moves';
import { RANK_EFFECTS, type RankEffect } from '../../src/data/rank-effects';
import { HARD_CEILING, MAX_RANK } from '../../src/data/tutor';
import { TUTOR_MOVE_IDS } from '../../src/data/tutor-moves';
import { LINE_MOVE_IDS } from '../../src/data/line-moves';

const ALL: readonly MoveId[] = [...BASE_MOVE_IDS, ...TUTOR_MOVE_IDS, ...LINE_MOVE_IDS];
const full = { rank: MAX_RANK };

/** Effects that only make sense on some shapes. */
const fits = (id: MoveId, e: RankEffect): boolean => {
  const m = MOVES[id];
  const shot = m.hitbox.kind === 'projectile' ? m.hitbox : null;
  const projectile = shot !== null;
  switch (e.kind) {
    case 'split':
      return projectile && !shot.wave && !shot.boomerang && !shot.linger;
    case 'homing':
      return projectile;
    case 'return':
      return projectile && Boolean(shot.boomerang);
    case 'hits':
      return (m.multiHit ?? 1) > 1;
    case 'buff':
      return m.slot === 'boost' && m.buff?.kind !== 'kindle';
    case 'zone':
      return e.at !== 'line' || Boolean(shot?.wave);
    case 'size':
    case 'stagger':
    case 'crit':
    case 'mark':
    case 'weaken':
    case 'chain':
    case 'drain':
    case 'dot':
      // Hit effects need a damaging move.
      return m.slot !== 'boost';
    default:
      return true;
  }
};

describe('rank effects: data', () => {
  it('every move has two ranks, each a distinct designed effect that fits its shape', () => {
    expect(Object.keys(RANK_EFFECTS).sort()).toEqual([...ALL].sort());
    for (const id of ALL) {
      const [one, two] = RANK_EFFECTS[id];
      expect(one.kind === two.kind && one.kind !== 'buff', id).toBe(false);
      for (const e of [one, two]) expect(fits(id, e), `${id} ${e.kind}`).toBe(true);
    }
  });

  it('every generic kind is used by some move', () => {
    const kinds = new Set(ALL.flatMap((id) => RANK_EFFECTS[id].map((e) => e.kind)));
    expect([...kinds].sort()).toEqual(['buff', 'chain', 'crit', 'dot', 'drain', 'heal', 'hits', 'homing', 'iframes', 'mark', 'return', 'size', 'split', 'stagger', 'ward', 'weaken', 'zone'].sort());
  });

  it.each(ALL.filter((id) => MOVES[id].slot !== 'boost'))('%s at full rank stays under the hard ceiling', (id) => {
    const ranked = rankedMove(id, full.rank);
    expect(rankedRatio(ranked, rankDamage({ [id]: full.rank }, ranked))).toBeLessThanOrEqual(HARD_CEILING + 1e-9);
  });

  it.each(ALL.filter((id) => MOVES[id].slot === 'boost'))('%s at full rank is worth at most the hard ceiling times its plain self', (id) => {
    const plain = buffValue(MOVES[id]);
    const ranked = rankedMove(id, full.rank);
    expect(buffValue(ranked, rankCooldown({ [id]: full.rank }, ranked)) / plain).toBeLessThanOrEqual(HARD_CEILING + 1e-9);
  });

  it('an unranked move is its plain definition (the same object: a plain run never changes)', () => {
    for (const id of ALL) expect(rankedMove(id, 0)).toBe(MOVES[id]);
    expect(rankedMove('shadow-claw', 2)).toBe(rankedMove('shadow-claw', 2));
  });
});
