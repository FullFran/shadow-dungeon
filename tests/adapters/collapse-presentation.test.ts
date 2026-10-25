import { afterEach, describe, expect, it, vi } from 'vitest';
import { COLLAPSE } from '../../src/data/dungeon';
import { createAudio, floorEntrySounds, rumbleGain, RUMBLE_GAIN, soundFor, SOUND_IDS } from '../../src/adapters/audio';
import { CARD, cardAlpha, cardLines, formatClock } from '../../src/adapters/card';
import { applyEvents, initialJuice, JUICE, rumbleLevel, rumbleOffset } from '../../src/adapters/juice';
import { setLanguage } from '../../src/i18n';

describe('floor title card', () => {
  afterEach(() => setLanguage('es'));

  it('fades in, holds and fades out, a little longer on collapse floors', () => {
    const normal = { kind: 'normal' as const };
    expect(cardAlpha(normal, 0)).toBe(0);
    expect(cardAlpha(normal, CARD.fadeInMs / 2)).toBeCloseTo(0.5);
    expect(cardAlpha(normal, CARD.fadeInMs + CARD.holdMs)).toBe(1);
    expect(cardAlpha(normal, CARD.fadeInMs + CARD.holdMs + CARD.fadeOutMs / 2)).toBeCloseTo(0.5);
    expect(cardAlpha(normal, CARD.fadeInMs + CARD.holdMs + CARD.fadeOutMs)).toBe(0);
    expect(cardAlpha({ kind: 'collapse' }, CARD.fadeInMs + CARD.holdMs + CARD.fadeOutMs)).toBe(1);
    expect(CARD.fadeInMs + CARD.holdMs + CARD.fadeOutMs).toBeGreaterThanOrEqual(1500);
  });

  it('formats the escape time as m:ss', () => {
    expect(formatClock(42_000)).toBe('0:42');
    expect(formatClock(65_900)).toBe('1:05');
    expect(formatClock(-5)).toBe('0:00');
  });

  it('names the dungeon and floor, warns of the collapse and shows the escape bonus, in both languages', () => {
    setLanguage('es');
    expect(cardLines({ floor: 2, kind: 'collapse', escape: null, shownAtMs: 0 })).toEqual({
      dungeon: 'Mazmorra Sombría',
      floor: 'Planta 2',
      warning: '¡La planta se derrumba!',
      bonus: null,
    });
    expect(cardLines({ floor: 3, kind: 'normal', escape: { floor: 2, ms: 42_000 }, shownAtMs: 0 }).bonus).toBe('Escapaste del derrumbe en 0:42');
    setLanguage('en');
    const en = cardLines({ floor: 3, kind: 'collapse', escape: { floor: 2, ms: 61_000 }, shownAtMs: 0 });
    expect(en).toEqual({ dungeon: 'Shadow Dungeon', floor: 'Floor 3', warning: 'The floor is collapsing!', bonus: 'You escaped the collapse in 1:01' });
  });
});

describe('collapse rumble and sounds', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('swells towards the front and is silent with no moving front', () => {
    expect(rumbleLevel(null)).toBe(0);
    expect(rumbleLevel(COLLAPSE.rumbleTiles)).toBe(0);
    expect(rumbleLevel(COLLAPSE.rumbleTiles / 2)).toBeCloseTo(0.5);
    expect(rumbleLevel(0)).toBe(1);
    expect(rumbleLevel(-3)).toBe(1);
    expect(rumbleGain(0)).toBe(0);
    expect(rumbleGain(1)).toBe(RUMBLE_GAIN);
    expect(rumbleGain(0.5)).toBeLessThan(RUMBLE_GAIN / 2);
    const offset = rumbleOffset(1, () => 1);
    expect(Math.abs(offset.x)).toBeLessThanOrEqual(JUICE.rumblePx);
    expect(rumbleOffset(0, () => 1)).toEqual({ x: 0, y: 0 });
  });

  it('crashes on entering a collapse floor and hurts on rubble without hitstop', () => {
    expect(floorEntrySounds('collapse', true)).toEqual(['stairs', 'floorCard', 'collapse']);
    expect(floorEntrySounds('normal', true)).toEqual(['stairs', 'floorCard']);
    // The first floor and "Restart floor" show the card without walking down any stairs.
    expect(floorEntrySounds('normal', false)).toEqual(['floorCard']);
    for (const id of floorEntrySounds('collapse', true)) expect(SOUND_IDS).toContain(id);
    expect(soundFor({ type: 'collapseHurt', damage: 6 })).toBe('hurt');
    const juice = applyEvents(initialJuice(), [{ type: 'collapseHurt', damage: 6 }], { x: 0, y: 0 });
    expect(juice.hitstopMs).toBe(0);
    expect(juice.numbers).toHaveLength(1);
    expect(juice.shakeMs).toBeGreaterThan(0);
  });

  it('setRumble is a no-op without AudioContext', () => {
    vi.stubGlobal('AudioContext', undefined);
    const audio = createAudio({ masterVolume: 1, musicVolume: 1, sfxVolume: 1, muted: false });
    expect(() => {
      audio.setRumble(1);
      audio.unlock();
      audio.setRumble(0.5);
    }).not.toThrow();
  });
});
