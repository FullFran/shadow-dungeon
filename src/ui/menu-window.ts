import { cursorList } from './cursor-list';
import { description, describedMenu } from './describe';
import { h, mdWindow } from './window';

/** A row of a described menu window: its label, what it does (beside the list), and its action. */
export interface MenuWindowRow {
  label: string;
  about: string;
  onConfirm(): void;
}

export interface MenuWindowOptions {
  title: string;
  /** A line over the list (none when absent). */
  intro?: string;
  rows: readonly MenuWindowRow[];
  /** The last row ("Volver") and Esc. */
  back: { label: string; about: string; onConfirm(): void };
  /** Extra classes of the window (`shop` for the side-by-side touch layout). */
  className?: string;
  initial?: number;
}

/**
 * A menu window built on the shared described menu (src/ui/describe.ts): the
 * rows on the left, what the highlighted one does on the right, in a box
 * whose size never depends on the cursor (fixed geometry,
 * tools/mobile/menu-geometry.mjs). The title's Options and the town's Esc menu.
 */
export function menuWindow(options: MenuWindowOptions): { element: HTMLElement; dispose(): void } {
  const rows = [...options.rows, options.back];
  const about = h('p', { className: 'menu-about' });
  const describe = (index: number) => {
    about.textContent = rows[index]?.about ?? '';
  };
  const list = cursorList({
    items: rows.map((row) => ({ label: row.label, onConfirm: row.onConfirm })),
    initial: options.initial,
    onBack: options.back.onConfirm,
    onCursor: describe,
    label: options.title,
    className: 'shop-list',
  });
  const desc = description(list, { describe, children: [about] });
  desc.update();
  const element = mdWindow({ title: options.title, className: ['shop menu-window', options.className ?? ''].filter(Boolean).join(' ') }, [
    ...(options.intro ? [h('p', { textContent: options.intro })] : []),
    describedMenu(list.element, desc.element),
  ]);
  return { element, dispose: () => list.dispose() };
}
