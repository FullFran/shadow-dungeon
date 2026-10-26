import { describe, expect, it } from 'vitest';
import { ECHO_CARDS } from '../../src/data/cards';
import { ENDLESS } from '../../src/data/endless';
import type { Difficulty } from '../../src/data/difficulty';
import { bossBar } from '../../src/core/boss';
import { echoCards, echoShare, echoStageAt, fightOf, isDeclaring } from '../../src/core/cards';
import { depthScale } from '../../src/core/endless';
import { startRun } from '../../src/core/run';
import type { WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { behaviourFor } from '../../src/core/tricks';
import { IDLE } from './helpers';

/**
 * Sima echoes of the card guardians (user decision 2026-10-26 C; data/cards.ts
 * `ECHO_CARDS`, core/cards.ts `echoCards`): the tier's cards, by depth. The
 * first stratum (floors 5 and 15) plays phase 1 only; from floor 25 phase 2
 * joins; from floor 35 (or a second meeting) the survival card and the last
 * spell. The echo holds only the HP of the cards it plays, with shorter
 * timers. Easy keeps the duel.
 */

const ECHO_GUARDIANS = [
  { species: 'aegislash', floor: 5 },
  { species: 'trevenant', floor: 15 },
  { species: 'decidueye', floor: 25 },
  { species: 'dhelmise', floor: 45 },
  { species: 'nihilego', floor: 65 },
] as const;

describe('echo cards: the stages', () => {
  it('phase 1 on the first stratum, phase 2 from floor 25, everything from 35 or on a second meeting', () => {
    expect([5, 15, 25, 35, 45].map((f) => echoStageAt(f))).toEqual([1, 1, 2, 3, 3]);
    expect(echoStageAt(5, 2)).toBe(3);
    expect(ECHO_CARDS.phase2FromFloor).toBe(25);
    expect(ECHO_CARDS.fullFromFloor).toBe(35);
  });

  it('every guardian on every card tier: stage 1 has no phase-2, survival or last card; stage 2 no survival or last; stage 3 all; timers shorter; HP share kept', () => {
    for (const { species } of ECHO_GUARDIANS) {
      for (const d of ['normal', 'hard', 'nightmare'] as const) {
        const f = fightOf(behaviourFor(species, d))!;
        const awaken = f.cards.findIndex((c) => c.phase2);
        const one = echoCards(f, 1);
        const two = echoCards(f, 2);
        const three = echoCards(f, 3);
        expect(one.cards.length, `${species} ${d}`).toBeGreaterThanOrEqual(1);
        expect(one.cards.some((c) => c.phase2 || c.survival || c.lastSpell)).toBe(false);
        if (awaken >= 0) expect(one.cards.every((c) => f.cards.findIndex((k) => k.id === c.id) < awaken)).toBe(true);
        expect(two.cards.some((c) => c.survival || c.lastSpell)).toBe(false);
        expect(three.cards.map((c) => c.id)).toEqual(f.cards.map((c) => c.id));
        for (const c of three.cards) expect(c.timerMs).toBe(Math.round(f.cards.find((k) => k.id === c.id)!.timerMs * ECHO_CARDS.timerScale));
        expect(echoShare(f, 3)).toBeCloseTo(1);
        expect(echoShare(f, 1)).toBeLessThanOrEqual(1);
        if (f.cards.some((c) => (c.phase2 || c.lastSpell) && c.hpShare > 0)) expect(echoShare(f, 1)).toBeLessThan(1);
        // The same object every time (cached), so the bar, the brain and the renderer agree.
        expect(echoCards(f, 2)).toBe(two);
      }
    }
  });
});

describe('echo cards: in the Sima', () => {
  const echoWorld = (floor: number, d: Difficulty): WorldState => startRun(7, { difficulty: d }, floor, 'eclipse-chasm').world;

  for (const { species, floor } of ECHO_GUARDIANS) {
    it(`${species}'s echo on floor ${floor} plays its stage of the nightmare cards with only their HP`, () => {
      const world = echoWorld(floor, 'nightmare');
      const boss = world.enemies.find((e) => e.species === species)!;
      expect(boss, species).toBeTruthy();
      expect(world.enemyScale?.echoStage).toBe(echoStageAt(floor));
      let s = { ...world, player: { ...world.player, hp: 1e9, maxHp: 1e9, disguiseBroken: true } };
      for (let i = 0; i < 6000 / FIXED_DT_MS && !isDeclaring(s.enemies.find((e) => e.species === species)!); i++) s = step({ ...s, player: { ...s.player, pos: boss.pos } }, IDLE, FIXED_DT_MS);
      const f = fightOf(behaviourFor(species, 'nightmare'))!;
      const stage = echoCards(f, echoStageAt(floor));
      const declared = s.enemies.find((e) => e.species === species)!;
      expect(declared.boss!.stance).toBe(stage.cards[0]!.id);
      expect(bossBar(s)!.segments).toHaveLength(stage.cards.length - 1);
    });
  }

  it("an echo's max HP is the guardian's, at the echo HP share (whatever the depth), times the share of the cards it plays", () => {
    const boss = echoWorld(5, 'nightmare').enemies.find((e) => e.species === 'aegislash')!;
    const plain = echoWorld(5, 'easy').enemies.find((e) => e.species === 'aegislash')!;
    const f = fightOf(behaviourFor('aegislash', 'nightmare'))!;
    // Easy's echo has no cards: its HP is the plain echo scale (depth included); a card echo drops the depth (the tier's HP aside).
    const guardian = plain.maxHp / depthScale(ENDLESS.scaling, 5, true).hp;
    expect(boss.maxHp / guardian).toBeCloseTo(1.45 * ECHO_CARDS.hpScale * echoShare(f, 1), 1);
    expect(depthScale(ENDLESS.scaling, 5, true).echo).toBe(true);
  });

  it('on easy the echo keeps the duel (no cards)', () => {
    let s = startRun(7, {}, 5, 'eclipse-chasm').world;
    s = { ...s, player: { ...s.player, hp: 1e9, maxHp: 1e9, disguiseBroken: true } };
    for (let i = 0; i < 3000 / FIXED_DT_MS; i++) s = step(s, IDLE, FIXED_DT_MS);
    const boss = s.enemies.find((e) => e.species === 'aegislash')!;
    expect(['shield', 'blade']).toContain(boss.boss!.stance);
    expect(bossBar(s)!.segments).toBeUndefined();
  });
});
