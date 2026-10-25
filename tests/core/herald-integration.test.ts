import { describe, expect, it } from 'vitest';
import { bossBar } from '../../src/core/boss';
import { blocksHit } from '../../src/core/boss';
import { atHeraldCard, HERALD_DECLARE_MS, heraldOf } from '../../src/core/herald/brain';
import { startRun } from '../../src/core/run';
import type { GameEvent, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { cardInfo, equalShares, isHeraldCard, segmentFloorShare } from '../../src/data/cards';
import { ENEMY_SHOT_CAP } from '../../src/data/enemies';
import { ENDLESS, isHeraldFloor } from '../../src/data/endless';
import { IDLE } from './helpers';

/**
 * The heralds (feat/procedural-bosses) on main's systems: one card framework
 * (data/cards.ts), the fairness yardsticks (core/fairness.ts), the encounters
 * and gates (core/gates.ts), the echo rotation.
 */
const ECL = 'eclipse-chasm';
const herald = (w: WorldState) => w.enemies.find((e) => e.species === 'sima-herald')!;
const invulnerable = (w: WorldState): WorldState => ({ ...w, player: { ...w.player, hp: 1e9, maxHp: 1e9 } });

describe('herald floors among the echoes', () => {
  it('never land on a guardian echo (multiples of 5) or an Eclipse Echo floor (multiples of 10)', () => {
    const heralds = Array.from({ length: 600 }, (_, i) => i + 1).filter((f) => isHeraldFloor(ENDLESS, f));
    expect(heralds.slice(0, 3)).toEqual([22, 32, 42]);
    for (const f of heralds) {
      expect(f % ENDLESS.echoEvery).not.toBe(0);
      expect(f % (ENDLESS.eclipseEvery ?? 10)).not.toBe(0);
    }
  });

  it('hold no gate, no leader and no band (a herald floor is a boss room), and carry the one-hit cap\'s yardstick', { timeout: 30_000 }, () => {
    for (const seed of [1, 2, 3, 4]) {
      for (const floor of [22, 32]) {
        const w = startRun(seed, {}, floor, ECL).world;
        expect(w.gate).toBeUndefined();
        expect(w.enemies.some((e) => e.leader || e.band)).toBe(false);
        expect(w.referenceLevel).toBeGreaterThan(1);
      }
    }
  });
});

describe('heralds on the shared card framework', () => {
  it('a herald card is a card: equal HP shares, the shared info, no guard of its own', () => {
    expect(isHeraldCard('herald0')).toBe(true);
    expect(isHeraldCard('herald12x')).toBe(true);
    expect(isHeraldCard('awaken')).toBe(false);
    expect(isHeraldCard('sc-aeg-walls')).toBe(false);
    expect(cardInfo('herald3x')).toEqual({ nameKey: 'boss.stance.herald' });
    expect(equalShares(4).map((_, i) => segmentFloorShare(equalShares(4), i))).toEqual([0.75, 0.5, 0.25, 0]);
  });

  it('caps its shots under the global cap, declares each card (invulnerable) and shows notches and a clock on the bar', { timeout: 60_000 }, () => {
    const start = startRun(4, {}, 32, ECL).world;
    const def = heraldOf(start, herald(start))!;
    expect(def.maxShots).toBeLessThanOrEqual(ENEMY_SHOT_CAP);
    let w = invulnerable(start);
    const events: GameEvent[] = [];
    while (herald(w).ai.mode === 'idle') {
      w = invulnerable(step(w, IDLE, FIXED_DT_MS));
      events.push(...w.events);
    }
    const b = herald(w);
    expect(b.ai.mode).toBe('transform');
    expect(b.ai.attack).toBe('start');
    expect(b.boss!.hpFloor).toBeCloseTo(b.maxHp * (1 - 1 / def.cards.length), 6);
    expect(blocksHit(b, { x: b.pos.x, y: b.pos.y + 50 })).toBe(true);
    expect(events.some((e) => e.type === 'enemyTelegraph' && e.attack === 'declare' && e.durationMs === HERALD_DECLARE_MS)).toBe(true);
    const bar = bossBar(w)!;
    expect(bar.segments).toHaveLength(def.cards.length - 1);
    expect(bar.cardLeftMs).toBeUndefined();
    for (let t = 0; t < HERALD_DECLARE_MS + 100; t += FIXED_DT_MS) w = invulnerable(step(w, IDLE, FIXED_DT_MS));
    expect(herald(w).ai.mode).not.toBe('transform');
    expect(blocksHit(herald(w), { x: herald(w).pos.x, y: herald(w).pos.y + 50 })).toBe(false);
    expect(bossBar(w)!.cardLeftMs).toBeGreaterThan(def.cards[0]!.timerMs - 500);
  });

  it('a broken segment ends the card with spellCardEnd and declares the next one with its outcome', { timeout: 60_000 }, () => {
    const start = startRun(4, {}, 32, ECL).world;
    let w = invulnerable(start);
    for (let t = 0; t < 3000; t += FIXED_DT_MS) w = invulnerable(step(w, IDLE, FIXED_DT_MS));
    const id = herald(w).id;
    w = { ...w, enemies: w.enemies.map((e) => (e.id === id ? { ...e, hp: e.boss!.hpFloor! } : e)) };
    w = step(w, IDLE, FIXED_DT_MS);
    expect(w.events).toContainEqual({ type: 'spellCardEnd', enemyId: id, card: 'herald0', outcome: 'broken' });
    // The next card's declaration, or the awakening when phase 2 starts on card 1: both carry the outcome.
    const def = heraldOf(w, herald(w))!;
    expect(herald(w).boss!.stance).toBe(def.phase2.fromCard === 1 ? 'awaken' : 'herald1');
    expect(herald(w).ai).toMatchObject({ mode: 'transform', attack: 'broken' });
  });

  it('?card=N starts a herald on card N, its segment full (phase 2 from its awakening card)', { timeout: 30_000 }, () => {
    const w = startRun(11, {}, 42, ECL).world;
    const def = heraldOf(w, herald(w))!;
    const n = def.cards.length;
    const on1 = atHeraldCard(w, herald(w), 1);
    expect(on1.boss!.stance).toBe(1 >= def.phase2.fromCard ? 'herald1x' : 'herald1');
    expect(on1.hp).toBeCloseTo(on1.maxHp * (1 - 1 / n), 6);
    expect(on1.boss!.hpFloor).toBeCloseTo(on1.maxHp * (1 - 2 / n), 6);
    const last = atHeraldCard(w, herald(w), 99);
    expect(last.boss!.stance).toBe(`herald${n - 1}x`);
    expect(last.boss!.phase).toBe(2);
  });
});
