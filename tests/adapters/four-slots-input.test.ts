import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SLOT_KEY_CODES, toPlayerInput, type RawInput } from '../../src/adapters/input';
import { IDLE_TOUCH, mergeInputs, touchToPlayerInput, type TouchAimContext, type TouchFrame } from '../../src/adapters/touch';
import { fitCanvas } from '../../src/adapters/fit';
import { type HudBox, hudRects, hudScaleFor, hudSpace } from '../../src/ui/hud-layout';
import { vec } from '../../src/core/vec';

const view = { x: 0, y: 0, width: 512, height: 320 };
const raw = (overrides: Partial<RawInput> = {}): RawInput => ({ keys: new Set(), buttons: new Set(), mouse: vec(0, 0), rollPressed: false, wheel: 0, ...overrides });

describe('four slots: keyboard', () => {
  it('maps R or 1 to the boost slot and F or 2 to the area slot (key-triggered: no mouse aim)', () => {
    expect(toPlayerInput(raw({ keys: new Set(['KeyR']) }), view, 1).slots).toEqual([false, false, true, false]);
    expect(toPlayerInput(raw({ keys: new Set(['Digit1']) }), view, 1).slots).toEqual([false, false, true, false]);
    expect(toPlayerInput(raw({ keys: new Set(['KeyF']) }), view, 1).slots).toEqual([false, false, false, true]);
    const both = toPlayerInput(raw({ keys: new Set(['Digit2', 'KeyR']) }), view, 1);
    expect(both.slots).toEqual([false, false, true, true]);
    expect(both.slotMouse).toEqual([false, false, false, false]);
  });

  it('always produces four slots, and the new keys clash with no other game key', () => {
    expect(toPlayerInput(raw(), view, 1).slots).toHaveLength(4);
    const taken = ['ShiftLeft', 'ShiftRight', 'Space', 'KeyE', 'KeyQ', 'KeyM', 'Tab', 'Escape', 'F3', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
    for (const code of [...SLOT_KEY_CODES[2]!, ...SLOT_KEY_CODES[3]!]) expect(taken).not.toContain(code);
  });
});

describe('four slots: touch', () => {
  const ctx = (o: Partial<TouchAimContext> = {}): TouchAimContext => ({ view, pixelScale: 2, playerPos: { x: 100, y: 100 }, facing: { x: 1, y: 0 }, enemies: [], lockType: 'toggle', locked: false, autoAim: false, ...o });
  const frame = (o: Partial<TouchFrame> = {}): TouchFrame => ({ ...IDLE_TOUCH, ...o });

  it('the Boost and Area buttons hold slots 3 and 4', () => {
    expect(touchToPlayerInput(frame({ boost: true }), ctx()).slots).toEqual([false, false, true, false]);
    expect(touchToPlayerInput(frame({ area: true }), ctx()).slots).toEqual([false, false, false, true]);
  });

  it('merges an old two-entry input as "not held" for the new slots', () => {
    const keyboard = toPlayerInput(raw({ keys: new Set(['KeyF']) }), view, 1);
    const oldTouch = { ...touchToPlayerInput(IDLE_TOUCH, ctx()), slots: [true, false], slotMouse: [false, false] };
    const merged = mergeInputs(keyboard, oldTouch);
    expect(merged.slots).toEqual([true, false, false, true]);
    expect(merged.slotMouse).toEqual([false, false, false, false]);
  });
});

/** Right/bottom offsets and size (CSS px) of each cluster button, read from index.html. */
function clusterButtons(): Map<string, { right: number; bottom: number; size: number }> {
  const html = readFileSync(join(__dirname, '../../index.html'), 'utf8');
  const px = (rule: string, prop: string) => Number(new RegExp(`(?:^|[\\s;{])${prop}:\\s*(\\d+)(?:px)?`).exec(rule)?.[1] ?? Number.NaN);
  const rule = (selector: string) => new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`).exec(html)?.[1] ?? '';
  const base = px(rule('.touch-button'), 'width');
  const big = px(rule('.touch-button.big'), 'width');
  const small = px(rule('.touch-button.small'), 'width');
  const sizes: Record<string, number> = { fast: big, heavy: big, roll: base, lock: base, boost: small, area: small };
  const out = new Map<string, { right: number; bottom: number; size: number }>();
  for (const id of Object.keys(sizes)) {
    const r = rule(`.touch-${id}`);
    out.set(id, { right: px(r, 'right'), bottom: px(r, 'bottom'), size: sizes[id]! });
  }
  return out;
}

describe('four slots: touch cluster layout (index.html)', () => {
  const buttons = clusterButtons();
  const html = readFileSync(join(__dirname, '../../index.html'), 'utf8');
  const cluster = /\.touch-cluster\s*\{([^}]*)\}/.exec(html)?.[1] ?? '';
  const clusterW = Number(/width:\s*(\d+)px/.exec(cluster)?.[1]);
  const clusterH = Number(/height:\s*(\d+)px/.exec(cluster)?.[1]);

  it('every button is at least 44 px and inside the cluster', () => {
    for (const [id, b] of buttons) {
      expect(b.size, id).toBeGreaterThanOrEqual(44);
      expect(b.right + b.size, id).toBeLessThanOrEqual(clusterW);
      expect(b.bottom + b.size, id).toBeLessThanOrEqual(clusterH);
    }
  });

  it('no two buttons overlap (round buttons as their square boxes)', () => {
    const list = [...buttons];
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const [a, A] = list[i]!;
        const [b, B] = list[j]!;
        const apart = A.right + A.size <= B.right || B.right + B.size <= A.right || A.bottom + A.size <= B.bottom || B.bottom + B.size <= A.bottom;
        expect(apart, `${a} vs ${b}`).toBe(true);
      }
  });

  it('the cluster stays in the right half of an 844x390 phone (the joystick owns the left half)', () => {
    expect(clusterW + 14).toBeLessThanOrEqual(844 / 2);
    expect(clusterH + 14).toBeLessThanOrEqual(390);
  });
});

describe('four slots: HUD windows', () => {
  const overlaps = (a: HudBox, b: HudBox) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

  for (const [w, h, touch] of [
    [1280, 720, false],
    [1920, 1080, false],
    [1024, 640, false],
    [844, 390, true],
  ] as const) {
    it(`four slot windows fit with no overlap at ${w}x${h}${touch ? ' (touch)' : ''}`, () => {
      const fit = fitCanvas(w, h, 512, 320, touch ? 3 : 1, touch);
      const space = hudSpace(512 * fit.pixelScale, 320 * fit.pixelScale, hudScaleFor(w, h, fit.pixelScale, touch));
      const rects = hudRects(space, { chip: true, slots: 4, minimap: { cols: 40, rows: 28 }, touch });
      expect(rects.slots).toHaveLength(4);
      const boxes: [string, HudBox][] = [
        ['status', rects.status],
        ['log', rects.log],
        ['boss', rects.boss],
        ['minimap', rects.minimap!],
        ...rects.slots.map((s, i) => [`slot${i}`, s] as [string, HudBox]),
      ];
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

  // The action buttons (index.html `.touch-cluster`, 14 px from the right and bottom) in the HUD space of a phone: the canvas is centred and 1 HUD px is `css` CSS px.
  const html = readFileSync(join(__dirname, '../../index.html'), 'utf8');
  const clusterRule = /\.touch-cluster\s*\{([^}]*)\}/.exec(html)?.[1] ?? '';
  const clusterW = Number(/width:\s*(\d+)px/.exec(clusterRule)?.[1]);
  const clusterH = Number(/height:\s*(\d+)px/.exec(clusterRule)?.[1]);
  function clusterInHud(w: number, h: number): HudBox {
    const css = Math.min(w / 512, h / 320);
    const left = (w - 512 * css) / 2;
    const top = (h - 320 * css) / 2;
    return { x: (w - 14 - clusterW - left) / css, y: (h - 14 - clusterH - top) / css, width: clusterW / css, height: clusterH / css };
  }

  for (const [w, h] of [[844, 390], [740, 360], [640, 360], [932, 430], [1024, 768], [568, 320]] as const) {
    it(`touch ${w}x${h}: no slot window sits under the action buttons, and none overlaps another panel`, () => {
      const fit = fitCanvas(w, h, 512, 320, 3, true);
      const space = hudSpace(512 * fit.pixelScale, 320 * fit.pixelScale, hudScaleFor(w, h, fit.pixelScale, true));
      for (const [chip, slots] of [[true, 4], [false, 4], [false, 2], [true, 3]] as const) {
        const rects = hudRects(space, { chip, slots, minimap: { cols: 40, rows: 28 }, touch: true });
        const cluster = clusterInHud(w, h);
        for (const [i, slot] of rects.slots.entries()) {
          expect(overlaps(slot, cluster), `slot${i} vs buttons (chip ${chip}, ${slots} slots)`).toBe(false);
          for (const [name, box] of [['status', rects.status], ['log', rects.log], ['boss', rects.boss], ['minimap', rects.minimap!]] as const) expect(overlaps(slot, box), `slot${i} vs ${name}`).toBe(false);
          for (const other of rects.slots.slice(i + 1)) expect(overlaps(slot, other)).toBe(false);
        }
      }
    });
  }

  it('desktop shows the four windows in one compact row', () => {
    const rects = hudRects({ width: 1024, height: 640 }, { chip: false, slots: 4 });
    expect(new Set(rects.slots.map((s) => s.y)).size).toBe(1);
    expect(rects.slots[0]!.width).toBeLessThan(104);
  });
});
