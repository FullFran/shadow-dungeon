import { describe, expect, it } from 'vitest';
import { hubButtons, hubStep, recordLine, TOWN_GATED, type HubState } from '../../src/app/title-hub';
import { PIXEL_ICONS } from '../../src/ui/pixel-icons';
import { catalog, LANGUAGES } from '../../src/i18n';

const base: HubState = { townOpen: true, starterChosen: true, newsUnseen: false, installable: false, ticketAdmin: false };

describe('title hub', () => {
  it('has exactly one primary Play', () => {
    expect(hubButtons(base).filter((b) => b.zone === 'play')).toHaveLength(1);
  });

  it('keeps each rail to six buttons at most (Hick, Miller)', () => {
    for (const zone of ['left', 'right'] as const) {
      const n = hubButtons(base).filter((b) => b.zone === zone).length;
      expect(n, zone).toBeGreaterThan(2);
      expect(n, zone).toBeLessThanOrEqual(6);
    }
  });

  it('locks the town services until the town opens, never hides them', () => {
    const closed = hubButtons({ ...base, townOpen: false });
    for (const id of TOWN_GATED) expect(closed.find((b) => b.id === id)?.locked, id).toBe(true);
    for (const b of hubButtons(base)) expect(b.locked, b.id).toBe(false);
    expect(closed.find((b) => b.id === 'play')?.locked).toBe(false);
  });

  it('locks the Pokémon screen until a starter is chosen', () => {
    expect(hubButtons({ ...base, starterChosen: false }).find((b) => b.id === 'pokemon')?.locked).toBe(true);
  });

  it('badges the news only while unseen', () => {
    expect(hubButtons(base).find((b) => b.id === 'news')?.badge).toBe(false);
    expect(hubButtons({ ...base, newsUnseen: true }).find((b) => b.id === 'news')?.badge).toBe(true);
    expect(hubButtons({ ...base, newsUnseen: true }).filter((b) => b.badge).map((b) => b.id)).toEqual(['news']);
  });

  it('offers the install and the tickets only when they apply', () => {
    expect(hubButtons(base).some((b) => b.id === 'install' || b.id === 'tickets')).toBe(false);
    const all = hubButtons({ ...base, installable: true, ticketAdmin: true }).map((b) => b.id);
    expect(all).toContain('install');
    expect(all).toContain('tickets');
  });

  it('gives every button a pixel icon and a name in every language', () => {
    const every = hubButtons({ ...base, installable: true, ticketAdmin: true });
    for (const b of every) expect(PIXEL_ICONS[b.icon], b.id).toBeDefined();
    for (const language of LANGUAGES) {
      for (const b of every) {
        expect(catalog(language)[b.labelKey], `${language} ${b.id}`).toBeTruthy();
        if (b.lockKey) expect(catalog(language)[b.lockKey], `${language} ${b.id} lock`).toBeTruthy();
      }
    }
  });
});

describe('hub focus step', () => {
  const pts = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 10, y: 0 },
    { id: 'c', x: 0, y: 10 },
    { id: 'd', x: 10, y: 9 },
  ];
  it('moves to the nearest control in the pressed direction', () => {
    expect(hubStep(pts, 'a', 'right')).toBe('b');
    expect(hubStep(pts, 'a', 'down')).toBe('c');
    expect(hubStep(pts, 'c', 'right')).toBe('d');
    expect(hubStep(pts, 'd', 'up')).toBe('b');
  });
  it('stays put when nothing lies that way', () => {
    expect(hubStep(pts, 'a', 'left')).toBe('a');
    expect(hubStep(pts, 'a', 'up')).toBe('a');
  });
});

describe('the profile record line', () => {
  it('the record line uses the singular for one expedition, in es and en', () => {
    const es = (key: string) => catalog('es')[key] ?? key;
    const en = (key: string) => catalog('en')[key] ?? key;
    expect(recordLine(es, 3, 1)).toBe('Mejor planta 3 · 1 expedición');
    expect(recordLine(es, 37, 129)).toBe('Mejor planta 37 · 129 expediciones');
    expect(recordLine(en, 3, 1)).toBe('Best floor 3 · 1 expedition');
    expect(recordLine(en, 37, 129)).toBe('Best floor 37 · 129 expeditions');
  });
});
