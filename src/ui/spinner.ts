import '../styles/status.css';

/**
 * The spin loader (.agents/DESIGN.md §4 "Loading"): a pixel eclipse ring whose
 * ember arc chases round it. No card, no word on screen: the accessible name
 * is a visually hidden label on a `role="status"`. Drawn as crisp SVG rects
 * on a 16x16 grid, coloured by the design tokens in status.css; the chase is
 * a per-cell opacity step (no rotated bitmap, so it stays pixel-sharp), and
 * under `prefers-reduced-motion` it becomes a slow opacity pulse.
 */
const GRID = 16;
const INNER = 4.9;
const OUTER = 7.3;

/** The ring's cells, in order round the circle starting at the top. */
export function ringCells(): { x: number; y: number }[] {
  const cells: { x: number; y: number; angle: number }[] = [];
  const centre = (GRID - 1) / 2;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const d = Math.hypot(x - centre, y - centre);
      if (d < INNER || d > OUTER) continue;
      const angle = (Math.atan2(x - centre, centre - y) + Math.PI * 2) % (Math.PI * 2);
      cells.push({ x, y, angle });
    }
  }
  return cells.sort((a, b) => a.angle - b.angle);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface SpinOptions {
  /** The hidden accessible name (i18n); never shown. */
  label: string;
  /** Side in CSS px, a multiple of 16 so the pixels stay whole (default 64). */
  size?: number;
}

export function spinLoader(options: SpinOptions): HTMLElement {
  const size = options.size ?? 64;
  const cells = ringCells();
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${GRID} ${GRID}`);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('spin-ring');
  cells.forEach((cell, i) => {
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(cell.x));
    rect.setAttribute('y', String(cell.y));
    rect.setAttribute('width', '1');
    rect.setAttribute('height', '1');
    rect.style.setProperty('--spin-i', String(i / cells.length));
    svg.append(rect);
  });
  const root = document.createElement('div');
  root.className = 'spin';
  root.setAttribute('role', 'status');
  const hidden = document.createElement('span');
  hidden.className = 'sr-only';
  hidden.textContent = options.label;
  root.append(svg, hidden);
  return root;
}

/** The spin loader centred over the dimmed scene, nothing else (no window): the screen the game shows while something loads. */
export function loadingVeil(label: string): HTMLElement {
  const veil = document.createElement('div');
  veil.className = 'spin-veil';
  veil.append(spinLoader({ label }));
  return veil;
}
