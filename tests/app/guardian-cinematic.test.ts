import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { cinematicMode, cinematicPanels, hasSeen, markSeen, parseSeen, pausesRun, SEEN_KEY } from '../../src/app/guardian-cinematic';
import { GUARDIAN_CINEMATICS } from '../../src/data/guardian-cinematics';
import { totalMs } from '../../src/ui/cinematic';
import { catalog, LANGUAGES } from '../../src/i18n';

const GUARDIANS = ['aegislash', 'decidueye', 'nihilego'] as const;

describe('guardian cinematic sequencing', () => {
  it('plays in full the first time, the short name card afterwards, in full again when replayed', () => {
    expect(cinematicMode({ seen: false, shared: false })).toBe('full');
    expect(cinematicMode({ seen: true, shared: false })).toBe('short');
    expect(cinematicMode({ seen: true, shared: false, replay: true })).toBe('full');
  });

  it('never pauses a shared run: only the name card over the game', () => {
    expect(cinematicMode({ seen: false, shared: true })).toBe('card');
    expect(cinematicMode({ seen: true, shared: true, replay: true })).toBe('card');
    expect(pausesRun('card')).toBe(false);
    expect(pausesRun('full')).toBe(true);
    expect(pausesRun('short')).toBe(true);
    expect(cinematicPanels('aegislash', 'pre', 'card')).toEqual([]);
  });

  it('remembers what was seen per guardian and phase, and survives broken or hostile storage', () => {
    const store = memoryStore();
    expect(hasSeen(store, 'decidueye', 'pre')).toBe(false);
    markSeen(store, 'decidueye', 'pre');
    expect(hasSeen(store, 'decidueye', 'pre')).toBe(true);
    expect(hasSeen(store, 'decidueye', 'post')).toBe(false);
    expect(hasSeen(store, 'aegislash', 'pre')).toBe(false);
    expect(parseSeen('{"__proto__":1}').size).toBe(0);
    expect(parseSeen('not json').size).toBe(0);
    expect([...parseSeen('["aegislash:pre","<b>:pre",3]')]).toEqual(['aegislash:pre']);
    const broken = { get: () => { throw new Error('denied'); }, set: () => { throw new Error('denied'); } };
    expect(hasSeen(broken, 'aegislash', 'pre')).toBe(false);
    expect(() => markSeen(broken, 'aegislash', 'pre')).not.toThrow();
    expect(store.get(SEEN_KEY)).toBe('["decidueye:pre"]');
  });
});

describe('guardian cinematic data', () => {
  for (const species of GUARDIANS) {
    it(`${species}: 2-4 panels before (10-20 s) ending on the reveal, 1-3 after, 2-3 s short versions`, () => {
      const c = GUARDIAN_CINEMATICS[species]!;
      expect(c.pre.length).toBeGreaterThanOrEqual(2);
      expect(c.pre.length).toBeLessThanOrEqual(4);
      expect(totalMs(c.pre)).toBeGreaterThanOrEqual(10_000);
      expect(totalMs(c.pre)).toBeLessThanOrEqual(20_000);
      expect(c.pre.at(-1)!.scene).toBe('reveal');
      expect(c.pre.at(-1)!.lines).toEqual([`species.${species}`, `guardian.${species}.title`]);
      expect(c.post.length).toBeGreaterThanOrEqual(1);
      expect(c.post.length).toBeLessThanOrEqual(3);
      expect(totalMs(c.post)).toBeLessThanOrEqual(20_000);
      for (const short of [c.preShort, c.postShort]) {
        expect(totalMs(short)).toBeGreaterThanOrEqual(2000);
        expect(totalMs(short)).toBeLessThanOrEqual(3000);
      }
      // Slow narration: every line is fully typed before its panel fades out.
      for (const panel of [...c.pre, ...c.post]) {
        const english = catalog('en');
        const typed = panel.textStartMs + panel.lines.reduce((ms, key) => ms + ((english[key] ?? '').length * 1000) / panel.charsPerSecond + panel.lineGapMs, 0);
        expect(typed, panel.id).toBeLessThanOrEqual(panel.durationMs - panel.fadeOutMs + 600);
      }
    });
  }

  for (const language of LANGUAGES) {
    it(`has every cinematic line in "${language}", never naming what lies beneath`, () => {
      const strings = catalog(language);
      const keys = GUARDIANS.flatMap((s) => {
        const c = GUARDIAN_CINEMATICS[s]!;
        return [...c.pre, ...c.post, ...c.preShort, ...c.postShort].flatMap((p) => p.lines);
      });
      expect(keys.filter((k) => !strings[k])).toEqual([]);
      for (const k of keys) expect(strings[k], k).not.toMatch(/necrozma/i);
    });
  }
});

/**
 * Tu Sombra, the tutorial dungeon's boss (odd/tasks/tutorial-dungeon.md S8):
 * the same cinematic engine as the guardians, but drawn with the original
 * procedural shadow (adapters/shadow-view.ts), never a Pokémon sheet; it
 * speaks in first person before the fight, and after it dissolves and the
 * way opens towards the town.
 */
describe('Tu Sombra cinematic', () => {
  const c = GUARDIAN_CINEMATICS['shadow-self']!;

  it('exists, with a pre-fight cinematic ending on its name card and a post-fight one ending on the way to the town', () => {
    expect(c).toBeDefined();
    expect(c.pre.length).toBeGreaterThanOrEqual(2);
    expect(c.pre.length).toBeLessThanOrEqual(4);
    expect(totalMs(c.pre)).toBeGreaterThanOrEqual(10_000);
    expect(totalMs(c.pre)).toBeLessThanOrEqual(20_000);
    expect(c.pre.at(-1)!.lines).toEqual(['species.shadow-self', 'guardian.shadow-self.title']);
    expect(c.post.length).toBeGreaterThanOrEqual(1);
    expect(totalMs(c.post)).toBeLessThanOrEqual(20_000);
    expect(c.post.at(-1)!.scene).toBe('shade-way');
    for (const short of [c.preShort, c.postShort]) {
      expect(totalMs(short)).toBeGreaterThanOrEqual(2000);
      expect(totalMs(short)).toBeLessThanOrEqual(3000);
    }
    const english = catalog('en');
    for (const panel of [...c.pre, ...c.post]) {
      const typed = panel.textStartMs + panel.lines.reduce((ms, key) => ms + ((english[key] ?? '').length * 1000) / panel.charsPerSecond + panel.lineGapMs, 0);
      expect(typed, panel.id).toBeLessThanOrEqual(panel.durationMs - panel.fadeOutMs + 600);
    }
  });

  it('is drawn only with the shadow scenes (the procedural ink mass), never a sprite silhouette', () => {
    for (const panel of [...c.pre, ...c.post, ...c.preShort, ...c.postShort]) expect(panel.scene, panel.id).toMatch(/^shade-/);
  });

  it('plays in full once per device, then only its name card', () => {
    const store = memoryStore();
    expect(cinematicMode({ seen: hasSeen(store, 'shadow-self', 'pre'), shared: false })).toBe('full');
    markSeen(store, 'shadow-self', 'pre');
    expect(cinematicMode({ seen: hasSeen(store, 'shadow-self', 'pre'), shared: false })).toBe('short');
    expect(cinematicPanels('shadow-self', 'pre', 'short')).toBe(c.preShort);
  });

  for (const language of LANGUAGES) {
    it(`has every line in "${language}", in first person, without em dashes`, () => {
      const strings = catalog(language);
      const keys = [...c.pre, ...c.post, ...c.preShort, ...c.postShort].flatMap((p) => p.lines);
      expect(keys.filter((k) => !strings[k])).toEqual([]);
      for (const k of keys) expect(strings[k], k).not.toContain('—');
      const spoken = ['guardian.shadow-self.pre.1', 'guardian.shadow-self.pre.2', 'guardian.shadow-self.post.1'].map((k) => strings[k] ?? '').join(' ');
      expect(spoken).toMatch(language === 'es' ? /\b(soy|seré|te)\b/i : /\bI\b/);
    });
  }
});

describe('the guardian speaks its panels with its portrait (issue #47)', () => {
  it('its words carry its face, its name card none; Tu Sombra has no face', async () => {
    const { guardianFace } = await import('../../src/app/guardian-cinematic');
    const { portraitFor } = await import('../../src/data/portraits');
    for (const species of ['aegislash', 'decidueye', 'dhelmise', 'nihilego'] as const) {
      const full = [...cinematicPanels(species, 'pre', 'full'), ...cinematicPanels(species, 'post', 'full')];
      for (const panel of full) {
        const who = guardianFace(species, panel);
        if (panel.scene === 'reveal') expect(who, panel.id).toBeNull();
        else expect(who && portraitFor(who.sprite, who.emotion), `${species} ${panel.id}`).not.toBeNull();
      }
      for (const panel of cinematicPanels(species, 'pre', 'short')) expect(guardianFace(species, panel)).toBeNull();
    }
    expect(guardianFace('shadow-self', cinematicPanels('shadow-self', 'pre', 'full')[0]!)).toBeNull();
  });
});
