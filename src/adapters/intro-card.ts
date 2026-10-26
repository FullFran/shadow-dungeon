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
  /** Floor 1's lore line, under the subtitle, if the dungeon has one. */
  lore?: string;
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
  ctx.fillRect(0, cy - 26, width, intro.lore ? 64 : 50);
  ctx.globalAlpha = alpha;
  ctx.font = canvasFont(22, true);
  pixelText(ctx, intro.name, width / 2, cy, PALETTE.text, 'center');
  ctx.fillStyle = PALETTE.eclipseGlow;
  const rule = Math.round(Math.min(width - 80, 220) * Math.min(1, alpha * 1.2));
  ctx.fillRect(Math.round(width / 2 - rule / 2), cy + 6, rule, 1);
  ctx.font = canvasFont();
  pixelText(ctx, intro.subtitle, width / 2, cy + 19, PALETTE.textDim, 'center');
  if (intro.lore) {
    // The floor's line comes in a beat later, quieter.
    ctx.globalAlpha = alpha * Math.max(0, Math.min(1, (nowMs - intro.shownAtMs - INTRO.fadeInMs) / INTRO.fadeInMs)) * 0.85;
    pixelText(ctx, intro.lore, width / 2, cy + 33, PALETTE.textDim, 'center');
  }
  ctx.globalAlpha = 1;
}

/**
 * A boss spell card announced on screen. Easy's own cycles keep the strip
 * across the top; a card fight's declaration (`declare`) is a dramatic
 * moment instead ("Touhou inside, souls outside"): the screen darkens a
 * little, the card's name stands big and serious in the middle, and its full
 * Touhou name («Signo X «…»», `title`) sits small above it.
 */
export interface SpellBanner {
  name: string;
  shownAtMs: number;
  /** The full Touhou-style name, small above the big one (a declaration). */
  title?: string;
  declare?: true;
}

/** How long a declaration holds the screen (it lasts about as long as the boss's break). */
export const DECLARE = { fadeInMs: 160, holdMs: 1100, fadeOutMs: 420, dim: 0.32 } as const;

export const declareAlpha = (spell: Pick<SpellBanner, 'shownAtMs'>, nowMs: number): number => fadeAlpha(nowMs - spell.shownAtMs, DECLARE.fadeInMs, DECLARE.holdMs, DECLARE.fadeOutMs);

/** A card's declaration: the darkened screen, the big name and the small Touhou line above it. */
export function drawCardDeclaration(ctx: CanvasRenderingContext2D, spell: SpellBanner, nowMs: number, width: number, height: number): void {
  const alpha = declareAlpha(spell, nowMs);
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha * DECLARE.dim;
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  const cy = Math.round(height * 0.3);
  // The name settles from a little larger, like a seal pressed down.
  const settle = Math.max(0, 1 - (nowMs - spell.shownAtMs) / 260);
  ctx.globalAlpha = alpha;
  if (spell.title) {
    ctx.font = canvasFont();
    pixelText(ctx, spell.title, width / 2, cy - 22, PALETTE.textDim, 'center');
  }
  ctx.font = canvasFont(Math.round(24 + 6 * settle), true);
  pixelText(ctx, spell.name, width / 2, cy, PALETTE.text, 'center');
  ctx.fillStyle = PALETTE.eclipseGlow;
  const rule = Math.round(Math.min(width - 60, 260) * Math.min(1, alpha * 1.3));
  ctx.fillRect(Math.round(width / 2 - rule / 2), cy + 8, rule, 1);
  ctx.globalAlpha = 1;
}

/** A card captured ("¡Técnica dominada!") and what it gave, with a short flourish. */
export interface CaptureNotice {
  shownAtMs: number;
  coins: number;
  heal: number;
}

export const CAPTURE_NOTICE = { fadeInMs: 120, holdMs: 1600, fadeOutMs: 500 } as const;

export function drawCaptureNotice(ctx: CanvasRenderingContext2D, notice: CaptureNotice, nowMs: number, width: number, height: number, title: string, reward: string): void {
  const age = nowMs - notice.shownAtMs;
  const alpha = fadeAlpha(age, CAPTURE_NOTICE.fadeInMs, CAPTURE_NOTICE.holdMs, CAPTURE_NOTICE.fadeOutMs);
  if (alpha <= 0) return;
  const cx = width / 2;
  // Above the next declaration (it follows a broken card at once).
  const cy = Math.round(height * 0.15);
  // The flourish: eight short rays opening out once.
  const burst = Math.min(1, age / 420);
  ctx.globalAlpha = alpha * (1 - burst * 0.7);
  ctx.strokeStyle = PALETTE.cursor;
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    const r0 = 18 + 40 * burst;
    const r1 = r0 + 10;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0 * 2.2, cy - 4 + Math.sin(a) * r0 * 0.6);
    ctx.lineTo(cx + Math.cos(a) * r1 * 2.2, cy - 4 + Math.sin(a) * r1 * 0.6);
    ctx.stroke();
  }
  ctx.globalAlpha = alpha;
  ctx.font = canvasFont(16, true);
  pixelText(ctx, title, cx, cy, PALETTE.cursor, 'center');
  ctx.font = canvasFont();
  pixelText(ctx, reward, cx, cy + 14, PALETTE.text, 'center');
  ctx.globalAlpha = 1;
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
