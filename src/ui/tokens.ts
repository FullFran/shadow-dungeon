import type { Rarity } from '../data/items';
import type { PokemonType } from '../data/types';
import type { MoveTier } from '../data/tutor';

/**
 * Design tokens of the Mystery Dungeon-inspired UI, the one place colours,
 * the font and sizes are defined. The DOM gets them as CSS custom properties
 * (`applyTokens`, read by the styles in index.html); the canvas HUD imports
 * them directly. Original palette: deep blue windows with a pale border, a
 * gold cursor and the red of the eclipse as the accent.
 */
export const PALETTE = {
  /** Page background and the darkest outline. */
  ink: '#05060d',
  /** Window fill gradient, top to bottom. */
  windowTop: '#2b4b93',
  windowBottom: '#0f1a45',
  /** Window border and its inner shade line. */
  border: '#e9eefc',
  borderShade: '#6f86c6',
  text: '#f5f7ff',
  textDim: '#aab6dc',
  disabled: '#5e6890',
  /** Cursor ▶ and highlighted values. */
  cursor: '#ffd447',
  /** Eclipse red: titles, warnings, the title backdrop. */
  eclipse: '#e8283a',
  eclipseGlow: '#ff6a3d',
  danger: '#ff6b5e',
  good: '#7fe08a',
  hp: '#5fd36a',
  hpLow: '#ff5a4f',
  stamina: '#ffcf4a',
  xp: '#7fd8ff',
  /** Empty part of a bar. */
  barBack: '#1a1f3c',
} as const;

export const RARITY: Record<Rarity, string> = { common: '#c9d2ee', uncommon: '#5ab0ff', rare: '#ffd447' };

/** Move power tiers (data/tutor.ts): the HUD rank pips; the DOM badges use the same blue and gold (index.html `.tier-badge`). */
export const TIER_COLORS: Record<MoveTier, string> = { basic: '#f5f7ff', advanced: '#8fb3d9', master: '#e0b84f' };

/** Colours of one Pokémon type on the canvas: `core` fill, `glow` halo and highlight, `edge` outline. */
export interface TypeColors {
  core: string;
  glow: string;
  edge: string;
}

/**
 * Attack colours per move type, the one table every player and enemy
 * attack is drawn from (projectiles, swings, rings, dash trails, enemy
 * telegraph tints). Enemy telegraphs keep a red warning edge on top.
 */
export const TYPE_COLORS: Record<PokemonType, TypeColors> = {
  normal: { core: '#f4f1ea', glow: '#ffffff', edge: '#a9a49a' },
  ghost: { core: '#8a5cf0', glow: '#c9b0ff', edge: '#3b1f73' },
  fairy: { core: '#ff8fc8', glow: '#ffd3ec', edge: '#b2457e' },
  dark: { core: '#3a1d52', glow: '#7a43a8', edge: '#e0324a' },
  poison: { core: '#9b4fc9', glow: '#a6e36a', edge: '#4a1f66' },
  steel: { core: '#c8d2dc', glow: '#f2f6fa', edge: '#6d7a88' },
  fire: { core: '#ff7a1f', glow: '#ffd84a', edge: '#c2361a' },
  ground: { core: '#a87a46', glow: '#e6c48e', edge: '#5e3f1e' },
  grass: { core: '#5cc23a', glow: '#b9f28c', edge: '#2a6418' },
  bug: { core: '#b4c228', glow: '#eef59a', edge: '#5d6612' },
  flying: { core: '#8db4f2', glow: '#e0ecff', edge: '#3f5f9e' },
  water: { core: '#3f8ef0', glow: '#a8dcff', edge: '#1c4a96' },
  electric: { core: '#ffd52e', glow: '#fff6a8', edge: '#a87a00' },
  fighting: { core: '#c8432b', glow: '#ffb08a', edge: '#6e1d10' },
  rock: { core: '#b8a07a', glow: '#f0e2c0', edge: '#5c4a2c' },
  psychic: { core: '#ff5f9e', glow: '#ffc2dc', edge: '#9e2457' },
  ice: { core: '#8fe3f0', glow: '#e4fbff', edge: '#3d8a99' },
};

/**
 * Pixelify Sans (SIL OFL 1.1, public/fonts). Its pixel is about 1/11 em, so
 * sizes in multiples of 11 px keep the glyph pixels whole.
 */
export const FONT = {
  family: 'Pixelify Sans',
  stack: '"Pixelify Sans", ui-monospace, monospace',
  /** Canvas HUD text, in view pixels (the canvas scale multiplies it). */
  hudPx: 11,
  /** DOM sizes, px. */
  bodyPx: 22,
  headingPx: 33,
  titlePx: 66,
} as const;

/**
 * Weight of emphasised canvas text. Pixelify Sans' 700 fills the lowercase
 * "e" (its counter shrinks to a dot at any size, playtest 2026-10-26), and the
 * weights between blur the 1-unit pixel strokes, so emphasis keeps the
 * regular 400 and comes from size, colour and the outline instead.
 */
export const EMPHASIS_WEIGHT = 400;

/** Canvas font string in the pixel font (view pixels; `bold` asks for emphasis: `EMPHASIS_WEIGHT`). */
export const canvasFont = (px: number = FONT.hudPx, bold = false): string => `${bold ? `${EMPHASIS_WEIGHT} ` : ''}${px}px "${FONT.family}", monospace`;

/** Window open animation and cursor bob, ms. */
export const MOTION = { openMs: 120, bobMs: 600 } as const;

const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Every token as a CSS custom property (`--md-window-top`, `--md-rarity-rare`, ...). */
export function cssVariables(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(PALETTE)) vars[`--md-${kebab(name)}`] = value;
  for (const [name, value] of Object.entries(RARITY)) vars[`--md-rarity-${name}`] = value;
  vars['--md-font'] = FONT.stack;
  vars['--md-body'] = `${FONT.bodyPx}px`;
  vars['--md-heading'] = `${FONT.headingPx}px`;
  vars['--md-title'] = `${FONT.titlePx}px`;
  vars['--md-open-ms'] = `${MOTION.openMs}ms`;
  vars['--md-bob-ms'] = `${MOTION.bobMs}ms`;
  return vars;
}

/** Writes the tokens onto an element (the document root) so the stylesheet can use them. */
export function applyTokens(target: HTMLElement): void {
  for (const [name, value] of Object.entries(cssVariables())) target.style.setProperty(name, value);
}
