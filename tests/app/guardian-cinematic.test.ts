import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { cinematicMode, cinematicPanels, hasSeen, markSeen, parseSeen, pausesRun, SEEN_KEY } from '../../src/app/guardian-cinematic';
import { GUARDIAN_CINEMATICS } from '../../src/data/guardian-cinematics';
import { totalMs } from '../../src/ui/cinematic';
import { catalog, LANGUAGES } from '../../src/i18n';

const GUARDIANS = ['aegislash', 'decidueye'] as const;

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
