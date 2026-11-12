import { describe, expect, it } from 'vitest';
import { atCard, fightOf } from '../../src/core/cards';
import { loadRoom } from '../../src/core/rooms';
import type { WorldState } from '../../src/core/state';
import { behaviourFor } from '../../src/core/tricks';
import { vec } from '../../src/core/vec';
import { createWorld } from '../../src/core/world';
import { CARD_CLOCK, cardClockView, cardResult, cardResultBanner, cardTick, cardTipText, RESULT_MS, resultAlpha, takeCardTip } from '../../src/ui/card-clock';
import { catalog, LANGUAGES, setLanguage } from '../../src/i18n';

/**
 * The spell card clock, readable at a glance (odd/tasks/last-phase-and-timer.md
 * S3, docs/research/boss-timer.md): how long is left (digits and a draining
 * line), what is at stake (the capture seal, lit while the player is
 * unhurt), the last seconds on several channels (red, bigger, pulsing, a
 * tick), a word at each card's end and a one-time tip.
 */

describe('card clock view', () => {
  it('shows whole seconds (rounded up), the share left, and urgency in the last 5 s', () => {
    expect(cardClockView({ leftMs: 12_300, totalMs: 20_000 }, null)).toMatchObject({ seconds: 13, share: 0.615, urgent: false, seal: null });
    expect(cardClockView({ leftMs: 5000, totalMs: 20_000 }, null)).toMatchObject({ seconds: 5, urgent: true });
    expect(cardClockView({ leftMs: 5001, totalMs: 20_000 }, null).urgent).toBe(false);
    expect(CARD_CLOCK.urgentMs).toBe(5000);
    // Never past full, never under empty, a zero timer reads empty.
    expect(cardClockView({ leftMs: 30_000, totalMs: 20_000 }, null).share).toBe(1);
    expect(cardClockView({ leftMs: -5, totalMs: 20_000 }, null)).toMatchObject({ share: 0, seconds: 0 });
    expect(cardClockView({ leftMs: 10, totalMs: 0 }, null).share).toBe(0);
  });

  it('the capture seal: live while the player is unhurt during this boss\'s card, lost once hit, absent for another boss', () => {
    const capture = { enemyId: 'b1', card: 'sc-x' as never, hit: false };
    expect(cardClockView({ leftMs: 9000, totalMs: 20_000 }, { capture, enemyId: 'b1' }).seal).toBe('live');
    expect(cardClockView({ leftMs: 9000, totalMs: 20_000 }, { capture: { ...capture, hit: true }, enemyId: 'b1' }).seal).toBe('lost');
    expect(cardClockView({ leftMs: 9000, totalMs: 20_000 }, { capture, enemyId: 'b2' }).seal).toBeNull();
    expect(cardClockView({ leftMs: 9000, totalMs: 20_000 }, { capture: undefined, enemyId: 'b1' }).seal).toBeNull();
  });

  it('pulses in the last seconds (a size cue that does not depend on colour)', () => {
    const calm = cardClockView({ leftMs: 9000, totalMs: 20_000 }, null);
    const late = cardClockView({ leftMs: 2500, totalMs: 20_000 }, null);
    expect(calm.scale).toBe(1);
    expect(late.scale).toBeGreaterThan(1.1);
  });
});

describe('card clock ticks', () => {
  it('ticks once per second as the digits change in the last 5 s, a distinct last tick on 1, nothing else', () => {
    // Digits 7 -> 6: still calm.
    expect(cardTick(6100, 5900)).toBeNull();
    // 6 -> 5, 3 -> 2: ticks; 2 -> 1: the last one.
    expect(cardTick(5100, 4900)).toBe('tick');
    expect(cardTick(2050, 1990)).toBe('tick');
    expect(cardTick(1050, 990)).toBe('last');
    expect(cardTick(4900, 4800)).toBeNull();
    expect(cardTick(9100, 8900)).toBeNull();
    // The clock appears, ends, or goes up (a new card): no tick.
    expect(cardTick(undefined, 4000)).toBeNull();
    expect(cardTick(1200, undefined)).toBeNull();
    expect(cardTick(200, 30_000)).toBeNull();
    expect(cardTick(50, 0)).toBeNull();
  });
});

function arena(): WorldState {
  const s = loadRoom(createWorld({ seed: 1, arena: { width: 1, height: 1 }, playerPos: vec(0, 0), difficulty: 'normal' }), 'boss');
  return s;
}

describe('card result', () => {
  const fight = fightOf(behaviourFor('aegislash', 'normal'))!;
  const playing = (): WorldState => {
    const s = arena();
    return { ...s, enemies: s.enemies.map((e) => (e.boss ? { ...atCard(e, fight, 0), ai: { ...e.ai, mode: 'approach' as const } } : e)) };
  };
  const declared = (before: WorldState, outcome: string): WorldState => ({
    ...before,
    enemies: before.enemies.map((e) => (e.boss ? { ...atCard(e, fight, 1), ai: { ...atCard(e, fight, 1).ai, attack: outcome } } : e)),
  });

  it('reads how a card ended from two worlds (any peer: the declaration carries the outcome)', () => {
    const before = playing();
    expect(cardResult(before, declared(before, 'broken'))).toMatchObject({ outcome: 'broken' });
    expect(cardResult(before, declared(before, 'timeout'))).toMatchObject({ outcome: 'timeout' });
    expect(cardResult(before, declared(before, 'survived'))).toMatchObject({ outcome: 'survived' });
    // The first declaration, and a declaration already showing, are not results.
    expect(cardResult(before, declared(before, 'start'))).toBeNull();
    const d = declared(before, 'broken');
    expect(cardResult(d, d)).toBeNull();
    expect(cardResult(before, before)).toBeNull();
  });

  it('banners in both languages: what happened and, on a timeout, that it passes with no reward', () => {
    for (const lang of LANGUAGES) {
      setLanguage(lang);
      const broken = cardResultBanner('broken', false, 0);
      const timeout = cardResultBanner('timeout', false, 0);
      const survived = cardResultBanner('survived', true, 0);
      expect(broken.heading).toBe(catalog(lang)['card.clock.broken']);
      expect(broken.sub).toBe(catalog(lang)['card.clock.unmastered']);
      expect(cardResultBanner('broken', true, 0).sub).toBeNull();
      expect(timeout.heading).toBe(catalog(lang)['card.clock.timeout']);
      expect(timeout.sub).toBe(catalog(lang)['card.clock.noReward']);
      expect(survived.heading).toBe(catalog(lang)['card.clock.survived']);
      expect(broken.tone).toBe('good');
      expect(timeout.tone).toBe('bad');
      for (const key of ['card.clock.broken', 'card.clock.timeout', 'card.clock.survived', 'card.clock.noReward', 'card.clock.unmastered', 'card.clock.seal', 'card.clock.sealLost', 'card.clock.tip', 'card.clock.tipTitle']) {
        expect(catalog(lang)[key], `${lang} ${key}`).toBeTruthy();
      }
    }
    setLanguage('es');
    expect(cardResultBanner('broken', false, 0).heading).toBe('¡CARTA SUPERADA!');
    expect(cardResultBanner('timeout', false, 0).heading).toBe('¡TIEMPO!');
  });

  it('fades in, holds and fades out within RESULT_MS', () => {
    expect(resultAlpha(-1)).toBe(0);
    expect(resultAlpha(RESULT_MS / 2)).toBe(1);
    expect(resultAlpha(RESULT_MS)).toBe(0);
  });
});

describe('first-time tip', () => {
  it('shows once per device and marks it (like bossPhaseTipSeen); none without a store', () => {
    let seen = false;
    const store = { seen: () => seen, mark: () => { seen = true; } };
    expect(takeCardTip(store)).toBe(true);
    expect(seen).toBe(true);
    expect(takeCardTip(store)).toBe(false);
    expect(takeCardTip(undefined)).toBe(false);
  });

  it('says what the clock is for, what breaking it in time wins and what a timeout costs', () => {
    setLanguage('es');
    const tip = cardTipText();
    expect(tip.title).toBe(catalog('es')['card.clock.tipTitle']);
    expect(tip.body).toMatch(/tiempo/i);
    expect(tip.body).toMatch(/golpes/i);
    expect(tip.body).toMatch(/sin premio/i);
  });
});
