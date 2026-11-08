import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The phone stylesheet must never reach a desktop (owner, 2026-11-06: "solo en visión móvil"). Since the landscape-only
 * mobile pass (odd/tasks/mobile-pass.md, 2026-11-08) a rule reaches phones in one of three ways: its selector starts with
 * `html.touch` (touch mode, src/adapters/touch-mode.ts) or `html.rotate-blocked` (the portrait notice), it sits in a media
 * query whose every branch asks for a finger, or it is one of the inert defaults listed below (hidden until a touch class
 * shows them, or a property desktop browsers ignore). tests/e2e/desktop-identical.spec.ts checks the rendered result.
 */
const css = readFileSync(new URL('../../src/styles/mobile.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** Selectors that are safe on desktop: the rotate notice (display: none until html.rotate-blocked), the shrine's page buttons
 * (a pager nav, hidden on desktop), and text-size-adjust (only mobile browsers read it). */
const INERT = [/^\.rotate-gate\b/, /^\.oa-pages\b/, /^html$/];

interface Rule {
  media: string | null;
  selectors: string[];
}

/** A selector list split on its top-level commas only (not the ones inside :is() or :has()). */
function splitTop(list: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    if (list[i] === '(') depth++;
    else if (list[i] === ')') depth--;
    else if (list[i] === ',' && depth === 0) {
      parts.push(list.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(list.slice(start).trim());
  return parts.filter(Boolean);
}

/** Every style rule with the media query around it (one level of nesting, as the file uses). */
function rules(source: string): Rule[] {
  const out: Rule[] = [];
  const walk = (text: string, media: string | null): void => {
    let depth = 0;
    let start = 0;
    let prelude = '';
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '{') {
        if (depth === 0) {
          prelude = text.slice(start, i).trim();
          start = i + 1;
        }
        depth++;
      } else if (text[i] === '}') {
        depth--;
        if (depth === 0) {
          const body = text.slice(start, i);
          if (prelude.startsWith('@media')) walk(body, prelude);
          else if (!prelude.startsWith('@keyframes')) out.push({ media, selectors: splitTop(prelude) });
          start = i + 1;
        }
      }
    }
    expect(depth).toBe(0);
  };
  walk(source, null);
  return out;
}

const phoneMedia = (media: string): boolean => media.replace(/^@media/, '').split(',').every((b) => b.includes('(hover: none)') && b.includes('(pointer: coarse)'));
const scoped = (selector: string): boolean => /^html\.(touch|rotate-blocked)\b/.test(selector) || INERT.some((re) => re.test(selector));

describe('src/styles/mobile.css', () => {
  const all = rules(css);

  it('has rules', () => {
    expect(all.length).toBeGreaterThan(0);
  });

  it('never reaches a desktop: every rule is touch-scoped, inert, or inside a phone-only media query', () => {
    for (const rule of all) {
      if (rule.media && phoneMedia(rule.media)) continue;
      for (const selector of rule.selectors) expect(scoped(selector), `${rule.media ?? ''} ${selector}`).toBe(true);
    }
  });

  it('lets nothing scroll on a phone (owner, 2026-11-08: "que no haya scroll en ningún menú móvil")', () => {
    expect(css).not.toMatch(/overflow(-y)?:\s*auto/);
    expect(css).not.toMatch(/overflow(-y)?:\s*scroll/);
  });
});
