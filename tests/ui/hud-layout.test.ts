import { afterEach, describe, expect, it } from 'vitest';
import { playViewport } from '../../src/adapters/viewport';
import { itemsChip } from '../../src/adapters/hud';
import { setLanguage } from '../../src/i18n';
import { BOSS_BAR, CARD_CLOCK_STACK, type HudBox, bossStackRect, captionNameSize, cardClockRect, cardTipRect, hudRects, hudScaleFor, hudSpace, liftHintBand, toastRect } from '../../src/ui/hud-layout';
import { hintBand, hintSizes } from '../../src/ui/play-hints-model';

const MINIMAP = { cols: 40, rows: 28 };

/** HUD space and rects for a window, as the game computes them. */
function layoutFor(viewportW: number, viewportH: number, touch: boolean, dpr = 1, extra: { slots?: number; partners?: number } = {}) {
  const fit = playViewport(viewportW, viewportH, dpr, touch);
  const scale = hudScaleFor(viewportW, viewportH, fit.pixelScale, touch);
  const space = hudSpace(fit.viewWidth * fit.pixelScale, fit.viewHeight * fit.pixelScale, scale);
  // CSS pixels per backing-store pixel (1 on desktop).
  const css = fit.cssWidth / (fit.viewWidth * fit.pixelScale);
  return { fit, scale, space, css, rects: hudRects({ ...space }, { chip: true, slots: extra.slots ?? 2, partners: extra.partners ?? 0, minimap: MINIMAP, touch }) };
}

const overlaps = (a: HudBox, b: HudBox): boolean => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('HUD scale', () => {
  it('desktop scales with the viewport in half steps: 1.5 at 1280x720 and 1440x900, 2 at 1920x1080 and never more, never under 1', () => {
    expect(hudScaleFor(1280, 720, 2, false)).toBe(1.5);
    expect(hudScaleFor(1700, 950, 2, false)).toBe(2);
    expect(hudScaleFor(1920, 1080, 3, false)).toBe(2);
    expect(hudScaleFor(1440, 900, 2, false)).toBe(1.5);
    expect(hudScaleFor(990, 750, 1, false)).toBe(1);
    expect(hudScaleFor(1024, 640, 1, false)).toBe(1);
    expect(hudScaleFor(3840, 2160, 6, false)).toBe(2);
    expect(hudScaleFor(600, 400, 1, false)).toBe(1);
  });

  it('touch keeps the canvas scale, so the HUD space is the whole view (320 high on a phone held sideways)', () => {
    const { fit, scale, space } = layoutFor(844, 390, true, 3);
    expect(scale).toBe(fit.pixelScale);
    expect(space).toEqual({ scale, width: fit.viewWidth, height: fit.viewHeight });
    expect(space.height).toBe(320);
  });

  it('a 1280x720 window gets an 853x480 HUD space (the regular layout); a phone gets the compact one', () => {
    expect(layoutFor(1280, 720, false).space.width).toBeCloseTo(853.33, 1);
    expect(layoutFor(1280, 720, false).space.height).toBe(480);
    expect(layoutFor(1280, 720, false).rects.variant).toBe('regular');
    expect(layoutFor(844, 390, true, 3).rects.variant).toBe('compact');
  });
});

const VIEWPORTS = [
  [1920, 1080, false],
  [1700, 950, false],
  [1440, 900, false],
  [1280, 720, false],
  [1024, 640, false],
  [800, 600, false],
  [844, 390, true],
  [568, 320, true],
] as const;

/** The hint bar's footprint in HUD pixels: its free band, lifted over the boss block while a boss fights. 56 CSS px tall covers the enlarged bar. */
const hintBox = (band: { left: number; right: number; bottom: number }, space: { height: number }, scale: number, cssHeight = 56): HudBox => ({ x: band.left, y: space.height - band.bottom - cssHeight / scale, width: band.right - band.left, height: cssHeight / scale });

describe('HUD layout', () => {
  for (const [w, h, touch] of VIEWPORTS) {
    it(`no HUD panel overlaps another and all fit at ${w}x${h}${touch ? ' (touch)' : ''}, boss fight with a full party`, () => {
      const { rects, space, scale } = layoutFor(w, h, touch, touch ? 3 : 1, { slots: 4, partners: 3 });
      const band = liftHintBand(hintBand(space, 4), touch ? rects.boss : bossStackRect(space, 4), space);
      const boxes: [string, HudBox][] = [
        ['status', rects.status],
        ['log', rects.log],
        ['boss', rects.boss],
        ['caption', rects.caption],
        ['chips', rects.chips],
        ['minimap', rects.minimap!],
        ...rects.partners.map((p, i) => [`partner${i}`, p] as [string, HudBox]),
        ...rects.slots.map((s, i) => [`slot${i}`, s] as [string, HudBox]),
        ...(touch ? [] : [['hint', hintBox(band, space, scale)] as [string, HudBox]]),
        // The spell card clock with its result band over the boss bar, and its one-time tip under the announcement.
        ['clock', cardClockRect(rects.boss, touch)],
        ['tip', cardTipRect(space, touch)],
      ];
      expect(rects.partners).toHaveLength(3);
      for (const [name, box] of boxes) {
        expect(box.x, name).toBeGreaterThanOrEqual(0);
        expect(box.y, name).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, name).toBeLessThanOrEqual(space.width);
        expect(box.y + box.height, name).toBeLessThanOrEqual(space.height);
      }
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i]![1], boxes[j]![1]), `${boxes[i]![0]} vs ${boxes[j]![0]}`).toBe(false);
    });
  }

  for (const [w, h, touch] of VIEWPORTS) {
    it(`the boss bar is wide and sits bottom-centre at ${w}x${h}${touch ? ' (touch)' : ''}`, () => {
      const { rects, space, scale } = layoutFor(w, h, touch, touch ? 3 : 1);
      const centre = rects.boss.x + rects.boss.width / 2;
      expect(Math.abs(centre - space.width / 2)).toBeLessThanOrEqual(1);
      expect(rects.boss.y + rects.boss.height).toBeGreaterThan(space.height * 0.6);
      // Raised (owner, 2026-11-04): 5 to 7% of the viewport's height stays under the bar (desktop).
      if (!touch) {
        const below = (space.height - (rects.boss.y + rects.boss.height)) / space.height;
        expect(below).toBeGreaterThanOrEqual(0.05);
        expect(below).toBeLessThanOrEqual(0.075);
      }
      const share = rects.boss.width / space.width;
      if (touch) expect(share).toBeGreaterThanOrEqual(0.4);
      else {
        expect(share).toBeGreaterThanOrEqual(0.3);
        expect(share).toBeLessThanOrEqual(0.42);
        // The bar itself, frame and finials included, is at most 18 CSS px thick at 1440x900 (and 24 at the largest scale).
        expect(BOSS_BAR.frame * scale).toBeLessThanOrEqual(w === 1440 ? 18 : 24);
      }
    });
  }

  for (const [w, h] of VIEWPORTS.filter((v) => !v[2])) {
    it(`desktop ${w}x${h}: slots are square, at least 44 CSS px, in the bottom-right corner`, () => {
      const { rects, space, scale } = layoutFor(w, h, false, 1, { slots: 4 });
      for (const slot of rects.slots) {
        expect(slot.width).toBe(slot.height);
        // Owner, 2026-11-04: bigger so the key glyph fits whole beside the icon (52 to 60 CSS px).
        expect(slot.width * scale).toBeGreaterThanOrEqual(52);
        expect(slot.width * scale).toBeLessThanOrEqual(60);
        expect(slot.x).toBeGreaterThan(space.width / 2);
        expect(slot.y).toBeGreaterThan(space.height / 2);
      }
    });

    it(`desktop ${w}x${h}: the status panel stays in the top-left corner, under a third of the width`, () => {
      const { rects, space } = layoutFor(w, h, false);
      expect(rects.status.x).toBeLessThanOrEqual(10);
      expect(rects.status.y).toBeLessThanOrEqual(10);
      expect(rects.status.width / space.width).toBeLessThanOrEqual(0.25);
      expect(rects.status.height / space.height).toBeLessThanOrEqual(0.12);
    });
  }

  it('the message log is two lines in the bottom-left corner and the boss block keeps clear of it', () => {
    const space = { width: 853, height: 480 };
    const fight = hudRects(space, { chip: false, slots: 4 });
    expect(fight.log.height).toBeLessThanOrEqual(2 * 13 + 9);
    expect(fight.log.y + fight.log.height).toBeLessThanOrEqual(space.height - 6);
    expect(overlaps(fight.log, fight.boss)).toBe(false);
    expect(overlaps(fight.log, fight.caption)).toBe(false);
  });

  it('the card clock sits over the boss bar (centred; on touch at its left, clear of the thumb buttons) and the boss stack makes room for it', () => {
    const desk = layoutFor(1280, 720, false);
    const clock = cardClockRect(desk.rects.boss, false);
    expect(clock.y + clock.height).toBeLessThanOrEqual(desk.rects.boss.y);
    expect(Math.abs(clock.x + clock.width / 2 - (desk.rects.boss.x + desk.rects.boss.width / 2))).toBeLessThanOrEqual(1);
    expect(bossStackRect(desk.space, 4).y).toBeLessThanOrEqual(clock.y);
    expect(desk.rects.boss.y - bossStackRect(desk.space, 4).y).toBeGreaterThanOrEqual(CARD_CLOCK_STACK);
    const phone = layoutFor(568, 320, true, 1);
    const left = cardClockRect(phone.rects.boss, true);
    expect(left.x).toBe(phone.rects.boss.x);
    // The thumb buttons take the right ~45% of a phone: the clock and the tip stay left of it.
    expect(left.x + left.width).toBeLessThanOrEqual(phone.space.width * 0.56);
    const tip = cardTipRect(phone.space, true);
    expect(tip.x + tip.width).toBeLessThanOrEqual(phone.space.width * 0.75);
  });

  it('lifting the hint bar for a boss fight raises it over the boss block and changes nothing else', () => {
    const space = { width: 853, height: 480 };
    const stack = bossStackRect(space, 4);
    const band = hintBand(space, 4);
    const lifted = liftHintBand(band, stack, space);
    expect(lifted.bottom).toBeGreaterThanOrEqual(space.height - stack.y);
    expect(lifted.left).toBe(band.left);
    expect(lifted.right).toBe(band.right);
    expect(liftHintBand(band, null, space)).toEqual(band);
  });

  it('the status window never grows; the held items take one more chip line (idle only)', () => {
    const space = { width: 1024, height: 640 };
    const none = hudRects(space, { chip: false, slots: 2 });
    const some = hudRects(space, { chip: true, slots: 2 });
    expect(some.status).toEqual(none.status);
    expect(some.chips.height - none.chips.height).toBeLessThanOrEqual(12);
  });

  it('the status block is about 220x64 CSS px at 1440x900', () => {
    const { rects, scale } = layoutFor(1440, 900, false);
    expect(rects.status.width * scale).toBeGreaterThanOrEqual(200);
    expect(rects.status.width * scale).toBeLessThanOrEqual(240);
    expect(rects.status.height * scale).toBeLessThanOrEqual(72);
  });

  it('the boss announcement sits at the top centre, bigger, above the middle of the screen', () => {
    for (const [w, h] of [[1280, 720], [1440, 900], [1920, 1080], [990, 750]] as const) {
      const { rects, space, scale } = layoutFor(w, h, false, 1, { slots: 4 });
      expect(rects.caption.y + rects.caption.height).toBeLessThanOrEqual(space.height * 0.25);
      expect(rects.caption.y).toBeGreaterThanOrEqual(rects.status.y);
      expect(Math.abs(rects.caption.x + rects.caption.width / 2 - space.width / 2)).toBeLessThanOrEqual(1);
      expect(rects.caption.width).toBeGreaterThanOrEqual(space.width * 0.3);
      expect(captionNameSize(scale, false) * scale).toBeGreaterThanOrEqual(26);
      expect(captionNameSize(scale, false) * scale).toBeLessThanOrEqual(30);
    }
  });

  it('on touch the announcement fits between the status window and the minimap', () => {
    const { rects } = layoutFor(844, 390, true, 3);
    expect(rects.caption.x).toBeGreaterThanOrEqual(rects.status.x + rects.status.width);
    expect(rects.caption.x + rects.caption.width).toBeLessThanOrEqual(rects.minimap!.x);
    expect(rects.caption.width).toBeGreaterThanOrEqual(120);
  });

  it('touch keeps the status window clear of the Pause button and draws no slot windows over the thumbs', () => {
    const { rects } = layoutFor(844, 390, true, 3);
    expect(rects.status).toMatchObject({ x: 68, y: 6 });
    expect(rects.slots).toEqual([]);
  });
});

describe('held items chip', () => {
  afterEach(() => setLanguage('es'));

  it('replaces the badges with a count and the Esc hint on desktop', () => {
    setLanguage('es');
    expect(itemsChip(0, false)).toBeNull();
    expect(itemsChip(12, false)).toBe('Objetos equipados ×12 · Esc');
    expect(itemsChip(3, true)).toBe('Objetos equipados ×3');
    setLanguage('en');
    expect(itemsChip(1, false)).toBe('Held items ×1 · Esc');
  });
});

/** Minimalist combat HUD (owner 2026-11-04, second pass): peripheral, small, the arena centre clear. */
describe('combat HUD footprint', () => {
  const area = (b: HudBox): number => b.width * b.height;
  /** Every box the HUD owns in a boss fight (the held-items line is hidden in combat, so no chip line). */
  const owned = (w: number, h: number): { boxes: HudBox[]; space: { width: number; height: number } } => {
    const { rects, space } = layoutFor(w, h, false, 1, { slots: 4 });
    const chips = hudRects(space, { chip: false, slots: 4 }).chips;
    const boxes: HudBox[] = [rects.status, chips, rects.log, rects.boss, rects.minimap!, ...rects.slots];
    return { boxes, space };
  };

  for (const [w, h] of [[1280, 720], [1440, 900], [1920, 1080]] as const) {
    it(`covers at most 12% of the viewport at ${w}x${h}`, () => {
      const { boxes, space } = owned(w, h);
      const share = boxes.reduce((sum, b) => sum + area(b), 0) / (space.width * space.height);
      expect(share).toBeLessThanOrEqual(0.12);
    });

    it(`stays under 16% even while a boss event is announced (the bigger top-centre announcement lasts 1.8 s) at ${w}x${h}`, () => {
      const { boxes, space } = owned(w, h);
      const caption = layoutFor(w, h, false, 1, { slots: 4 }).rects.caption;
      expect((boxes.reduce((sum, b) => sum + area(b), 0) + area(caption)) / (space.width * space.height)).toBeLessThanOrEqual(0.16);
    });

    it(`keeps the central 50% x 50% of the viewport clear at ${w}x${h}`, () => {
      const { boxes, space } = owned(w, h);
      const centre: HudBox = { x: space.width * 0.25, y: space.height * 0.25, width: space.width * 0.5, height: space.height * 0.5 };
      for (const box of [...boxes, layoutFor(w, h, false, 1, { slots: 4 }).rects.caption]) expect(overlaps(box, centre), JSON.stringify(box)).toBe(false);
    });

    it(`keeps the centre clear of the flash toast (level, passive, disguise, dodge, item) even with a full party at ${w}x${h}`, () => {
      const { space } = owned(w, h);
      const centre: HudBox = { x: space.width * 0.25, y: space.height * 0.25, width: space.width * 0.5, height: space.height * 0.5 };
      for (const partners of [0, 1, 3]) expect(overlaps(toastRect(space, { partners }), centre), `${partners} partners`).toBe(false);
    });
  }
});

/** The flashes ("¡Disfraz roto!", level up, passive, item, perfect dodge) are a small toast under the status block (owner, 2026-11-04). */
describe('flash toast', () => {
  for (const [w, h, touch] of VIEWPORTS) {
    it(`sits under the status block, clear of every panel and of the centre at ${w}x${h}${touch ? ' (touch)' : ''}`, () => {
      const { rects, space } = layoutFor(w, h, touch, touch ? 3 : 1, { slots: 4, partners: 3 });
      const toast = toastRect(space, { partners: 3, touch });
      const others: [string, HudBox][] = [['status', rects.status], ['chips', rects.chips], ['log', rects.log], ['boss', rects.boss], ['caption', rects.caption], ['minimap', rects.minimap!], ...rects.partners.map((p, i) => [`partner${i}`, p] as [string, HudBox]), ...rects.slots.map((s, i) => [`slot${i}`, s] as [string, HudBox])];
      for (const [name, box] of others) expect(overlaps(toast, box), name).toBe(false);
      expect(toast.y).toBeGreaterThanOrEqual(rects.status.y + rects.status.height);
      expect(toast.x).toBeLessThan(space.width * 0.25);
      expect(toast.x + toast.width).toBeLessThanOrEqual(space.width * 0.25);
      expect(toast.width).toBeGreaterThanOrEqual(touch ? 96 : 160);
      expect(toast.height).toBeLessThanOrEqual(20);
      expect(toast.y + toast.height).toBeLessThanOrEqual(space.height);
    });
  }
});

/** The hint bar, compact in a fight (owner, 2026-11-04: it was the largest thing on screen at the start of a fight). */
describe('hint bar in a fight', () => {
  for (const [w, h, touch] of VIEWPORTS.filter((v) => !v[2])) {
    it(`the compact fight bar is lighter than the calm bar and clear of the boss stack at ${w}x${h}`, () => {
      const { rects, space, scale } = layoutFor(w, h, touch, 1, { slots: 4 });
      const fight = hintSizes(h, 'boss');
      const calm = hintSizes(h, 'calm');
      const band = liftHintBand(hintBand(space, 4), bossStackRect(space, 4), space);
      const box = hintBox(band, space, scale, fight.chip + 4);
      expect(fight.chip + 4).toBeLessThan(calm.chip + 4);
      expect(overlaps(box, rects.boss)).toBe(false);
      expect(overlaps(box, rects.caption)).toBe(false);
      expect(overlaps(box, rects.log)).toBe(false);
      for (const slot of rects.slots) expect(overlaps(box, slot)).toBe(false);
      // At most a quarter of the HUD space's height at the start of the fight.
      expect(box.height).toBeLessThanOrEqual(space.height * 0.1);
    });
  }
});
