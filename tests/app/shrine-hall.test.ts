import { describe, expect, it } from 'vitest';
import { hallCards, hallTabs, SHRINE_HALL_KEYS, type HallInput } from '../../src/app/shrine-hall';
import { SHRINE_BOSSES } from '../../src/core/shrine';
import { DIFFICULTIES } from '../../src/data/difficulty';
import { GAUNTLETS } from '../../src/data/shrine';
import { catalog, LANGUAGES } from '../../src/i18n';
import { EMPTY_SHRINE, gauntletReward, recordTrial } from '../../src/town/shrine-records';
import { PIXEL_ICONS } from '../../src/ui/pixel-icons';

/** The hall of oaths (owner, 2026-11-04: "rediseña el santuario"): every guardian and gauntlet gets a card. */
const allBeaten = new Set<string>(SHRINE_BOSSES.map((b) => b.boss));
const input = (over: Partial<HallInput> = {}): HallInput => ({ shrine: EMPTY_SHRINE, beaten: allBeaten, heralds: [], tier: 'normal', ...over });

describe('hall of oaths cards', () => {
  // Owner 2026-11-08: "los jefes que salga la silueta en negro": a sealed boss keeps its species so the view can draw its black silhouette.
  it('gives every shrine boss a card, sealed and shown as its silhouette while it is not beaten', () => {
    const cards = hallCards('reflections', input({ beaten: new Set() }));
    expect(cards.map((c) => c.id)).toEqual(SHRINE_BOSSES.map((b) => b.boss));
    for (const card of cards) {
      expect(card.state).toBe('locked');
      expect(card.species).toBe(card.id);
      expect(card.silhouette).toBe(true);
      expect(card.icon).toBe('seal');
      expect(card.stops).toHaveLength(1);
    }
  });

  it('marks a beaten boss as beaten, and as sworn once the tier has a record', () => {
    const stop = SHRINE_BOSSES[0]!;
    const { records } = recordTrial(EMPTY_SHRINE, { kind: 'boss', id: stop.boss, difficulty: 'normal', victory: true, ms: 70_000, noHit: false, captures: 1 });
    const on = hallCards('reflections', input({ shrine: records }));
    expect(on[0]!.state).toBe('sworn');
    expect(on[0]!.species).toBe(stop.boss);
    expect(on[0]!.best?.bestMs).toBe(70_000);
    expect(on.slice(1).every((c) => c.state === 'beaten')).toBe(true);
    // Records are per tier: the same boss on another tier is only beaten.
    expect(hallCards('reflections', input({ shrine: records, tier: 'hard' }))[0]!.state).toBe('beaten');
  });

  it('gives every gauntlet a card: locked until its bosses fell, with its reward on the tier', () => {
    const locked = hallCards('gauntlets', input({ beaten: new Set() }));
    expect(locked.map((c) => c.id)).toEqual(GAUNTLETS.map((g) => g.id));
    for (const card of locked) {
      expect(card.state).toBe('locked');
      expect(card.missing).toBe(GAUNTLETS.find((g) => g.id === card.id)!.bosses.length);
    }
    for (const tier of DIFFICULTIES) {
      for (const card of hallCards('gauntlets', input({ tier }))) {
        expect(card.state).toBe('open');
        expect(card.reward).toBe(gauntletReward(card.id as 'guardians', tier));
        expect(card.rewardTaken).toBe(false);
      }
    }
  });

  it('a gauntlet reward is taken after the first clear on that tier', () => {
    const { records } = recordTrial(EMPTY_SHRINE, { kind: 'gauntlet', id: 'guardians', difficulty: 'easy', victory: true, ms: 200_000, noHit: true, captures: 2 });
    const card = hallCards('gauntlets', input({ shrine: records, tier: 'easy' }))[0]!;
    expect(card.state).toBe('sworn');
    expect(card.rewardTaken).toBe(true);
    expect(card.best?.noHit).toBe(true);
  });

  it('an unlocked gauntlet without a record is open, never beaten; only a real kill reads beaten', () => {
    for (const tier of DIFFICULTIES) {
      for (const g of GAUNTLETS) {
        const sealed = hallCards('gauntlets', input({ tier, beaten: new Set() })).find((c) => c.id === g.id)!;
        const open = hallCards('gauntlets', input({ tier })).find((c) => c.id === g.id)!;
        const { records } = recordTrial(EMPTY_SHRINE, { kind: 'gauntlet', id: g.id, difficulty: tier, victory: true, ms: 90_000, noHit: false, captures: 0 });
        const sworn = hallCards('gauntlets', input({ tier, shrine: records })).find((c) => c.id === g.id)!;
        expect([sealed.state, open.state, sworn.state], `${g.id} ${tier}`).toEqual(['locked', 'open', 'sworn']);
      }
      for (const stop of SHRINE_BOSSES) {
        const cards = (beaten: Set<string>) => hallCards('reflections', input({ tier, beaten })).find((c) => c.id === stop.boss)!;
        expect(cards(new Set()).state, stop.boss).toBe('locked');
        expect(cards(allBeaten).state, stop.boss).toBe('beaten');
      }
    }
  });

  it('lists the heralds met as fightable cards by seed, the last met first', () => {
    const cards = hallCards('heralds', input({ heralds: [{ seed: 7, name: 'Vigía' }, { seed: 9, name: 'Faro' }] }));
    expect(cards.map((c) => c.id)).toEqual(['9', '7']);
    expect(cards.every((c) => c.state === 'open' && c.kind === 'herald')).toBe(true);
  });

  it('tabs count what is open and show the best time of the tier; heralds only once met', () => {
    expect(hallTabs(input()).map((t) => t.id)).toEqual(['reflections', 'gauntlets']);
    const tabs = hallTabs(input({ beaten: new Set(), heralds: [{ seed: 1, name: 'X' }] }));
    expect(tabs.map((t) => t.id)).toEqual(['reflections', 'gauntlets', 'heralds']);
    expect(tabs[0]).toMatchObject({ open: 0, total: SHRINE_BOSSES.length, bestMs: null });
    expect(tabs[1]).toMatchObject({ open: 0, total: GAUNTLETS.length });
    const { records } = recordTrial(EMPTY_SHRINE, { kind: 'boss', id: SHRINE_BOSSES[1]!.boss, difficulty: 'normal', victory: true, ms: 55_000, noHit: false, captures: 0 });
    expect(hallTabs(input({ shrine: records }))[0]).toMatchObject({ open: SHRINE_BOSSES.length, sworn: 1, bestMs: 55_000 });
  });

  it('every icon used exists and every key is in both languages', () => {
    for (const card of [...hallCards('reflections', input()), ...hallCards('gauntlets', input())]) expect(PIXEL_ICONS[card.icon], card.id).toBeDefined();
    for (const tab of hallTabs(input({ heralds: [{ seed: 1, name: 'X' }] }))) expect(PIXEL_ICONS[tab.icon], tab.id).toBeDefined();
    for (const language of LANGUAGES) for (const key of SHRINE_HALL_KEYS) expect(catalog(language)[key], `${language} ${key}`).toBeTruthy();
  });
});
