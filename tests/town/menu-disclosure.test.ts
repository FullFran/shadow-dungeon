import { describe, expect, it } from 'vitest';
import { catalog } from '../../src/i18n';
import { WORLD } from '../../src/data/world';
import { disclosureLayout, groupOptions, MENU_GROUPS, restColumn, townMenuOptions, type MenuGlyph } from '../../src/town/menu-groups';
import { columnStep, createDisclosure, LEAVE_DELAY_MS, type Timers } from '../../src/town/menu-disclosure';
import { menuGeometry } from '../../src/town/sheet-model';
import { TOWN_SERVICES, type TownService } from '../../src/town/town-menu';
import { GROUP_ICONS } from '../../src/ui/icons/town-map-icons';
import { PIXEL_ICONS } from '../../src/ui/pixel-icons';

const ALL = new Set<TownService>(TOWN_SERVICES);
const VIEWPORTS = [[1920, 1080], [1440, 900], [1366, 768], [1280, 720], [844, 390]] as const;
const glyphs = (): { glyph: MenuGlyph }[] => [...townMenuOptions(ALL).map((s) => ({ glyph: s })), { glyph: 'title' as const }];

/** A manual clock: timers fire only when the test advances it. */
function clock(): Timers & { advance(ms: number): void } {
  let now = 0;
  let next = 1;
  const pending = new Map<number, { at: number; fn: () => void }>();
  return {
    set(fn, ms) {
      pending.set(next, { at: now + ms, fn });
      return next++;
    },
    clear(id) {
      pending.delete(id);
    },
    advance(ms) {
      now += ms;
      for (const [id, t] of [...pending]) if (t.at <= now) {
        pending.delete(id);
        t.fn();
      }
    },
  };
}

describe('the column at rest', () => {
  it('is exactly Seguir and the four group rows, with their counts', () => {
    const rows = restColumn(glyphs());
    expect(rows.map((r) => `${r.kind}:${r.id}`)).toEqual(['primary:resume', 'group:team', 'group:progress', 'group:social', 'group:system']);
    expect(rows.slice(1).every((r) => r.count > 0)).toBe(true);
  });

  it('group counts add up to every option but Seguir', () => {
    const rows = restColumn(glyphs());
    expect(rows.slice(1).reduce((n, r) => n + r.count, 0)).toBe(groupOptions(glyphs()).reduce((n, g) => n + g.options.length, 0));
  });

  it('has an es and en title and summary, and one distinct original icon per group', () => {
    for (const lang of ['es', 'en'] as const) for (const g of MENU_GROUPS) {
      expect(catalog(lang)[g.titleKey], `${lang} ${g.titleKey}`).toBeTruthy();
      expect(catalog(lang)[g.summaryKey], `${lang} ${g.summaryKey}`).toBeTruthy();
    }
    const known = new Set(Object.values(PIXEL_ICONS).map((i) => i.rows.join('')));
    const seen = new Set<string>();
    for (const g of MENU_GROUPS) {
      const icon = GROUP_ICONS[g.id];
      expect(icon.rows, g.id).toHaveLength(16);
      for (const row of icon.rows) expect(row).toHaveLength(16);
      for (const ch of new Set(icon.rows.join('').replaceAll('.', ''))) expect(icon.palette[ch], `${g.id} ${ch}`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(known.has(icon.rows.join('')), g.id).toBe(false);
      seen.add(icon.rows.join(''));
    }
    expect(seen.size).toBe(4);
  });
});

describe('open and close state machine', () => {
  const make = () => {
    const c = clock();
    const log: (number | null)[] = [];
    const d = createDisclosure((o) => log.push(o), c);
    return { c, log, d };
  };

  it('starts closed and opens on hover', () => {
    const { d, log } = make();
    expect(d.open).toBeNull();
    d.hover(1);
    expect(d.open).toBe(1);
    expect(log).toEqual([1]);
  });

  it('keeps one group open at a time: hovering another swaps', () => {
    const { d, log } = make();
    d.hover(0);
    d.hover(2);
    expect(d.open).toBe(2);
    expect(log).toEqual([0, 2]);
  });

  it('collapses only after the leave delay, and re-entering inside it cancels', () => {
    const { d, c } = make();
    expect(LEAVE_DELAY_MS).toBe(250);
    d.hover(1);
    d.leave();
    c.advance(LEAVE_DELAY_MS - 1);
    expect(d.open).toBe(1);
    d.enter();
    c.advance(1000);
    expect(d.open).toBe(1);
    d.leave();
    c.advance(LEAVE_DELAY_MS);
    expect(d.open).toBeNull();
  });

  it('touch toggles: first tap opens, tapping the same row closes, another row swaps', () => {
    const { d } = make();
    d.activate(3, 'toggle');
    expect(d.open).toBe(3);
    d.activate(3, 'toggle');
    expect(d.open).toBeNull();
    d.activate(0, 'toggle');
    d.activate(2, 'toggle');
    expect(d.open).toBe(2);
  });

  it('a mouse click on an already hover-opened row keeps it open', () => {
    const { d } = make();
    d.hover(1);
    d.activate(1, 'open');
    expect(d.open).toBe(1);
  });

  it('keyboard focus on a group opens it at once; focus leaving the groups (Seguir, a pin) closes it', () => {
    const { d } = make();
    d.focus(2);
    expect(d.open).toBe(2);
    d.focus(null);
    expect(d.open).toBeNull();
  });

  it('a pending leave never closes a group that focus opened meanwhile', () => {
    const { d, c } = make();
    d.hover(0);
    d.leave();
    d.focus(3);
    c.advance(1000);
    expect(d.open).toBe(3);
  });

  it('close() shuts it at once and drops the pending timer', () => {
    const { d, c, log } = make();
    d.hover(1);
    d.leave();
    d.close();
    expect(d.open).toBeNull();
    c.advance(1000);
    expect(log).toEqual([1, null]);
  });
});

describe('keyboard and gamepad moves in the column', () => {
  const sizes = [5, 6, 3, 3];

  it('Up/Down walk Seguir and the group rows, opening each group they land on', () => {
    expect(columnStep({ kind: 'primary' }, 'down', sizes)).toEqual({ focus: { kind: 'group', g: 0 }, open: 0 });
    expect(columnStep({ kind: 'group', g: 0 }, 'down', sizes)).toEqual({ focus: { kind: 'group', g: 1 }, open: 1 });
    expect(columnStep({ kind: 'group', g: 1 }, 'up', sizes)).toEqual({ focus: { kind: 'group', g: 0 }, open: 0 });
    expect(columnStep({ kind: 'group', g: 0 }, 'up', sizes)).toEqual({ focus: { kind: 'primary' }, open: null });
    expect(columnStep({ kind: 'group', g: 3 }, 'down', sizes)).toEqual({});
  });

  it('Right or Enter on a group opens it and focuses its first option', () => {
    for (const key of ['right', 'enter'] as const) expect(columnStep({ kind: 'group', g: 2 }, key, sizes)).toEqual({ focus: { kind: 'option', g: 2, o: 0 }, open: 2 });
  });

  it('Up/Down move inside the open group; Up from the first option returns to the group row', () => {
    expect(columnStep({ kind: 'option', g: 1, o: 0 }, 'down', sizes)).toEqual({ focus: { kind: 'option', g: 1, o: 1 }, open: 1 });
    expect(columnStep({ kind: 'option', g: 1, o: 5 }, 'down', sizes)).toEqual({});
    expect(columnStep({ kind: 'option', g: 1, o: 3 }, 'up', sizes)).toEqual({ focus: { kind: 'option', g: 1, o: 2 }, open: 1 });
    expect(columnStep({ kind: 'option', g: 1, o: 0 }, 'up', sizes)).toEqual({ focus: { kind: 'group', g: 1 }, open: 1 });
  });

  it('Left or Esc inside a group returns to its row; Esc on the column closes the menu', () => {
    for (const key of ['left', 'escape'] as const) expect(columnStep({ kind: 'option', g: 0, o: 2 }, key, sizes)).toEqual({ focus: { kind: 'group', g: 0 }, open: 0 });
    expect(columnStep({ kind: 'group', g: 0 }, 'escape', sizes)).toEqual({ pass: 'close' });
    expect(columnStep({ kind: 'primary' }, 'escape', sizes)).toEqual({ pass: 'close' });
  });

  it('Left on a group row and Up on Seguir hand over to the spatial move toward the map pins', () => {
    expect(columnStep({ kind: 'group', g: 1 }, 'left', sizes)).toEqual({ pass: 'spatial' });
    expect(columnStep({ kind: 'primary' }, 'left', sizes)).toEqual({ pass: 'spatial' });
    expect(columnStep({ kind: 'primary' }, 'up', sizes)).toEqual({ pass: 'spatial' });
  });
});

describe('every option stays reachable and the column never scrolls', () => {
  for (const map of Object.values(WORLD)) {
    it(`${map.id}: every option of every group is reachable by Right/Down, and the layout fits at the five sizes`, () => {
      const groups = groupOptions(glyphs());
      const sizes = groups.map((g) => g.options.length);
      expect(sizes).toHaveLength(4);
      // Walk: Seguir, Down x4 to each group row, Right, Down through every option.
      const reached: string[] = [];
      let move = columnStep({ kind: 'primary' }, 'down', sizes);
      for (let g = 0; g < sizes.length; g++) {
        expect(move.focus).toEqual({ kind: 'group', g });
        let opt = columnStep({ kind: 'group', g }, 'right', sizes);
        for (let o = 0; o < sizes[g]!; o++) {
          expect(opt.focus).toEqual({ kind: 'option', g, o });
          reached.push(groups[g]!.options[o]!.glyph);
          opt = columnStep({ kind: 'option', g, o }, 'down', sizes);
        }
        move = columnStep({ kind: 'group', g }, 'down', sizes);
      }
      expect(reached.sort()).toEqual(groups.flatMap((g) => g.options.map((o) => o.glyph)).sort());
      for (const [w, h] of VIEWPORTS) {
        const l = disclosureLayout(sizes, menuGeometry(w, h));
        expect(l.needed, `${w}x${h}`).toBeGreaterThan(0);
        expect(l.needed, `${w}x${h}`).toBeLessThanOrEqual(l.available);
        expect(l.groupRow, `${w}x${h}`).toBeGreaterThanOrEqual(56);
        expect(l.optionRow, `${w}x${h}`).toBeGreaterThanOrEqual(44);
        expect(l.mode).toBe(h <= 520 ? 'tiles' : 'accordion');
      }
    });
  }
});
