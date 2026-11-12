import { describe, expect, it } from 'vitest';
import { updateHostedCardFight } from '../../src/core/cards';
import type { GameEvent, WorldState } from '../../src/core/state';
import { vec } from '../../src/core/vec';
import { spawnEnemy } from '../../src/core/world';
import { registerCards, type CardFightDef } from '../../src/data/cards';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { tickAiAt } from '../../src/core/difficulty';
import { world } from './helpers';

/**
 * A hosted boss (data/hosted-cards.ts: Sableye, Trevenant, Lanturn,
 * Dhelmise, Salazzle, Nihilego) can play a pattern card (`steps`) among its
 * hosted ones: the shared card engine plays it, its own engine waits, and the
 * next hosted card picks up as before (odd/tasks/boss-patterns.md T4).
 */
const FIGHT: CardFightDef = registerCards({
  aggroRange: 900,
  breakMs: 600,
  phase2BreakMs: 600,
  maxShots: 140,
  walkSpeed: 0,
  keepDistance: 0,
  power: 1,
  cards: [
    {
      id: 'sc-test-hostedpattern',
      nameKey: 'spell.test.pattern',
      hpShare: 0.5,
      timerMs: 6000,
      restMs: 300,
      steps: [{ telegraphMs: 500, recoverMs: 500, pattern: { kind: 'rings', rings: 2, perRing: 10, gap: 2, gapTurnDeg: 20, gapMs: 400, shot: { power: 10, type: 'water', speed: 90, radius: 6, lifetimeMs: 3000 } } }],
    },
    { id: 'sc-test-hostedmoves', nameKey: 'spell.test.moves', hpShare: 0.5, timerMs: 6000, restMs: 0, steps: [], moves: ['bubbles'] },
  ],
});

describe('a hosted fight plays pattern cards', () => {
  it('the pattern card fires its own pattern without calling the boss engine, then the hosted card takes over', () => {
    let state: WorldState = spawnEnemy(world(vec(400, 450)), 'lanturn', vec(400, 200));
    let played = 0;
    const play = (s: WorldState) => {
      played++;
      return s;
    };
    let shots = 0;
    let stances: string[] = [];
    for (let i = 0; i < Math.round(8500 / FIXED_DT_MS); i++) {
      const events: GameEvent[] = [];
      const before = state.enemies[0]!;
      // The brain ticks the AI clock before a behaviour runs (core/difficulty.ts `tickAiAt`).
      const enemy = { ...before, ai: tickAiAt(before.ai, FIXED_DT_MS, 'normal') };
      state = updateHostedCardFight(state, enemy, FIGHT, state.player.pos, FIXED_DT_MS, events, play, () => 'bubbles');
      shots = Math.max(shots, state.projectiles.filter((p) => p.owner === 'enemy').length);
      for (const e of events) if (e.type === 'bossStance') stances = [...stances, e.stance];
      if (state.enemies[0]!.boss?.stance === 'sc-test-hostedpattern') expect(played).toBe(0);
    }
    expect(shots).toBeGreaterThan(0);
    expect(stances).toContain('sc-test-hostedmoves');
    expect(played).toBeGreaterThan(0);
  });
});

describe('a phase-2 pattern card in a hosted fight', () => {
  it('puts the boss engine in phase 2 for good, as a hosted phase-2 card does', () => {
    const fight: CardFightDef = registerCards({ ...FIGHT, cards: [{ ...FIGHT.cards[0]!, id: 'sc-test-hostedawaken', phase2: true }, FIGHT.cards[1]!] });
    let state: WorldState = spawnEnemy(world(vec(400, 450)), 'dhelmise', vec(400, 200));
    for (let i = 0; i < Math.round(3000 / FIXED_DT_MS); i++) {
      const before = state.enemies[0]!;
      state = updateHostedCardFight(state, { ...before, ai: tickAiAt(before.ai, FIXED_DT_MS, 'normal') }, fight, state.player.pos, FIXED_DT_MS, [], (s) => s, () => 'undertow');
    }
    expect(state.enemies[0]!.boss?.stance).toBe('sc-test-hostedawaken');
    expect(state.enemies[0]!.boss?.phase).toBe(2);
  });
});
