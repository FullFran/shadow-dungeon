import { MUSIC_TRACKS, type MusicContext } from '../data/music';
import { pixelText } from '../ui/canvas';
import { canvasFont, PALETTE } from '../ui/tokens';

/**
 * Touhou-style dungeon entry: on floor 1 the dungeon's name and its poetic
 * subtitle rise over the view for a few seconds, and whenever the music
 * changes during a run the track title shows in a corner ("♪ Title").
 * Neither stops the game; both only fade over the view.
 */
export interface DungeonIntro {
  name: string;
  subtitle: string;
  shownAtMs: number;
}

export interface NowPlaying {
  title: string;
  shownAtMs: number;
}

export const INTRO = {
  fadeInMs: 700,
  holdMs: 3200,
  fadeOutMs: 900,
  /** The track note: a little later and a little longer than the name. */
  noteDelayMs: 400,
  noteHoldMs: 4200,
} as const;

/** Fade in, hold, fade out, then 0 for good. */
export function fadeAlpha(ageMs: number, fadeInMs: number, holdMs: number, fadeOutMs: number): number {
  if (ageMs < 0) return 0;
  if (ageMs < fadeInMs) return ageMs / fadeInMs;
  const out = ageMs - fadeInMs - holdMs;
  if (out <= 0) return 1;
  return Math.max(0, 1 - out / fadeOutMs);
}

export const introAlpha = (intro: Pick<DungeonIntro, 'shownAtMs'>, nowMs: number): number =>
  fadeAlpha(nowMs - intro.shownAtMs, INTRO.fadeInMs, INTRO.holdMs, INTRO.fadeOutMs);

export const noteAlpha = (note: Pick<NowPlaying, 'shownAtMs'>, nowMs: number): number =>
  fadeAlpha(nowMs - note.shownAtMs - INTRO.noteDelayMs, INTRO.fadeInMs, INTRO.noteHoldMs, INTRO.fadeOutMs);

/** "♪ <track title>" of a music context, from the licensed music manifest. */
export const trackNote = (context: MusicContext): string => `♪ ${MUSIC_TRACKS[context].title}`;

/** Draws the entry title (view units, pixel scale applied): name large, subtitle under it, a thin rule between. */
export function drawDungeonIntro(ctx: CanvasRenderingContext2D, intro: DungeonIntro, nowMs: number, width: number, height: number): void {
  const alpha = introAlpha(intro, nowMs);
  if (alpha <= 0) return;
  const rise = 6 * (1 - Math.min(1, alpha * 1.5));
  const cy = Math.round(height * 0.36 + rise);
  ctx.globalAlpha = alpha * 0.55;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, cy - 26, width, 50);
  ctx.globalAlpha = alpha;
  ctx.font = canvasFont(22, true);
  pixelText(ctx, intro.name, width / 2, cy, PALETTE.text, 'center');
  ctx.fillStyle = PALETTE.eclipseGlow;
  const rule = Math.round(Math.min(width - 80, 220) * Math.min(1, alpha * 1.2));
  ctx.fillRect(Math.round(width / 2 - rule / 2), cy + 6, rule, 1);
  ctx.font = canvasFont();
  pixelText(ctx, intro.subtitle, width / 2, cy + 19, PALETTE.textDim, 'center');
  ctx.globalAlpha = 1;
}

/** A boss spell card announced on screen (Touhou style): its full name, for a couple of seconds. */
export interface SpellBanner {
  name: string;
  shownAtMs: number;
}

export const SPELL = { fadeInMs: 250, holdMs: 2200, fadeOutMs: 500 } as const;

export const spellAlpha = (spell: Pick<SpellBanner, 'shownAtMs'>, nowMs: number): number =>
  fadeAlpha(nowMs - spell.shownAtMs, SPELL.fadeInMs, SPELL.holdMs, SPELL.fadeOutMs);

/** Draws the spell card name across the top of the view, sliding in from the right. */
export function drawSpellBanner(ctx: CanvasRenderingContext2D, spell: SpellBanner, nowMs: number, width: number): void {
  const alpha = spellAlpha(spell, nowMs);
  if (alpha <= 0) return;
  const slide = Math.round(24 * (1 - Math.min(1, alpha * 1.4)));
  const y = 100;
  ctx.globalAlpha = alpha * 0.7;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, y - 13, width, 19);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = PALETTE.eclipseGlow;
  ctx.fillRect(0, y + 6, width, 1);
  ctx.font = canvasFont();
  pixelText(ctx, spell.name, width / 2 + slide, y, PALETTE.cursor, 'center');
  ctx.globalAlpha = 1;
}

/** Draws "♪ title" at the top right, under the minimap's corner. */
export function drawNowPlaying(ctx: CanvasRenderingContext2D, note: NowPlaying, nowMs: number, width: number, height: number, at?: { x: number; y: number }): void {
  const alpha = noteAlpha(note, nowMs);
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  ctx.font = canvasFont();
  // `at`: left-aligned there (touch: the bottom-right corner belongs to the action buttons).
  if (at) pixelText(ctx, note.title, at.x, at.y, PALETTE.textDim, 'left');
  else pixelText(ctx, note.title, width - 8, height - 46, PALETTE.textDim, 'right');
  ctx.globalAlpha = 1;
}
