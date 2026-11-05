import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hallCards } from '../../src/app/shrine-hall';
import { SHRINE_BOSSES } from '../../src/core/shrine';
import { PLAYABLE_SPECIES, SPECIES } from '../../src/data/species';
import { lookKey, SPRITE_KEYS, SPRITES } from '../../src/data/sprites';
import { EMPTY_SHRINE } from '../../src/town/shrine-records';
import { SPRITE_BOXES, spriteFit } from '../../src/ui/sprite-fit';

/** Owner, 2026-11-04: "Los pokemon se cortan, que no pase en ningun otro sitio." A sprite is fit whole into a box that reserves its headroom. */
const ROOT = new URL('../../', import.meta.url).pathname;

/** Every idle frame a playable species or a shrine boss can draw: base, shiny and female sheets. */
function frames(): { who: string; w: number; h: number }[] {
  const ids = new Set<string>([...PLAYABLE_SPECIES, ...SHRINE_BOSSES.map((b) => b.boss)]);
  const out: { who: string; w: number; h: number }[] = [];
  for (const id of ids) {
    const def = SPECIES[id as keyof typeof SPECIES];
    if (!def) continue;
    for (const shiny of [false, true]) {
      for (const female of [false, true]) {
        const meta = SPRITES.sprites[lookKey(SPRITE_KEYS[def.sprite], shiny, female)]?.anims.Idle;
        if (meta) out.push({ who: `${id}${shiny ? ' shiny' : ''}${female ? ' female' : ''}`, w: meta.frameWidth, h: meta.frameHeight });
      }
    }
  }
  return out;
}

describe('sprite fit', () => {
  it('covers every playable species and every shrine boss with a frame size', () => {
    const who = new Set(frames().map((f) => f.who));
    for (const id of PLAYABLE_SPECIES) expect(who.has(id), id).toBe(true);
    for (const stop of SHRINE_BOSSES) expect(who.has(stop.boss), stop.boss).toBe(true);
    const cards = hallCards('reflections', { shrine: EMPTY_SHRINE, beaten: new Set(SHRINE_BOSSES.map((b) => b.boss)), heralds: [], tier: 'normal' });
    for (const card of cards) if (card.species) expect(who.has(card.species), card.species).toBe(true);
  });

  it('every playable species and shrine boss frame fits whole inside every sprite box', () => {
    expect(SPRITE_BOXES.length).toBeGreaterThan(8);
    for (const box of SPRITE_BOXES) {
      for (const f of frames()) {
        const fit = spriteFit(f.w, f.h, box.minW, box.h);
        const at = `${f.who} in ${box.selector} (${box.minW}x${box.h})`;
        expect(fit.scale, at).toBeGreaterThan(0);
        expect(fit.width, at).toBeLessThanOrEqual(box.minW);
        expect(fit.height, at).toBeLessThanOrEqual(box.h);
        expect(fit.x, at).toBeGreaterThanOrEqual(0);
        expect(fit.y, at).toBeGreaterThanOrEqual(0);
        expect(fit.x + fit.width, at).toBeLessThanOrEqual(box.minW);
        expect(fit.y + fit.height, at).toBeLessThanOrEqual(box.h);
        // the frame keeps its proportions
        expect(fit.width / fit.height, at).toBeCloseTo(f.w / f.h, 5);
        // and stays legible: at least a third of the box height for the tallest frame
        expect(fit.scale * f.h, at).toBeGreaterThan(box.h * 0.3);
      }
    }
  });

  it('prefers whole-number scales for crisp pixels when the box allows it', () => {
    expect(spriteFit(40, 40, 130, 130).scale).toBe(3);
    expect(spriteFit(200, 100, 100, 100).scale).toBeCloseTo(0.5, 5);
  });

  it('sizes every declared box in its stylesheet, with a height matching the declaration', () => {
    for (const box of SPRITE_BOXES) {
      const css = readFileSync(`${ROOT}${box.file}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      const rule = css.split('}').find((r) => r.split('{')[0]!.split(',').some((s) => s.trim() === box.selector));
      expect(rule, `${box.selector} in ${box.file}`).toBeDefined();
      const height = /(?:^|[;{\s])height:\s*(\d+)px/.exec(rule!.split('{')[1] ?? '');
      expect(Number(height?.[1]), `${box.selector} height`).toBe(box.h);
      const cls = box.selector.slice(1);
      const apps = readdirSync(`${ROOT}src/app`)
        .map((f) => readFileSync(`${ROOT}src/app/${f}`, 'utf8'))
        .join('\n');
      expect(apps, `${cls} carries sprite-box`).toMatch(new RegExp(`className: [\`'][^\`']*(${cls}[^\`']*sprite-box|sprite-box[^\`']*${cls})`));
    }
  });

  it('no stylesheet crops a sprite canvas with a negative margin or a fixed !important height', () => {
    const files = [...readdirSync(`${ROOT}src/styles`).map((f) => `src/styles/${f}`), 'index.html'];
    for (const file of files) {
      const css = readFileSync(`${ROOT}${file}`, 'utf8');
      for (const rule of css.split('}')) {
        const [sel = '', body = ''] = rule.split('{');
        if (!/(art|sprite|form|face|chip-art)[^,{]*canvas/.test(sel) && !/canvas\.portrait/.test(sel)) continue;
        expect(body, `${file}: ${sel.trim()}`).not.toMatch(/margin-bottom:\s*-/);
        expect(body, `${file}: ${sel.trim()}`).not.toMatch(/height:\s*\d+px\s*!important/);
      }
    }
  });

  it('a sprite box never clips its sprite', () => {
    const css = readFileSync(`${ROOT}src/styles/sprite-fit.css`, 'utf8');
    const box = css.split('}').find((r) => r.split('{')[0]!.trim() === '.sprite-box');
    expect(box).toBeDefined();
    expect(box).not.toMatch(/overflow:\s*hidden/);
  });
});
