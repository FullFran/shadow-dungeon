/**
 * Progressive disclosure of the town menu's options (owner, 2026-11-04: "menos opciones de primeras ... que vayan apareciendo
 * todas con el hover"; laws of UX: Hick, Progressive disclosure, Miller). At rest the column is Seguir and four group rows;
 * a group's options appear in place on hover, focus or tap. Pure, so the open/close rules and the key moves are tested
 * (tests/town/menu-disclosure.test.ts); the view only draws what these say.
 */

/** Leaving the column collapses it after this long, so a diagonal mouse move does not flicker. */
export const LEAVE_DELAY_MS = 250;

export interface Timers {
  set(fn: () => void, ms: number): number;
  clear(id: number): void;
}

const realTimers: Timers = { set: (fn, ms) => window.setTimeout(fn, ms), clear: (id) => window.clearTimeout(id) };

export interface Disclosure {
  /** The open group's index, or null. Only one group is ever open. */
  readonly open: number | null;
  /** The mouse is over group `i`'s row: it opens, the previous one swaps out. */
  hover(i: number): void;
  /** The mouse is back inside the column (anything but a group row): a pending collapse is cancelled. */
  enter(): void;
  /** The mouse left the column: it collapses after LEAVE_DELAY_MS. */
  leave(): void;
  /** Keyboard or pad focus landed on group `i` (or inside it), or elsewhere (null): opens or closes at once. */
  focus(i: number | null): void;
  /** A click or tap on group `i`'s row: 'toggle' for touch, 'open' for a mouse (hover already opened it; a click must not close it). */
  activate(i: number, how: 'open' | 'toggle'): void;
  close(): void;
}

export function createDisclosure(onChange: (open: number | null) => void, timers: Timers = realTimers): Disclosure {
  let open: number | null = null;
  let timer: number | null = null;
  const cancel = (): void => {
    if (timer !== null) timers.clear(timer);
    timer = null;
  };
  const set = (next: number | null): void => {
    cancel();
    if (next === open) return;
    open = next;
    onChange(open);
  };
  return {
    get open() {
      return open;
    },
    hover: (i) => set(i),
    enter: cancel,
    leave() {
      cancel();
      if (open !== null) timer = timers.set(() => set(null), LEAVE_DELAY_MS);
    },
    focus: (i) => set(i),
    activate: (i, how) => set(how === 'toggle' && open === i ? null : i),
    close: () => set(null),
  };
}

export type ColumnFocus = { kind: 'primary' } | { kind: 'group'; g: number } | { kind: 'option'; g: number; o: number };
export type ColumnKey = 'up' | 'down' | 'left' | 'right' | 'enter' | 'escape';
export interface ColumnMove {
  /** Where the focus goes. */
  focus?: ColumnFocus;
  /** Which group is open afterwards (only present with `focus`). */
  open?: number | null;
  /** The key is not the column's: the map's spatial move, or closing the menu. */
  pass?: 'spatial' | 'close';
}

/**
 * One key press inside the column. Up/Down walk Seguir and the group rows (landing on a row opens it); Right or Enter on a row
 * opens it and enters it; inside, Up/Down walk the options, Left or Esc go back to the row. An empty result means "stay".
 */
export function columnStep(focus: ColumnFocus, key: ColumnKey, sizes: readonly number[]): ColumnMove {
  if (focus.kind === 'primary') {
    if (key === 'down' && sizes.length > 0) return { focus: { kind: 'group', g: 0 }, open: 0 };
    if (key === 'escape') return { pass: 'close' };
    if (key === 'up' || key === 'left' || key === 'right') return { pass: 'spatial' };
    return {};
  }
  if (focus.kind === 'group') {
    const g = focus.g;
    switch (key) {
      case 'down':
        return g + 1 < sizes.length ? { focus: { kind: 'group', g: g + 1 }, open: g + 1 } : {};
      case 'up':
        return g === 0 ? { focus: { kind: 'primary' }, open: null } : { focus: { kind: 'group', g: g - 1 }, open: g - 1 };
      case 'right':
      case 'enter':
        return (sizes[g] ?? 0) > 0 ? { focus: { kind: 'option', g, o: 0 }, open: g } : {};
      case 'left':
        return { pass: 'spatial' };
      case 'escape':
        return { pass: 'close' };
    }
  }
  const { g, o } = focus as { g: number; o: number };
  switch (key) {
    case 'down':
      return o + 1 < (sizes[g] ?? 0) ? { focus: { kind: 'option', g, o: o + 1 }, open: g } : {};
    case 'up':
      return o > 0 ? { focus: { kind: 'option', g, o: o - 1 }, open: g } : { focus: { kind: 'group', g }, open: g };
    case 'left':
    case 'escape':
      return { focus: { kind: 'group', g }, open: g };
    default:
      return {};
  }
}
