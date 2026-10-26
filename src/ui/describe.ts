import { selectable } from './nav';
import type { CursorList } from './cursor-list';
import { h, type Child } from './window';

/**
 * The description of the row under the ▶ cursor, in a box whose size never
 * depends on which row is highlighted. Before, the text under a list grew and
 * shrank with the cursor, the window resized round it and the rows moved under
 * the pointer or the finger, so a tap landed on the wrong row.
 *
 * The box is a one-cell grid: the live description (what the caller writes,
 * the children given here) plus an invisible copy of the description of every
 * row the cursor can stop on, all stacked in that cell. The cell takes the
 * size of the largest one, so the box (and the window round it) keeps its
 * size wherever the cursor goes, at any screen width, with no measuring.
 * The copies are hidden from sight, pointers and screen readers.
 */
export interface Description {
  /** The box (`.md-desc`): put it beside the list with `describedMenu`, or in its own window. */
  element: HTMLElement;
  /** Where the caller's description nodes live. */
  live: HTMLElement;
  /** Describes the row under the cursor (`onCursor` of the list). */
  show(index: number): void;
  /**
   * Rebuilds the reserved size from every selectable row, then describes the
   * row under the cursor. Call it after the rows or their texts change
   * (`setItems`, a purchase, a language change).
   */
  update(): void;
}

export interface DescriptionOptions {
  /** Writes the description of row `index` into the live nodes (also called for rows never shown, to reserve their size). */
  describe(index: number): void;
  /** The live nodes the description writes into. */
  children: Child[];
  className?: string;
}

/** Indices the cursor can stop on (where a description can show). */
export const describedIndices = (list: Pick<CursorList, 'items'>): number[] =>
  list
    .items()
    .map((item, i) => (selectable(item) ? i : -1))
    .filter((i) => i >= 0);

export function description(list: Pick<CursorList, 'items' | 'index'>, options: DescriptionOptions): Description {
  const live = h('div', { className: 'md-desc-live' }, options.children);
  const element = h('div', { className: ['md-desc', options.className ?? ''].filter(Boolean).join(' ') }, [live]);
  const show = (index: number) => options.describe(index);
  return {
    element,
    live,
    show,
    update() {
      const ghosts: HTMLElement[] = [];
      // The row under the cursor last, so the live nodes end up describing it (-1: none, the caller's hint).
      const current = list.index();
      const indices = describedIndices(list).filter((i) => i !== current);
      for (const i of [...indices, current]) {
        options.describe(i);
        ghosts.push(ghost([...live.cloneNode(true).childNodes]));
      }
      element.replaceChildren(live, ...ghosts);
    },
  };
}

/** An invisible copy that only reserves room in a `.md-desc` box (hidden from pointers and screen readers). */
export function ghost(children: Child[]): HTMLElement {
  const node = h('div', { className: 'md-desc-ghost' }, children);
  node.setAttribute('aria-hidden', 'true');
  node.inert = true;
  return node;
}

/** A `.md-desc` box for a description that the cursor does not drive: the live nodes plus the ghosts that reserve its largest state. */
export function reservedBox(live: Child[], ghosts: HTMLElement[]): HTMLElement {
  return h('div', { className: 'md-desc' }, [h('div', { className: 'md-desc-live' }, live), ...ghosts]);
}

/** The list on the left, the description box on the right (under it, fixed in height, on a narrow phone). */
export function describedMenu(list: HTMLElement, desc: HTMLElement, className?: string): HTMLElement {
  return h('div', { className: ['md-menu', className ?? ''].filter(Boolean).join(' ') }, [list, desc]);
}
