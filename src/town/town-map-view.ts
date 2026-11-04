import type { WorldMap } from '../data/world';
import { t } from '../i18n';
import '../styles/town-map.css';
import { SEAL_BACKING, YOU_ARE_HERE } from '../ui/icons/town-map-icons';
import { PIXEL_ICONS, pixelIconSvg, pixelSvgOf, type PixelIconId } from '../ui/pixel-icons';
import { h } from '../ui/window';
import { groupOptions, optionsLayout, type MenuGlyph, type OptionsLayout } from './menu-groups';
import { cartoucheRect, menuGeometry, placeCard, sheetFit, SHEET_MARGIN, TILE_ART } from './sheet-model';
import { paintTownSheet } from './sheet-paint';
import { stepMarker, type TownMapMarker } from './town-map';
import type { TownService } from './town-menu';

/**
 * The town's Esc menu as an aged parchment map with its options beside it (owner, 2026-11-04: "un mapa que se vea completo lo máximo
 * posible, bien detallado tipo pixel art ... envejecido, roto irregularmente por los alrededores ... al hacer hover por los sitios te
 * muestra qué hay ahí, y a la derecha todas las opciones ... estructuradas"; .agents/DESIGN.md §4 "Town map menu").
 * Left: the whole town painted once (src/town/sheet-paint.ts) at the largest crisp scale, service pins as wax seals, a place card
 * anchored to the chosen pin. Right: "Seguir" (the one ember) and the other options in groups (src/town/menu-groups.ts).
 * Arrows, WASD or a stick (the gamepad sends arrow keys) move spatially between every pin and option; Enter opens; Esc closes. A mouse
 * hover shows a pin's card; on touch the first tap shows it and the second opens. Options open on one tap.
 */
export interface TownMapEntry {
  id: string;
  label: string;
  about: string;
  /** The glyph drawn on the pin or the row. */
  glyph: Glyph;
  /** Who keeps the service (an NPC or a place name): the second line of a pin's card. */
  who?: string;
  /** Something new behind it (real unseen content only): a blood pip. */
  badge?: boolean;
  onConfirm: () => void;
}

export type Glyph = MenuGlyph;

export interface TownMapViewOptions {
  /** The town's name, written on the map's ribbon. */
  heading: string;
  map: WorldMap;
  /** The markers on the map, each with its entry (same order). */
  placed: readonly (TownMapMarker & { entry: TownMapEntry })[];
  /** The options beside the map (the services no pin opens, the leaving rows), grouped by `groupOptions`. */
  options: readonly TownMapEntry[];
  /** "Seguir": closes the menu. */
  primary: TownMapEntry;
  /** Where the player stands, in tiles: the "you are here" cross. */
  player?: { x: number; y: number };
  onClose: () => void;
}

/** Original line glyphs, 16x16 viewBox (no art from other games): the fallback for a glyph with no pixel icon. */
const GLYPHS: Record<Glyph, string> = {
  shop: 'M3 6h10l-1 8H4zM6 6a2 2 0 0 1 4 0',
  tutor: 'M3 13l7-7 3 3-7 7H3zM10 6l2-2 3 3-2 2',
  gacha: 'M8 2l1.8 4.2L14 7l-3.2 3 .8 4.5L8 12.3 4.4 14.5l.8-4.5L2 7l4.2-.8z',
  evolve: 'M11 2a6 6 0 1 0 3 10 5 5 0 1 1-3-10z',
  dungeons: 'M8 2l5 5-5 7-5-7z',
  challenges: 'M8 2l5 5-5 7-5-7zM8 6v4',
  travel: 'M2 8h12M10 4l4 4-4 4',
  board: 'M3 3h10v8H3zM5 6h6M5 8h4M8 11v3',
  shrine: 'M2 5h12M4 5v9M12 5v9M3 3l5-1 5 1',
  online: 'M8 2c2 3-2 4 0 7 1-1 1-2 3-3 0 4-1 8-3 8s-4-2-4-5c0-3 3-4 4-7z',
  pokemon: 'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM2 8h12M8 6.5a1.5 1.5 0 1 0 0 3',
  achievements: 'M5 2h6v4a3 3 0 0 1-6 0zM8 9v3M5 14h6',
  gallery: 'M2 4h12v9H2zM2 11l4-4 3 3 2-2 3 3',
  friends: 'M5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM1 13c0-3 8-3 8 0M7 13c0-3 8-3 8 0',
  account: 'M8 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 15c0-4 12-4 12 0',
  settings: 'M8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3',
  controls: 'M2 6h12v6H2zM5 9h2M6 8v2M10 9h.5M12 9h.5',
  title: 'M3 2h7v12H3zM10 8h4M12 6l2 2-2 2',
  resume: 'M5 3l8 5-8 5z',
  room: 'M2 7l6-5 6 5v7H2zM6 14v-4h4v4',
};

/**
 * A service's icon: the colour pixel icon of src/ui/pixel-icons.ts ("iconos custom iguales en cada menú"); `GLYPHS` stays as
 * the line fallback only for a glyph with no pixel icon.
 */
export function glyphSvg(glyph: Glyph): SVGSVGElement {
  if (glyph in PIXEL_ICONS) return pixelIconSvg(glyph as PixelIconId, 'px-icon glyph');
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', GLYPHS[glyph]);
  svg.append(path);
  return svg;
}

/** The painted map as an offscreen canvas of art pixels: one `putImageData`, painted once per open and never again. */
function paintArt(map: WorldMap): HTMLCanvasElement {
  const pixels = paintTownSheet(map);
  const art = document.createElement('canvas');
  art.width = pixels.w;
  art.height = pixels.h;
  art.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(pixels.data), pixels.w, pixels.h), 0, 0);
  return art;
}

const DIRS: Record<string, { x: number; y: number }> = {
  ArrowLeft: { x: -1, y: 0 },
  KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyD: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  KeyS: { x: 0, y: 1 },
};

const isTouch = (): boolean => document.documentElement.classList.contains('touch') || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);

export function townMapView(options: TownMapViewOptions): { element: HTMLElement; dispose(): void } {
  const { map, placed, primary } = options;
  const cols = Math.max(...map.rows.map((r) => r.length));
  const rows = map.rows.length;
  const artW = cols * TILE_ART + 2 * SHEET_MARGIN;
  const artH = rows * TILE_ART + 2 * SHEET_MARGIN;
  const artX = (tileX: number): number => SHEET_MARGIN + tileX * TILE_ART;

  // ---- the map: canvas, ribbon text, the cross, the pins and the card
  const art = paintArt(map);
  const canvas = h('canvas', { className: 'tm-canvas' }) as HTMLCanvasElement;
  canvas.setAttribute('aria-hidden', 'true');
  // The art is blown up by whole pixels (nearest) to the next whole scale; a fractional scale then only shrinks that smoothly by CSS,
  // so the pixels stay even instead of alternating 3 and 4 wide. A whole scale shows the canvas 1:1, crisp.
  let shownFactor = 0;
  const showAt = (scale: number): void => {
    const factor = Math.max(1, Math.ceil(scale));
    if (factor !== shownFactor) {
      shownFactor = factor;
      canvas.width = art.width * factor;
      canvas.height = art.height * factor;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(art, 0, 0, canvas.width, canvas.height);
      }
    }
    canvas.style.imageRendering = Number.isInteger(scale) ? 'pixelated' : 'auto';
  };
  showAt(1);
  const title = h('h2', { className: 'tm-title', textContent: options.heading });
  const here = options.player ? h('span', { className: 'tm-here', title: t('townMenu.here') }, [pixelSvgOf(YOU_ARE_HERE, 'px-icon')]) : null;
  if (here && options.player) {
    here.style.left = `${(artX(options.player.x) / artW) * 100}%`;
    here.style.top = `${(artX(options.player.y) / artH) * 100}%`;
  }
  const pins = placed.map((m) => {
    const seal = h('span', { className: 'tm-seal' }, [pixelSvgOf(SEAL_BACKING, 'px-icon'), glyphSvg(m.entry.glyph)]);
    seal.lastElementChild?.classList.add('tm-glyph');
    const pin = h('button', { className: 'tm-pin', type: 'button' }, [seal, ...(m.entry.badge ? [h('span', { className: 'tm-badge' })] : [])]);
    pin.setAttribute('aria-label', `${m.entry.label}. ${m.entry.who ?? ''} ${m.entry.about}`.replace(/\s+/g, ' ').trim());
    pin.style.left = `${(artX(m.x) / artW) * 100}%`;
    pin.style.top = `${(artX(m.y) / artH) * 100}%`;
    return pin;
  });
  const sheet = h('div', { className: 'tm-sheet' }, [canvas, title, ...(here ? [here] : []), ...pins]);
  const cardChip = h('span', { className: 'tm-chip' });
  const cardName = h('h3', { className: 'tm-card-name' });
  const cardWho = h('span', { className: 'tm-card-who' });
  const cardAbout = h('p', { className: 'tm-card-about' });
  const cardFoot = h('div', { className: 'tm-card-foot' });
  const card = h('div', { className: 'tm-card' }, [h('div', { className: 'tm-card-head' }, [cardChip, h('div', {}, [cardName, cardWho])]), cardAbout, cardFoot]);
  card.hidden = true;
  card.setAttribute('role', 'status');
  const area = h('div', { className: 'tm-map-area' }, [sheet, card]);
  area.setAttribute('role', 'group');
  area.setAttribute('aria-label', t('townMenu.map.label').replace('{name}', options.heading));

  // ---- the options: "Seguir" first, then the groups (built once; the layout only moves them)
  const optionButton = (entry: TownMapEntry, className: string): HTMLButtonElement => {
    const icon = h('span', { className: 'tm-icon' }, [glyphSvg(entry.glyph), ...(entry.badge ? [h('span', { className: 'tm-badge' })] : [])]);
    const text = h('span', { className: 'tm-text' }, [h('strong', { className: 'tm-label', textContent: entry.label }), h('small', { className: 'tm-about', textContent: entry.about })]);
    const button = h('button', { className: className, type: 'button', title: entry.about }, [icon, text]);
    return button;
  };
  const primaryButton = optionButton(primary, 'tm-primary');
  const groups = groupOptions(options.options);
  const groupNodes = groups.map((g) => {
    const rowsEl = h('div', { className: 'tm-rows' }, g.options.map((o) => optionButton(o, 'tm-opt')));
    return h('section', { className: 'tm-group' }, [h('h3', { className: 'tm-group-title', textContent: t(g.titleKey) }), rowsEl]);
  });
  const optionEntries = groups.flatMap((g) => g.options);
  const optionButtons = groupNodes.flatMap((n) => [...n.querySelectorAll<HTMLButtonElement>('.tm-opt')]);
  const groupsEl = h('div', { className: 'tm-groups' });
  const optionsEl = h('nav', { className: 'tm-options' }, [primaryButton, groupsEl]);
  optionsEl.setAttribute('aria-label', t('townMenu.options.label'));

  // Every focusable thing in one list: pins, then "Seguir", then the options.
  const items: HTMLButtonElement[] = [...pins, primaryButton, ...optionButtons];
  const entries: TownMapEntry[] = [...placed.map((m) => m.entry), primary, ...optionEntries];
  const pinCount = pins.length;

  const element = h('div', { className: 'md-window town-map tm-panel' }, [area, optionsEl]);
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-label', t('townMenu.heading'));

  // ---- layout: the scale of the map and the mode of the options, from the real room
  let fit = sheetFit(cols, rows, 1, 1);
  let offset = { x: 0, y: 0 };
  let appliedKey = '';
  function layout(): void {
    const aw = area.clientWidth;
    const ah = area.clientHeight;
    if (aw === 0 || ah === 0) return;
    fit = sheetFit(cols, rows, aw, ah);
    showAt(fit.scale);
    offset = { x: (aw - fit.width) / 2, y: (ah - fit.height) / 2 };
    Object.assign(sheet.style, { left: `${offset.x}px`, top: `${offset.y}px`, width: `${fit.width}px`, height: `${fit.height}px` });
    const c = cartoucheRect(artW);
    Object.assign(title.style, { left: `${(c.x / artW) * 100}%`, top: `${(c.y / artH) * 100}%`, width: `${(c.w / artW) * 100}%`, height: `${(c.h / artH) * 100}%`, fontSize: `${Math.max(11, Math.min(24, Math.round(c.h * fit.scale * 0.5)))}px` });
    const layoutNow = optionsLayout(groups.map((g) => g.options.length), menuGeometry(window.innerWidth, window.innerHeight));
    applyOptions(layoutNow);
    placeCardFor(index);
  }
  /** The window's geometry (src/town/sheet-model.ts): the options column's width and the mode its groups are laid out in. */
  function applyGeometry(): void {
    const geo = menuGeometry(window.innerWidth, window.innerHeight);
    element.style.setProperty('--tm-opt-w', `px`);
    applyOptions(optionsLayout(groups.map((g) => g.options.length), geo));
  }
  function applyOptions(l: OptionsLayout): void {
    const key = `${l.mode}:${l.gridCols}:${l.columns.map((c) => c.join(',')).join('|')}`;
    optionsEl.dataset.mode = l.mode;
    if (l.mode === 'grid') {
      optionsEl.style.setProperty('--tm-cols', String(l.gridCols));
      optionsEl.style.setProperty('--tm-tile', l.gridCols === 3 ? '72px' : '64px');
    }
    if (key === appliedKey) return;
    appliedKey = key;
    groupsEl.replaceChildren(...l.columns.map((col) => h('div', { className: 'tm-col' }, col.map((i) => groupNodes[i]!))));
  }

  // ---- selection and the card
  let index = 0;
  function fillCard(entry: TownMapEntry): void {
    cardChip.replaceChildren(glyphSvg(entry.glyph));
    cardName.textContent = entry.label;
    cardWho.textContent = entry.who ?? '';
    cardWho.hidden = !entry.who;
    cardAbout.textContent = entry.about;
    cardFoot.replaceChildren(
      entry.badge ? h('span', { className: 'tm-card-new', textContent: t('townMenu.card.new') }) : h('span'),
      isTouch() ? h('span', { textContent: t('townMenu.card.tap') }) : h('span', {}, [h('kbd', { textContent: 'Enter' }), document.createTextNode(` ${t('townMenu.card.open')}`)]),
    );
  }
  function placeCardFor(i: number): void {
    if (i >= pinCount || card.hidden) return;
    const m = placed[i]!;
    const anchor = { x: offset.x + (artX(m.x) / artW) * fit.width, y: offset.y + (artX(m.y) / artH) * fit.height };
    const spot = placeCard(anchor, { w: card.offsetWidth, h: card.offsetHeight }, { w: area.clientWidth, h: area.clientHeight }, 34);
    card.style.left = `${spot.x}px`;
    card.style.top = `${spot.y}px`;
    card.style.setProperty('--tm-arrow', `${Math.max(14, Math.min(card.offsetWidth - 14, spot.arrowX))}px`);
    card.dataset.side = spot.side;
  }
  function select(i: number, focus = true): void {
    index = i;
    items.forEach((b, j) => b.classList.toggle('is-active', j === i));
    if (focus && document.activeElement !== items[i]) items[i]!.focus({ preventScroll: true });
    if (i < pinCount) {
      fillCard(entries[i]!);
      card.hidden = false;
      // Restart the small rise on every new pin.
      card.style.animation = 'none';
      void card.offsetWidth;
      card.style.animation = '';
      placeCardFor(i);
    } else card.hidden = true;
  }
  function confirm(i: number): void {
    entries[i]!.onConfirm();
  }
  items.forEach((button, i) => {
    // Pressing focuses the button (and selects it) before the click arrives, so "was it already chosen?" is read at the press.
    let chosenAtPress = false;
    button.addEventListener('pointerdown', () => {
      chosenAtPress = index === i;
    });
    button.addEventListener('click', (e) => {
      // A pin shows its card first on touch (no hover there): the second tap opens. Options open on one tap; Enter on a focused button always acts.
      if (i < pinCount && e.detail > 0 && !chosenAtPress) select(i);
      else confirm(i);
      chosenAtPress = false;
    });
    button.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse' && index !== i) select(i);
    });
    button.addEventListener('focus', () => {
      if (index !== i) select(i, false);
    });
  });

  // The pin nearest the player first (its card already open), else "Seguir".
  const start = (): number => {
    if (!options.player || pinCount === 0) return pinCount;
    let best = 0;
    let bestD = Infinity;
    placed.forEach((m, i) => {
      const d = Math.hypot(m.x - options.player!.x, m.y - options.player!.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  };

  const onKey = (e: KeyboardEvent): void => {
    const dir = DIRS[e.code];
    if (dir) {
      e.preventDefault();
      // Spatial: the nearest item within 60 degrees of the direction, measured on screen (pins and rows share one space).
      const centres: TownMapMarker[] = items.map((b, i) => {
        const r = b.getBoundingClientRect();
        return { id: String(i), service: 'shop' as TownService, x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      const next = stepMarker(centres, index, dir);
      if (next !== index) select(next);
    } else if (e.code === 'Tab') {
      e.preventDefault();
      select((index + (e.shiftKey ? items.length - 1 : 1)) % items.length);
    } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'NumpadEnter') {
      // A focused button answers its own Enter (a click); only when focus is elsewhere does the cursor confirm.
      if (!items.includes(document.activeElement as HTMLButtonElement)) {
        e.preventDefault();
        confirm(index);
      }
    } else if (e.code === 'Escape') {
      e.preventDefault();
      options.onClose();
    }
  };
  window.addEventListener('keydown', onKey);

  // The first layout needs the element in the page: the observer fires once it is, and again on every resize.
  let observer: ResizeObserver | null = null;
  const onResize = (): void => layout();
  if (typeof ResizeObserver === 'function') {
    observer = new ResizeObserver(onResize);
    observer.observe(area);
  } else window.addEventListener('resize', onResize);
  applyOptions(optionsLayout(groups.map((g) => g.options.length), menuGeometry(window.innerWidth, window.innerHeight)));
  index = start();
  items.forEach((b, j) => b.classList.toggle('is-active', j === index));
  if (index < pinCount) {
    fillCard(entries[index]!);
    card.hidden = false;
  }
  requestAnimationFrame(() => {
    layout();
    items[index]?.focus({ preventScroll: true });
  });

  return {
    element,
    dispose: () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
    },
  };
}
