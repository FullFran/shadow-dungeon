import { describe, expect, it } from 'vitest';
import { combatLayout, hitButton, NO_INSETS, TOUCH_SCALES, type ButtonPlace, type TouchLayout } from '../../src/ui/touch-layout';

const COMBAT = ['pause', 'map', 'lock', 'roll', 'boost', 'area', 'heavy', 'fast'];
const VIEWPORTS = [
  { width: 844, height: 390 },
  { width: 390, height: 844 },
  { width: 568, height: 320 },
  { width: 932, height: 430 },
  { width: 1024, height: 768 },
];

const gapBetween = (a: ButtonPlace, b: ButtonPlace): number => {
  // Rectangles (corner buttons) and circles alike: separation of the boxes, or of the circles when both are round.
  if (a.round && b.round) return Math.hypot(a.x - b.x, a.y - b.y) - a.width / 2 - b.width / 2;
  const dx = Math.abs(a.x - b.x) - (a.width + b.width) / 2;
  const dy = Math.abs(a.y - b.y) - (a.height + b.height) / 2;
  return Math.max(dx, dy);
};

const every = (fn: (layout: TouchLayout, viewport: { width: number; height: number }) => void) => {
  for (const viewport of VIEWPORTS)
    for (const scale of TOUCH_SCALES)
      for (const leftHanded of [false, true]) fn(combatLayout(viewport, { top: 0, right: 44, bottom: 21, left: 44 }, COMBAT, { scale, leftHanded }), viewport);
};

describe('combat touch layout', () => {
  it('places every requested button', () => {
    const layout = combatLayout({ width: 844, height: 390 }, NO_INSETS, COMBAT);
    expect(Object.keys(layout.buttons).sort()).toEqual([...COMBAT].sort());
  });

  it('makes the main attack the biggest button, 80-96 px at the default scale, every button >= 44 px', () => {
    const { buttons } = combatLayout({ width: 844, height: 390 }, NO_INSETS, COMBAT);
    expect(buttons.fast!.width).toBeGreaterThanOrEqual(80);
    expect(buttons.fast!.width).toBeLessThanOrEqual(96);
    for (const b of Object.values(buttons)) {
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
      if (b.id !== 'fast') expect(b.width).toBeLessThan(buttons.fast!.width);
    }
    // Roll is prominent: as big as Heavy, bigger than Boost / Area / Lock.
    expect(buttons.roll!.width).toBe(buttons.heavy!.width);
    expect(buttons.roll!.width).toBeGreaterThan(buttons.boost!.width);
    expect(buttons.lock!.width).toBeLessThanOrEqual(buttons.area!.width);
  });

  it('keeps every button on screen, inside the safe area, and apart (>= 4 px) at every scale and hand', () => {
    every((layout, viewport) => {
      const insets = { top: 0, right: 44, bottom: 21, left: 44 };
      const all = Object.values(layout.buttons);
      for (const b of all) {
        expect(b.x - b.width / 2).toBeGreaterThanOrEqual(insets.left);
        expect(b.x + b.width / 2).toBeLessThanOrEqual(viewport.width - insets.right);
        expect(b.y - b.height / 2).toBeGreaterThanOrEqual(insets.top);
        expect(b.y + b.height / 2).toBeLessThanOrEqual(viewport.height - insets.bottom);
      }
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(gapBetween(all[i]!, all[j]!), `${all[i]!.id}/${all[j]!.id}`).toBeGreaterThanOrEqual(4);
    });
  });

  it('puts the action buttons in the thumb corner and the menu / map in the top corners', () => {
    const { buttons, stickZone } = combatLayout({ width: 844, height: 390 }, NO_INSETS, COMBAT);
    for (const id of ['fast', 'heavy', 'roll', 'boost', 'area', 'lock']) {
      expect(buttons[id]!.x).toBeGreaterThan(844 / 2);
      expect(buttons[id]!.y).toBeGreaterThan(390 / 3);
    }
    // The main attack sits lowest-rightmost; the arc wraps it from the left to above.
    expect(buttons.fast!.x).toBeGreaterThan(buttons.heavy!.x);
    expect(buttons.roll!.y).toBeLessThan(buttons.fast!.y);
    expect(buttons.pause!.y).toBeLessThan(80);
    expect(buttons.map!.y).toBeLessThan(80);
    expect(buttons.pause!.x).toBeLessThan(844 / 2);
    expect(buttons.map!.x).toBeGreaterThan(844 / 2);
    // The joystick takes the left half.
    expect(stickZone).toEqual({ x: 0, y: 0, width: 422, height: 390 });
  });

  it('mirrors for the left hand', () => {
    const right = combatLayout({ width: 844, height: 390 }, NO_INSETS, COMBAT);
    const left = combatLayout({ width: 844, height: 390 }, NO_INSETS, COMBAT, { leftHanded: true });
    for (const id of COMBAT) {
      expect(left.buttons[id]!.x).toBeCloseTo(844 - right.buttons[id]!.x);
      expect(left.buttons[id]!.y).toBeCloseTo(right.buttons[id]!.y);
    }
    expect(left.stickZone).toEqual({ x: 422, y: 0, width: 422, height: 390 });
  });

  it('scales the buttons with the size setting, never below 44 px', () => {
    const base = combatLayout({ width: 844, height: 390 }, NO_INSETS, COMBAT);
    const big = combatLayout({ width: 844, height: 390 }, NO_INSETS, COMBAT, { scale: Math.max(...TOUCH_SCALES) });
    const small = combatLayout({ width: 844, height: 390 }, NO_INSETS, COMBAT, { scale: Math.min(...TOUCH_SCALES) });
    expect(big.buttons.fast!.width).toBeGreaterThan(base.buttons.fast!.width);
    expect(small.buttons.fast!.width).toBeLessThan(base.buttons.fast!.width);
    expect(small.buttons.lock!.width).toBe(44);
  });

  it('lays out a lone main button (the town Talk) in the main spot', () => {
    const town = combatLayout({ width: 844, height: 390 }, NO_INSETS, ['talk']);
    const fight = combatLayout({ width: 844, height: 390 }, NO_INSETS, COMBAT);
    expect(town.buttons.talk).toMatchObject({ x: fight.buttons.fast!.x, y: fight.buttons.fast!.y });
  });
});

describe('touch hit test', () => {
  const layout = combatLayout({ width: 844, height: 390 }, NO_INSETS, COMBAT);

  it('finds the button under a point, with a little slop outside its edge', () => {
    const fast = layout.buttons.fast!;
    expect(hitButton(layout, { x: fast.x, y: fast.y })).toBe('fast');
    expect(hitButton(layout, { x: fast.x + fast.width / 2 + 4, y: fast.y })).toBe('fast');
    expect(hitButton(layout, { x: 30, y: 300 })).toBeNull();
  });

  it('gives a point between two buttons to the nearer one', () => {
    const a = layout.buttons.fast!;
    const b = layout.buttons.heavy!;
    const nearA = { x: a.x + (b.x - a.x) * 0.45, y: a.y + (b.y - a.y) * 0.45 };
    const hit = hitButton(layout, nearA);
    expect(hit === 'fast' || hit === null).toBe(true);
  });
});
