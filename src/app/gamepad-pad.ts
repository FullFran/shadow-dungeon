import { t } from '../i18n';
import { buttonName, GAMEPAD_HELP, type HelpContext, type PadStyle } from './gamepad-help-data';

/**
 * The gamepad drawing of the controls screen (odd/tasks/title-hub.md T11): an original generic
 * pad in inline SVG (no brand art), a callout line from each button, stick or trigger to its
 * action, and the button glyphs of both layouts (A/B/X/Y coloured circles, or cross, circle,
 * square and triangle drawn here). The model (`padCallouts`, `padGlyph`) is pure data so a test
 * can hold it to GAMEPAD_HELP; the builders below only draw it.
 */
export const PAD_STYLES: readonly PadStyle[] = ['xbox', 'playstation'];
export const PAD_VIEW = { x: 36, width: 688, height: 300 } as const;

type Point = readonly [number, number];
type Side = 'left' | 'right';

/** Where a button sits on the drawing, and where its label goes. */
interface Hotspot {
  anchor: Point;
  side: Side;
  labelY: number;
  /** Bends of the leader between the label and the anchor (kept clear of other buttons). */
  via?: readonly Point[];
}

const LEFT_EDGE = 192;
const RIGHT_EDGE = 568;

const HOTSPOTS: Record<string, Hotspot> = {
  lt: { anchor: [252, 54], side: 'left', labelY: 38 },
  lb: { anchor: [244, 86], side: 'left', labelY: 76 },
  x: { anchor: [440, 137], side: 'left', labelY: 110, via: [[440, 110]] },
  leftStick: { anchor: [262, 146], side: 'left', labelY: 152 },
  back: { anchor: [355, 158], side: 'left', labelY: 190, via: [[355, 190]] },
  dpad: { anchor: [297, 208], side: 'left', labelY: 238 },
  start: { anchor: [405, 142], side: 'right', labelY: 20, via: [[405, 20]] },
  rb: { anchor: [516, 86], side: 'right', labelY: 76 },
  y: { anchor: [483, 120], side: 'right', labelY: 114 },
  b: { anchor: [513, 150], side: 'right', labelY: 152 },
  a: { anchor: [483, 180], side: 'right', labelY: 190 },
  rightStick: { anchor: [448, 206], side: 'right', labelY: 232 },
  r3: { anchor: [420, 234], side: 'right', labelY: 272, via: [[420, 272]] },
};

/** The D-pad glyph of the combat help ("◀ ▶") is the same hotspot as the full D-pad. */
const HOTSPOT_OF: Record<string, string> = { dpadSides: 'dpad' };

export interface Callout {
  action: string;
  button: string;
  hotspot: string;
  anchor: Point;
  /** Where the label sits: its side of the pad and the height of its centre. */
  label: { side: Side; y: number };
  via: readonly Point[];
}

/** One callout per (action, button) of a context: the same rows as the legend. */
export function padCallouts(context: HelpContext): Callout[] {
  const out: Callout[] = [];
  for (const row of GAMEPAD_HELP[context]) {
    for (const button of row.buttons) {
      const hotspot = HOTSPOT_OF[button] ?? button;
      const spot = HOTSPOTS[hotspot]!;
      out.push({ action: row.action, button, hotspot, anchor: spot.anchor, label: { side: spot.side, y: spot.labelY }, via: spot.via ?? [] });
    }
  }
  return out;
}

export interface GlyphSpec {
  kind: 'letter' | 'shape' | 'text' | 'stick' | 'dpad';
  /** Width in drawing units (the height is always 28). */
  width: number;
  text?: string;
  shape?: 'cross' | 'circle' | 'square' | 'triangle';
  /** Disc colour (letters) or ink colour (shapes). */
  color?: string;
  arms?: 'sides' | 'all';
}

export const GLYPH_H = 28;
const LETTER_COLORS: Record<string, string> = { a: '#5fcf7c', b: '#ef5a52', x: '#5a9bf0', y: '#f0cd45' };
const SHAPES: Record<string, { shape: NonNullable<GlyphSpec['shape']>; color: string }> = {
  a: { shape: 'cross', color: '#7fb2ff' },
  b: { shape: 'circle', color: '#ff7a85' },
  x: { shape: 'square', color: '#f29be0' },
  y: { shape: 'triangle', color: '#6fe0a8' },
};

/** The glyph of a button for a layout. */
export function padGlyph(button: string, style: PadStyle): GlyphSpec {
  if (button in LETTER_COLORS) {
    return style === 'xbox' ? { kind: 'letter', width: GLYPH_H, text: buttonName(button, style), color: LETTER_COLORS[button] } : { kind: 'shape', width: GLYPH_H, ...SHAPES[button]! };
  }
  if (button === 'leftStick' || button === 'rightStick') return { kind: 'stick', width: GLYPH_H, text: button === 'leftStick' ? 'L' : 'R' };
  if (button === 'dpad' || button === 'dpadSides') return { kind: 'dpad', width: GLYPH_H, arms: button === 'dpad' ? 'all' : 'sides' };
  const text = buttonName(button, style);
  return { kind: 'text', width: text.length > 3 ? 58 : 38, text };
}

const NS = 'http://www.w3.org/2000/svg';
type Attrs = Record<string, string | number>;

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, children: (Node | null)[] = []): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  for (const child of children) if (child) node.append(child);
  return node;
}

const INK = '#140c11';
const GOLD = '#c9a45a';
const EMBER = '#ffbf5e';

/** The glyph as an SVG group, GLYPH_H units tall, at (x, y). */
function glyphGroup(spec: GlyphSpec, x: number, y: number): SVGGElement {
  const g = el('g', { transform: `translate(${x} ${y})`, class: 'pg' });
  const h = GLYPH_H;
  const mid = h / 2;
  if (spec.kind === 'letter') {
    g.append(el('circle', { cx: mid, cy: mid, r: 13, fill: spec.color!, stroke: INK, 'stroke-width': 2 }));
    const text = el('text', { x: mid, y: mid + 6, 'text-anchor': 'middle', class: 'pg-letter', fill: INK });
    text.textContent = spec.text!;
    g.append(text);
  } else if (spec.kind === 'shape') {
    g.append(el('circle', { cx: mid, cy: mid, r: 13, fill: '#241b22', stroke: '#5c4526', 'stroke-width': 2 }));
    const stroke = { fill: 'none', stroke: spec.color!, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    if (spec.shape === 'cross') g.append(el('path', { d: 'M8.5 8.5 L19.5 19.5 M19.5 8.5 L8.5 19.5', ...stroke }));
    if (spec.shape === 'circle') g.append(el('circle', { cx: mid, cy: mid, r: 6, ...stroke }));
    if (spec.shape === 'square') g.append(el('rect', { x: 8.5, y: 8.5, width: 11, height: 11, ...stroke }));
    if (spec.shape === 'triangle') g.append(el('path', { d: 'M14 7.5 L20.5 19.5 L7.5 19.5 Z', ...stroke }));
  } else if (spec.kind === 'text') {
    g.append(el('rect', { x: 1, y: 3, width: spec.width - 2, height: h - 6, rx: 5, fill: '#241b22', stroke: GOLD, 'stroke-width': 2 }));
    const text = el('text', { x: spec.width / 2, y: mid + 5, 'text-anchor': 'middle', class: 'pg-text', fill: '#efe6d6' });
    text.textContent = spec.text!;
    g.append(text);
  } else if (spec.kind === 'stick') {
    g.append(el('circle', { cx: mid, cy: mid, r: 13, fill: '#241b22', stroke: GOLD, 'stroke-width': 2 }), el('circle', { cx: mid, cy: mid, r: 8, fill: 'none', stroke: '#5c4526', 'stroke-width': 2 }));
    const text = el('text', { x: mid, y: mid + 5, 'text-anchor': 'middle', class: 'pg-text', fill: '#efe6d6' });
    text.textContent = spec.text!;
    g.append(text);
  } else {
    g.append(el('path', { d: 'M10 2 h8 v8 h8 v8 h-8 v8 h-8 v-8 h-8 v-8 h8 z', fill: '#241b22', stroke: GOLD, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    const arms = { left: 'M4.5 14 L9 10.5 L9 17.5 Z', right: 'M23.5 14 L19 10.5 L19 17.5 Z', up: 'M14 4.5 L10.5 9 L17.5 9 Z', down: 'M14 23.5 L10.5 19 L17.5 19 Z' };
    for (const [name, d] of Object.entries(arms)) if (spec.arms === 'all' || name === 'left' || name === 'right') g.append(el('path', { d, fill: EMBER }));
  }
  return g;
}

/** A glyph on its own, for the legend list (decorative: the text next to it names the action). */
export function glyphSvg(button: string, style: PadStyle): SVGSVGElement {
  const spec = padGlyph(button, style);
  const svg = el('svg', { viewBox: `0 0 ${spec.width} ${GLYPH_H}`, width: spec.width, height: GLYPH_H, class: 'pad-glyph', 'aria-hidden': 'true', focusable: 'false' });
  svg.append(glyphGroup(spec, 0, 0));
  return svg;
}

const ON = 'pad-part on';
const OFF = 'pad-part';

/** The pad with a labelled leader from every button the context uses. */
export function padSvg(context: HelpContext, style: PadStyle): SVGSVGElement {
  const callouts = padCallouts(context);
  const used = new Set(callouts.map((c) => c.hotspot));
  const cls = (id: string) => (used.has(id) ? ON : OFF);
  const svg = el('svg', { viewBox: `${PAD_VIEW.x} 0 ${PAD_VIEW.width} ${PAD_VIEW.height}`, class: 'pad-svg', role: 'img', 'aria-label': t('controls.padLabel') });

  const defs = el('defs', {}, [
    el('linearGradient', { id: 'pad-body-fill', x1: 0, y1: 0, x2: 0, y2: 1 }, [el('stop', { offset: 0, 'stop-color': '#3a2c34' }), el('stop', { offset: 1, 'stop-color': '#1a1318' })]),
  ]);
  const body = el('path', {
    class: 'pad-body',
    fill: 'url(#pad-body-fill)',
    d: 'M285 98 C340 86 420 86 475 98 C520 104 548 140 556 190 C564 245 556 282 520 284 C492 286 478 266 468 252 C460 240 450 236 432 236 L328 236 C310 236 300 240 292 252 C282 266 268 286 240 284 C204 282 196 245 204 190 C212 140 240 104 285 98 Z',
  });
  const shine = el('path', { class: 'pad-shine', fill: 'none', d: 'M292 106 C340 96 420 96 468 106' });

  // Triggers sit behind the bumpers.
  const parts: SVGElement[] = [
    el('rect', { class: cls('lt'), x: 252, y: 40, width: 60, height: 28, rx: 8 }),
    el('rect', { class: OFF, x: 448, y: 40, width: 60, height: 28, rx: 8 }),
    el('rect', { class: cls('lb'), x: 244, y: 76, width: 80, height: 20, rx: 8 }),
    el('rect', { class: cls('rb'), x: 436, y: 76, width: 80, height: 20, rx: 8 }),
  ];
  const stick = (id: string, cx: number, cy: number) =>
    el('g', { class: cls(id) }, [el('circle', { class: 'pad-well', cx, cy, r: 28 }), el('circle', { class: 'pad-cap', cx, cy, r: 17 }), el('circle', { class: 'pad-cap-dot', cx, cy, r: 6 })]);
  const dpad = el('path', { class: cls('dpad'), d: 'M310 192 h20 v14 h14 v20 h-14 v14 h-20 v-14 h-14 v-20 h14 z', transform: 'translate(0 -8)' });
  const pills = [el('circle', { class: cls('back'), cx: 355, cy: 150, r: 8 }), el('circle', { class: cls('start'), cx: 405, cy: 150, r: 8 })];
  const faceSpots: [string, number, number][] = [['y', 470, 120], ['x', 440, 150], ['b', 500, 150], ['a', 470, 180]];
  const face = faceSpots.map(([id, cx, cy]) => {
    const g = glyphGroup(padGlyph(id, style), cx - 14, cy - 14);
    g.setAttribute('class', `pg ${used.has(id) ? 'on' : 'off'}`);
    return g;
  });

  const leaders: SVGElement[] = [];
  const labels: SVGElement[] = [];
  for (const c of callouts) {
    const spec = padGlyph(c.button, style);
    const edge = c.label.side === 'left' ? LEFT_EDGE : RIGHT_EDGE;
    const points: Point[] = [[edge + (c.label.side === 'left' ? 4 : -4), c.label.y], ...c.via, c.anchor];
    leaders.push(el('polyline', { class: 'pad-leader', points: points.map((p) => p.join(',')).join(' ') }), el('circle', { class: 'pad-dot', cx: c.anchor[0], cy: c.anchor[1], r: 4 }));
    const gx = c.label.side === 'left' ? edge - spec.width : edge;
    const text = el('text', { class: 'pad-label', x: c.label.side === 'left' ? gx - 10 : gx + spec.width + 10, y: c.label.y + 6, 'text-anchor': c.label.side === 'left' ? 'end' : 'start' });
    text.textContent = t(`controls.short.${c.action}`);
    labels.push(glyphGroup(spec, gx, c.label.y - GLYPH_H / 2), text);
  }

  svg.append(defs, ...parts.slice(0, 2), body, shine, ...parts.slice(2), stick('leftStick', 290, 146), stick('rightStick', 420, 206), dpad, ...pills, ...face, ...leaders, ...labels);
  return svg;
}
