import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { INTERACT_KEY_CODES, LOCK_KEYS, MAP_KEY, MENU_KEY, MOVE_KEY_CODES, ROLL_KEY, SLOT_KEY_CODES, SPECTATE_KEY, keyLabel } from '../../src/adapters/bindings';
import { toPlayerInput, type RawInput } from '../../src/adapters/input';
import { GAMEPAD_HELP, buttonName, type PadStyle } from '../../src/app/gamepad-help-data';
import { catalog } from '../../src/i18n';
import { vec } from '../../src/core/vec';
import { playViewport } from '../../src/adapters/viewport';
import { HUD_BOX, hudRects, hudScaleFor, hudSpace } from '../../src/ui/hud-layout';
import { HINT_HOLD_MS, createHintFade, hintBand, hintSignature, hintSizes, hintsFor, interactGlyphs, type Hint, type HintContext, type HintId } from '../../src/ui/play-hints-model';

const base: HintContext = { device: 'keyboard', place: 'run', minimap: true, spectating: false, padStyle: 'xbox' };
const ctx = (over: Partial<HintContext> = {}): HintContext => ({ ...base, ...over });
const ids = (hints: Hint[]): HintId[] => hints.map((h) => h.id);
const hint = (hints: Hint[], id: HintId): Hint => hints.find((h) => h.id === id)!;
const codes = (h: Hint): string[] => h.glyphs.map((g) => g.id);

const raw = (keys: string[]): RawInput => ({ keys: new Set(keys), buttons: new Set(), mouse: vec(0, 0), rollPressed: false, wheel: 0 });
const view = { x: 0, y: 0, width: 512, height: 320 };

describe('keyboard hints match the real bindings', () => {
  it('a run shows move, attack, roll, lock, map and menu, six at most', () => {
    const hints = hintsFor(ctx());
    expect(ids(hints)).toEqual(['move', 'attack', 'roll', 'lock', 'map', 'menu']);
    expect(hints.length).toBeLessThanOrEqual(6);
  });

  it('move shows the first key of each side, and each really moves that way', () => {
    const move = hint(hintsFor(ctx()), 'move');
    expect(codes(move)).toEqual([MOVE_KEY_CODES.up[0], MOVE_KEY_CODES.left[0], MOVE_KEY_CODES.down[0], MOVE_KEY_CODES.right[0]]);
    const vectors = codes(move).map((code) => toPlayerInput(raw([code]), view, 1).move);
    expect(vectors).toEqual([vec(0, -1), vec(-1, 0), vec(0, 1), vec(1, 0)]);
    expect(move.glyphs.map((g) => g.label)).toEqual(['W', 'A', 'S', 'D']);
  });

  it('attack shows the slot keys in order, and each really fires its slot', () => {
    const attack = hint(hintsFor(ctx()), 'attack');
    expect(codes(attack)).toEqual(SLOT_KEY_CODES.map((slot) => slot[0]));
    codes(attack).forEach((code, i) => expect(toPlayerInput(raw([code]), view, 1).slots[i], code).toBe(true));
    expect(attack.glyphs.map((g) => g.label)).toEqual(['Q', 'E', 'R', 'F']);
  });

  it('lock shows a key that really locks, roll the roll key, menu and map theirs', () => {
    const hints = hintsFor(ctx());
    expect(toPlayerInput(raw(codes(hint(hints, 'lock'))), view, 1).lock).toBe(true);
    expect(LOCK_KEYS).toContain(codes(hint(hints, 'lock'))[0]);
    expect(codes(hint(hints, 'roll'))).toEqual([ROLL_KEY]);
    expect(codes(hint(hints, 'menu'))).toEqual([MENU_KEY]);
    expect(codes(hint(hints, 'map'))).toEqual([MAP_KEY]);
    expect(hint(hints, 'lock').glyphs[0]!.label).toBe('Shift');
    expect(hint(hints, 'menu').glyphs[0]!.label).toBe('Esc');
  });

  it('the map hint only shows when the floor has a minimap', () => {
    expect(ids(hintsFor(ctx({ minimap: false })))).not.toContain('map');
  });

  it('a fainted co-op player is offered the next teammate instead of the combat keys', () => {
    const hints = hintsFor(ctx({ spectating: true }));
    expect(ids(hints)).toEqual(['next', 'map', 'menu']);
    expect(codes(hint(hints, 'next'))).toEqual([SPECTATE_KEY]);
  });

  it('keycap labels read like the key', () => {
    expect(['KeyW', 'Digit1', 'Space', 'ShiftRight', 'Escape', 'Tab', 'Enter'].map(keyLabel)).toEqual(['W', '1', 'Space', 'Shift', 'Esc', 'Tab', 'Enter']);
  });
});

describe('the town', () => {
  const town = (over: Partial<HintContext> = {}) => hintsFor(ctx({ place: 'town', ...over }));

  it('shows move, the quick wheel and the menu; interact lives in the world tooltip, never in the bar', () => {
    expect(ids(town())).toEqual(['move', 'wheel', 'menu']);
    for (const device of ['keyboard', 'gamepad'] as const) expect(ids(hintsFor(ctx({ device, place: 'town' })))).not.toContain('interact' as HintId);
  });

  it('the interact glyphs are keys the town really answers to, the pad confirm button, and nothing on touch', () => {
    const keyboard = interactGlyphs('keyboard', 'xbox');
    expect(keyboard.map((g) => g.label)).toEqual(['E']);
    for (const g of keyboard) expect(INTERACT_KEY_CODES).toContain(g.id);
    const rows = GAMEPAD_HELP.menus.find((r) => r.action === 'confirm')!;
    expect(interactGlyphs('gamepad', 'xbox').map((g) => g.id)).toEqual(rows.buttons);
    expect(interactGlyphs('gamepad', 'playstation').map((g) => g.label)).toEqual(rows.buttons.map((b) => buttonName(b, 'playstation')));
    expect(interactGlyphs('touch', 'xbox')).toEqual([]);
  });

  it('the town does not offer combat keys', () => {
    expect(ids(town())).not.toContain('attack');
    expect(ids(town())).not.toContain('roll');
  });
});

describe('gamepad hints match the controller help table', () => {
  const rows = (context: 'combat' | 'menus', action: string) => GAMEPAD_HELP[context].find((row) => row.action === action)!;
  const buttons = (h: Hint) => h.glyphs.map((g) => g.id);

  for (const style of ['xbox', 'playstation'] as PadStyle[]) {
    it(`${style}: a run shows the buttons of the combat table`, () => {
      const hints = hintsFor(ctx({ device: 'gamepad', padStyle: style }));
      expect(ids(hints)).toEqual(['move', 'attack', 'roll', 'lock', 'map', 'menu']);
      expect(buttons(hint(hints, 'move'))).toEqual(rows('combat', 'move').buttons);
      expect(buttons(hint(hints, 'attack'))).toEqual(['fast', 'heavy', 'boost', 'area'].map((action) => rows('combat', action).buttons[0]));
      expect(buttons(hint(hints, 'roll'))).toEqual(rows('combat', 'roll').buttons);
      expect(buttons(hint(hints, 'lock'))).toEqual([rows('combat', 'lock').buttons[0]]);
      expect(buttons(hint(hints, 'map'))).toEqual(rows('combat', 'minimap').buttons);
      expect(buttons(hint(hints, 'menu'))).toEqual(rows('combat', 'menu').buttons);
      for (const h of hints) for (const g of h.glyphs) expect(g.label).toBe(buttonName(g.id, style));
    });
  }

  it('labels follow the pad style', () => {
    expect(hint(hintsFor(ctx({ device: 'gamepad', padStyle: 'xbox' })), 'roll').glyphs[0]!.label).toBe('A');
    expect(hint(hintsFor(ctx({ device: 'gamepad', padStyle: 'playstation' })), 'roll').glyphs[0]!.label).toBe('✕');
  });

  it('the town takes back-as-start for the menu and the wheel on the minimap button', () => {
    const hints = hintsFor(ctx({ device: 'gamepad', place: 'town' }));
    expect(ids(hints)).toEqual(['move', 'wheel', 'menu']);
    expect(buttons(hint(hints, 'wheel'))).toEqual(rows('combat', 'minimap').buttons);
    expect(buttons(hint(hints, 'menu'))).toEqual(rows('combat', 'menu').buttons);
  });

  it('a fainted co-op player has no pad button for the next teammate: map and menu only', () => {
    expect(ids(hintsFor(ctx({ device: 'gamepad', spectating: true })))).toEqual(['map', 'menu']);
  });
});

describe('touch', () => {
  it('hides the bar in every context (the touch controls already show their buttons)', () => {
    for (const place of ['run', 'town'] as const) for (const spectating of [false, true]) expect(hintsFor(ctx({ device: 'touch', place, spectating }))).toEqual([]);
  });
});

describe('labels are translated', () => {
  it('every hint of every context has a label in Spanish and English', () => {
    const seen = new Set<string>();
    for (const device of ['keyboard', 'gamepad'] as const)
      for (const place of ['run', 'town'] as const)
        for (const spectating of [false, true]) for (const minimap of [false, true]) for (const h of hintsFor(ctx({ device, place, spectating, minimap }))) seen.add(h.labelKey);
    expect(seen.size).toBeGreaterThanOrEqual(8);
    for (const language of ['es', 'en'] as const) for (const key of seen) expect(catalog(language)[key], `${language} ${key}`).toBeTruthy();
  });
});

describe('fade', () => {
  it('shows for a while after the context changes, hides when idle, and comes back on a change', () => {
    const fade = createHintFade();
    expect(fade.visible(0)).toBe(false);
    fade.touch('run', 1000);
    expect(fade.visible(1000)).toBe(true);
    expect(fade.visible(1000 + HINT_HOLD_MS - 1)).toBe(true);
    fade.touch('run', 1000 + HINT_HOLD_MS - 1);
    expect(fade.visible(1000 + HINT_HOLD_MS + 1)).toBe(false);
    fade.touch('run+interact', 9000);
    expect(fade.visible(9001)).toBe(true);
    expect(fade.visible(9000 + HINT_HOLD_MS + 1)).toBe(false);
  });

  it('the signature changes with the device, the pad style and the hints, not with nothing', () => {
    const a = ctx();
    const sig = (c: HintContext) => hintSignature(c, hintsFor(c));
    expect(sig(a)).toBe(sig(ctx()));
    expect(sig(a)).not.toBe(sig(ctx({ device: 'gamepad' })));
    expect(sig(ctx({ device: 'gamepad' }))).not.toBe(sig(ctx({ device: 'gamepad', padStyle: 'playstation' })));
    expect(sig(a)).not.toBe(sig(ctx({ minimap: false })));
    expect(sig(ctx({ place: 'town' }))).not.toBe(sig(ctx({ place: 'run' })));
  });
});

describe('where the bar sits', () => {
  for (const [w, h] of [[1920, 1080], [1440, 900], [1366, 768], [1280, 720], [1024, 640], [800, 600]] as const) {
    for (const slots of [2, 3, 4]) {
      it(`${w}x${h} with ${slots} slots: the free band at the bottom clears the message log and every slot window`, () => {
        const fit = playViewport(w, h, 1, false);
        const space = hudSpace(fit.viewWidth * fit.pixelScale, fit.viewHeight * fit.pixelScale, hudScaleFor(w, h, fit.pixelScale, false));
        const rects = hudRects(space, { chip: true, slots, minimap: { cols: 40, rows: 28 } });
        const band = hintBand(space, slots);
        expect(band.left).toBeGreaterThanOrEqual(rects.log.x + rects.log.width);
        expect(band.right).toBeLessThanOrEqual(space.width - HUD_BOX.margin);
        for (const slot of rects.slots.filter((s) => s.y + s.height >= space.height - HUD_BOX.margin)) expect(band.right).toBeLessThanOrEqual(slot.x);
        expect(band.bottom).toBe(HUD_BOX.margin);
        expect(band.right).toBeGreaterThan(band.left);
      });
    }
  }
});

/** Owner, 2026-11-04: "más grande las ayudas visuales": keycaps >= 28 px, labels >= 16 px, chips >= 40 px on desktop. */
describe('how big the bar is', () => {
  for (const [w, h] of [[1920, 1080], [1440, 900], [1366, 768], [1280, 720], [1024, 640], [800, 600]] as const) {
    it(`${w}x${h}: keycaps >= 28, labels >= 16, chips >= 40`, () => {
      const size = hintSizes(h);
      expect(size.keycap).toBeGreaterThanOrEqual(28);
      expect(size.label).toBeGreaterThanOrEqual(16);
      expect(size.chip).toBeGreaterThanOrEqual(40);
      expect(size.chip).toBeGreaterThanOrEqual(size.keycap + 8);
    });
  }

  it('shrinks sensibly on a short window and never grows past the tall size', () => {
    const tall = hintSizes(1080);
    const short = hintSizes(430);
    expect(short.chip).toBeLessThan(tall.chip);
    expect(short.keycap).toBeLessThan(tall.keycap);
    expect(short.keycap).toBeGreaterThanOrEqual(20);
    expect(short.label).toBeGreaterThanOrEqual(12);
    expect(hintSizes(2160)).toEqual(tall);
  });

  it('the stylesheet reads the sizes from the variables the DOM sets (no hard 22 px caps)', () => {
    const css = readFileSync(`${new URL('../../', import.meta.url).pathname}src/styles/play-hints.css`, 'utf8');
    expect(css).toContain('var(--ph-chip');
    expect(css).toContain('var(--ph-key');
    expect(css).toContain('var(--ph-label');
  });
});
