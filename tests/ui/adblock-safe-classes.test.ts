import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Ad blockers (EasyList, used by uBlock Origin and AdBlock) hide elements by class names that look like adverts:
 * `.ad-main`, `.ad-head`, `.ad-title`, `.ad-side`, `.ad-links`, `.ad-note`... The account drawer once used the `ad-`
 * prefix and lost its header, providers and form in every browser with a blocker (2026-11-05). No class or id in the
 * game may start with `ad-` or `ad_`.
 */
const ROOT = join(__dirname, '../../src');
const files = (readdirSync(ROOT, { recursive: true }) as string[]).filter((f) => /\.(css|ts)$/.test(f));
const ADVERT = /(?<![\w-])[.#]?ad[-_][a-z]/;

describe('class names an ad blocker would hide', () => {
  it('no stylesheet selects a class or id starting with ad-', () => {
    const hits = files
      .filter((f) => f.endsWith('.css'))
      .flatMap((f) => readFileSync(join(ROOT, f), 'utf8').match(/[.#]ad[-_][a-z][\w-]*/g)?.map((m) => `${f}: ${m}`) ?? []);
    expect(hits).toEqual([]);
  });

  it('no code sets a class or id starting with ad-', () => {
    const hits = files
      .filter((f) => f.endsWith('.ts'))
      .flatMap((f) =>
        [...readFileSync(join(ROOT, f), 'utf8').matchAll(/(?:\b(?:className|id)\s*[:=]\s*|classList\.\w+\(\s*|aria-labelledby['"],\s*)[`'"]([^`'"]*)[`'"]/g)]
          .map((m) => m[1]!)
          .filter((value) => value.split(/\s+/).some((token) => ADVERT.test(token)))
          .map((value) => `${f}: ${value}`),
      );
    expect(hits).toEqual([]);
  });
});
