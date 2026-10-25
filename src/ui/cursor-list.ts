import { moveCursor, navAction, restoreCursor, selectable, tapAction, type NavItem, type NavLayout } from './nav';
import { h, type Child } from './window';

/**
 * The ▶ cursor menu. Keyboard: up/down or W/S move (left/right and A/D in a
 * horizontal list), left/right adjust a value row, Enter or Space confirm, Esc
 * goes back. Mouse: hovering moves the cursor, a click confirms, the ◀ ▶
 * arrows of a value row adjust it. Only the most recently opened list on the
 * page takes keys, and keys typed into a text field stay there (except up,
 * down and Esc, which leave the field). Rows are buttons, so a confirm is a
 * click and plays the page's menu click sound; cursor moves call the sound
 * hook (`setUiSound`).
 */
export interface ListItem extends NavItem {
  label: Child;
  /** Right-aligned value (settings rows). */
  value?: Child;
  /** Left/right (and the ◀ ▶ arrows) change the value through `onAdjust`. */
  onAdjust?(delta: -1 | 1): void;
  onConfirm?(): void;
  className?: string;
  /** Touch: the first tap only moves the cursor here, a second tap confirms (see `tapAction`). */
  tapToSelect?: boolean;
}

export interface CursorListOptions {
  items: ListItem[];
  layout?: NavLayout;
  initial?: number;
  /** False: mouse only, never takes keys (the shared-run item strip). */
  keyboard?: boolean;
  onBack?(): void;
  /** The cursor moved (e.g. to update a description window). */
  onCursor?(index: number): void;
  label?: string;
  className?: string;
}

export interface CursorList {
  element: HTMLElement;
  index(): number;
  /** Replaces the rows, keeping the cursor where it was when possible. */
  setItems(items: ListItem[]): void;
  dispose(): void;
}

export type UiSound = 'move' | 'back';
let sound: ((kind: UiSound) => void) | null = null;

/** Sound hook for cursor moves and back (the app plays its menu click). */
export function setUiSound(play: ((kind: UiSound) => void) | null): void {
  sound = play;
}

interface Registered {
  element: HTMLElement;
  handle(e: KeyboardEvent): void;
}
const stack: Registered[] = [];
let listening = false;

const editable = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

function onKey(e: KeyboardEvent): void {
  if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return;
  for (let i = stack.length - 1; i >= 0; i--) {
    if (!stack[i]!.element.isConnected) stack.splice(i, 1);
  }
  const top = stack.at(-1);
  if (!top) return;
  if (editable(e.target)) {
    // Typing a room code: W, S, A, D and Space are letters there.
    if (!['ArrowUp', 'ArrowDown', 'Escape'].includes(e.code)) return;
    (e.target as HTMLElement).blur();
    if (e.code === 'Escape') {
      e.preventDefault();
      return;
    }
  }
  top.handle(e);
}

export function cursorList(options: CursorListOptions): CursorList {
  const layout = options.layout ?? 'vertical';
  const element = h('div', { className: ['md-list', layout, options.className ?? ''].filter(Boolean).join(' ') });
  element.setAttribute('role', 'menu');
  if (layout === 'horizontal') element.setAttribute('aria-orientation', 'horizontal');
  if (options.label) element.setAttribute('aria-label', options.label);
  let items: ListItem[] = [];
  let rows: HTMLElement[] = [];
  let index = -1;

  function paint(): void {
    rows.forEach((row, i) => {
      const active = i === index;
      row.classList.toggle('is-active', active);
      if (active) row.setAttribute('aria-current', 'true');
      else row.removeAttribute('aria-current');
    });
  }

  function setIndex(next: number, fromKeyboard: boolean): void {
    if (next < 0 || next === index) return;
    index = next;
    paint();
    sound?.('move');
    options.onCursor?.(index);
    if (fromKeyboard) rows[index]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  function adjust(item: ListItem, delta: -1 | 1): void {
    if (!item.onAdjust || !selectable(item)) return;
    sound?.('move');
    item.onAdjust(delta);
  }

  function rowFor(item: ListItem, i: number): HTMLElement {
    if (item.header) return h('div', { className: 'md-list-header' }, [item.label]);
    const children: Child[] = [h('span', { className: 'md-cursor', textContent: '▶' }), h('span', { className: 'md-label' }, [item.label])];
    if (item.value !== undefined) {
      const value = h('span', { className: 'md-value' }, [item.value]);
      if (item.onAdjust) {
        const arrow = (text: string, delta: -1 | 1) => {
          const node = h('span', { className: 'md-arrow', textContent: text });
          node.setAttribute('aria-hidden', 'true');
          node.addEventListener('click', (e) => {
            e.stopPropagation();
            setIndex(i, false);
            adjust(item, delta);
          });
          return node;
        };
        value.prepend(arrow('◀', -1));
        value.append(arrow('▶', 1));
      }
      children.push(value);
    }
    const row = h('button', { type: 'button', className: ['md-item', item.className ?? '', item.disabled ? 'is-disabled' : ''].filter(Boolean).join(' ') }, children);
    row.tabIndex = -1;
    row.setAttribute('role', 'menuitem');
    if (item.disabled) row.setAttribute('aria-disabled', 'true');
    // The pointer pressed on this row for the coming click (null: a keyboard confirm, or a click pressed elsewhere).
    let pressedBy: string | null = null;
    row.addEventListener('pointerdown', (e) => {
      pressedBy = e.pointerType;
    });
    row.addEventListener('pointerenter', (e) => {
      // A finger "enters" right before it taps: let the click decide for tap-to-select rows.
      if (item.tapToSelect && e.pointerType === 'touch') return;
      if (selectable(item)) setIndex(i, false);
    });
    row.addEventListener('click', (e) => {
      const by = pressedBy;
      pressedBy = null;
      if (!selectable(item)) return;
      const wasActive = index === i;
      setIndex(i, false);
      // detail 0: the keyboard confirm's row.click(); otherwise a real pointer click.
      if (tapAction({ tapToSelect: item.tapToSelect ?? false, wasActive, pressedBy: by, pointerClick: e.detail > 0 }) === 'select') return;
      if (item.onConfirm) item.onConfirm();
      else adjust(item, 1);
    });
    return row;
  }

  function setItems(next: ListItem[]): void {
    const keep = items.length === 0 ? (options.initial ?? 0) : index;
    items = next;
    rows = items.map(rowFor);
    element.replaceChildren(...rows);
    index = restoreCursor(items, keep);
    paint();
  }

  function handle(e: KeyboardEvent): void {
    const action = navAction(e.code, layout);
    if (!action) return;
    const item = items[index];
    if (action === 'prev' || action === 'next') setIndex(moveCursor(items, index, action === 'prev' ? -1 : 1), true);
    else if (action === 'left' || action === 'right') {
      if (item) adjust(item, action === 'left' ? -1 : 1);
    } else if (action === 'confirm') {
      if (e.repeat || !item || !selectable(item)) return;
      rows[index]?.click();
    } else if (action === 'back') {
      if (!options.onBack) return;
      sound?.('back');
      options.onBack();
    }
    e.preventDefault();
  }

  setItems(options.items);
  const registered: Registered = { element, handle };
  if (options.keyboard !== false) {
    stack.push(registered);
    if (!listening) {
      window.addEventListener('keydown', onKey);
      listening = true;
    }
  }
  return {
    element,
    index: () => index,
    setItems,
    dispose() {
      const at = stack.indexOf(registered);
      if (at >= 0) stack.splice(at, 1);
    },
  };
}
