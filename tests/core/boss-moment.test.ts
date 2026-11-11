import { describe, expect, it } from 'vitest';
import { bossMoment } from '../../src/core/boss-moment';
import { enemyTimeScale } from '../../src/core/time';
import { step } from '../../src/core/step';
import type { EnemyState, WorldState } from '../../src/core/state';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { spawnEnemy } from '../../src/core/world';
import { bossPhaseStance, bossSpecies, PHASE_STANCES } from '../../src/data/boss-lore';
import { ENEMY_BEHAVIOUR } from '../../src/data/enemies';
import { TUNING } from '../../src/data/tuning';
import type { SpeciesId } from '../../src/data/species';
import { vec } from '../../src/core/vec';
import { bossCaption } from '../../src/ui/boss-caption';
import { IDLE, world } from './helpers';
import '../../src/data/guardian-tricks';

/** A world with one boss of `species`, far from the player. */
function withBoss(species: string): WorldState {
  const spawned = spawnEnemy(world(vec(100, 100)), species as SpeciesId, vec(600, 450), { dormant: true });
  return { ...spawned, player: { ...spawned.player, hp: 9999, maxHp: 9999 } };
}

const patch = (state: WorldState, change: (e: EnemyState) => EnemyState): WorldState => ({ ...state, enemies: state.enemies.map(change) });

describe('boss moments (phase change and final defeat)', () => {
  const phased = bossSpecies().filter((s) => bossPhaseStance(s) !== null);

  it('every boss with a second phase names its phase change, and the name exists', () => {
    const withPhase2 = bossSpecies().filter((s) => (ENEMY_BEHAVIOUR as Record<string, { phase2?: unknown }>)[s]?.phase2 !== undefined);
    expect(phased.length).toBeGreaterThanOrEqual(4);
    expect(phased).toEqual(withPhase2);
    for (const species of phased) {
      expect(PHASE_STANCES, species).toContain(bossPhaseStance(species));
      expect(bossCaption(bossPhaseStance(species)!, species), species).not.toBeNull();
    }
  });

  it('a phase change is seen from the stance alone (what a guest receives) on every phased boss', () => {
    for (const species of phased) {
      const before = withBoss(species);
      const after = patch(before, (e) => ({ ...e, boss: { ...e.boss!, stance: bossPhaseStance(species)! } }));
      expect(bossMoment(before, after), species).toMatchObject({ kind: 'phase', species, stance: bossPhaseStance(species) });
      // Not again while the stance stays.
      expect(bossMoment(after, after), species).toBeNull();
    }
  });

  it('the host also sees it from the phase flag', () => {
    const before = withBoss(phased[0]!);
    const after = patch(before, (e) => ({ ...e, boss: { ...e.boss!, phase: 2 as const } }));
    expect(bossMoment(before, after)).toMatchObject({ kind: 'phase' });
  });

  it('the final defeat of every boss is a moment', () => {
    for (const species of bossSpecies()) {
      const before = withBoss(species);
      const after = patch(before, (e) => ({ ...e, hp: 0, alive: false }));
      expect(bossMoment(before, after), species).toMatchObject({ kind: 'finale', species });
    }
  });

  it('a plain enemy falling is no moment', () => {
    const before = spawnEnemy(world(), 'poochyena', vec(500, 300));
    const after = patch(before, (e) => ({ ...e, hp: 0, alive: false }));
    expect(bossMoment(before, after)).toBeNull();
  });

  it('solo, the final defeat slows the enemies for a moment; a shared run keeps its pace', () => {
    const solo = patch(withBoss(bossSpecies()[0]!), (e) => ({ ...e, hp: 1, dot: { kind: 'burn', damage: 5, ticksLeft: 1, nextMs: 1 } }));
    const felled = step(solo, IDLE, FIXED_DT_MS);
    expect(felled.enemies[0]!.alive).toBe(false);
    expect(felled.slowMoMs).toBeGreaterThanOrEqual(TUNING.bossMoment.slowMoMs - FIXED_DT_MS);
    expect(enemyTimeScale(felled)).toBe(TUNING.perfectDodge.slowMoScale);
    expect(enemyTimeScale({ ...felled, role: 'guest' })).toBe(1);
  });

  it('the phase change slows the enemies and the boss does not hit meanwhile', () => {
    const species = phased[0]!;
    const start = patch(withBoss(species), (e) => ({ ...e, hp: e.maxHp * 0.49, ai: { ...e.ai, mode: 'approach' as const } }));
    let current = { ...start, player: { ...start.player, pos: vec(560, 450) } };
    let slowed = 0;
    let moment = false;
    for (let i = 0; i < 400 && !moment; i++) {
      const next = step({ ...current, player: { ...current.player, hp: current.player.maxHp } }, IDLE, FIXED_DT_MS);
      moment = bossMoment(current, next)?.kind === 'phase';
      current = next;
    }
    expect(moment).toBe(true);
    expect(current.slowMoMs).toBeGreaterThan(0);
    // During the hold nothing hurts the player.
    while (current.slowMoMs > 0 && slowed < 400) {
      current = step({ ...current, player: { ...current.player, hp: current.player.maxHp } }, IDLE, FIXED_DT_MS);
      expect(current.events.some((e) => e.type === 'playerHurt')).toBe(false);
      slowed++;
    }
    expect(slowed).toBeGreaterThan(0);
  });
});
