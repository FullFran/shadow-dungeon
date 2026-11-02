import { h } from '../ui/window';
import { wheelSector } from './quick-wheel';
import { glyphSvg, type TownMapEntry } from './town-map-view';

/**
 * The quick wheel drawn (odd/tasks/menu-redesign.md S8, S9): a dark ring of
 * seals around a centre that names the pointed service. Hold Tab and point
 * (mouse, arrows, WASD or a stick), release Tab to open it; a click or tap on
 * a seal opens it too; Esc, or releasing Tab on the centre, closes.
 */
export interface QuickWheelOptions {
  entries: readonly TownMapEntry[];
  onClose: () => void;
}

const ARROWS: Record<string, { x: number; y: number }> = {
  ArrowUp: { x: 0, y: -1 },
  KeyW: { x: 0, y: -1 },
  ArrowRight: { x: 1, y: 0 },
  KeyD: { x: 1, y: 0 },
  ArrowDown: { x: 0, y: 1 },
  KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  KeyA: { x: -1, y: 0 },
};

export function quickWheelView(options: QuickWheelOptions): { element: HTMLElement; dispose(): void } {
  const { entries } = options;
  let selected: number | null = null;
  const name = h('strong', { className: 'quick-wheel-name' });
  const about = h('span', { className: 'quick-wheel-about' });
  const centre = h('div', { className: 'quick-wheel-centre' }, [name, about]);
  const seals = entries.map((entry, i) => {
    const turn = i / entries.length;
    const seal = h('button', { className: 'quick-wheel-seal', type: 'button', title: entry.label }, [glyphSvg(entry.glyph)]);
    // On a circle, 0 at the top, clockwise: 42% of the ring's size from its centre.
    seal.style.left = `${50 + Math.sin(turn * 2 * Math.PI) * 40}%`;
    seal.style.top = `${50 - Math.cos(turn * 2 * Math.PI) * 40}%`;
    seal.addEventListener('pointerenter', () => select(i));
    seal.addEventListener('click', () => entry.onConfirm());
    return seal;
  });
  const ring = h('div', { className: 'quick-wheel-ring' }, [centre, ...seals]);
  const element = h('div', { className: 'quick-wheel' }, [ring]);

  function select(i: number | null): void {
    selected = i;
    seals.forEach((s, j) => s.classList.toggle('selected', j === i));
    const entry = i === null ? null : entries[i]!;
    name.textContent = entry?.label ?? '';
    about.textContent = entry?.about ?? '';
  }
  select(null);

  const point = (dir: { x: number; y: number }) => select(wheelSector(dir, entries.length));
  const onMove = (e: PointerEvent) => {
    const box = ring.getBoundingClientRect();
    const r = box.width / 2;
    if (r > 0) point({ x: (e.clientX - box.left - r) / r, y: (e.clientY - box.top - r) / r });
  };
  const onKey = (e: KeyboardEvent) => {
    const dir = ARROWS[e.code];
    if (dir) {
      e.preventDefault();
      point(dir);
    } else if (e.code === 'Escape') {
      e.preventDefault();
      options.onClose();
    } else if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      if (selected !== null) entries[selected]!.onConfirm();
    } else if (e.code === 'Tab') e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code !== 'Tab') return;
    e.preventDefault();
    if (selected !== null) entries[selected]!.onConfirm();
    else options.onClose();
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKeyUp);
  return {
    element,
    dispose: () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    },
  };
}
