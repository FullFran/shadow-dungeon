import type { EnemyState } from '../core/state';
import type { Vec2 } from '../core/vec';
import { PALETTE } from '../ui/tokens';

/**
 * Tu Sombra drawn in code (odd/tasks/tutorial-dungeon.md S4): an original
 * creature, never a Pokémon sheet. A formless mass of ink and smoke that
 * breathes and wavers, wisps curling off its crown, two pale eyes, and the
 * eclipse's ember light along its rim (ui/tokens.ts `PALETTE.eclipse`,
 * `eclipseGlow`). Its wind-up flares the rim and narrows the eyes; a stagger
 * flickers it; once beaten it comes apart upwards like smoke.
 */

/** Ink of the body, darkest at the core. */
const INK = '#07060c';
const INK_EDGE = '#17121f';
/** Pale eyes, a little warm. */
const EYE = '#f2ecdf';

/** A lumpy closed blob around (cx, cy): `lobes` bumps whose size wavers with time. */
function blob(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, lobes: number, wobble: number, timeMs: number, seed: number): void {
  const steps = 28;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const bump = 1 + wobble * Math.sin(a * lobes + timeMs / 420 + seed) + wobble * 0.5 * Math.sin(a * (lobes + 2) - timeMs / 310 + seed * 2);
    // The bottom is flatter and wider: it pools on the ground like spilt ink.
    const pool = Math.sin(a) > 0 ? 1 + 0.18 * Math.sin(a) : 1;
    const x = cx + Math.cos(a) * rx * bump * pool;
    const y = cy + Math.sin(a) * ry * bump * (Math.sin(a) > 0 ? 0.7 : 1);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export interface ShadowLook {
  /** 0..1 through a wind-up (the rim flares), else 0. */
  windup: number;
  /** Striking right now (the mass lunges forward a little). */
  striking: boolean;
  /** Overall opacity (stagger flicker, defeat fade). */
  alpha: number;
  /** Time since it was beaten, or Infinity while it stands. */
  sinceDefeatMs: number;
}

/** What the renderer needs to know of the enemy's moment. */
export function shadowLook(enemy: Pick<EnemyState, 'ai' | 'alive'>, alpha: number, sinceDefeatMs: number): ShadowLook {
  const { mode, modeMs, modeDurationMs } = enemy.ai;
  const windup = enemy.alive && mode === 'telegraph' && modeDurationMs > 0 ? Math.min(1, modeMs / modeDurationMs) : 0;
  return { windup, striking: enemy.alive && mode === 'attack', alpha, sinceDefeatMs };
}

export function drawShadowSelf(ctx: CanvasRenderingContext2D, pos: Vec2, facing: Vec2, radius: number, look: ShadowLook, timeMs: number): void {
  const dissolving = Number.isFinite(look.sinceDefeatMs) ? Math.min(1, look.sinceDefeatMs / 1100) : 0;
  const alpha = look.alpha * (1 - dissolving);
  if (alpha <= 0) return;
  const breath = 1 + 0.06 * Math.sin(timeMs / 520);
  const lean = look.striking ? 5 : 0;
  const cx = pos.x + facing.x * lean;
  // The mass stands on its feet: its middle above the ground point, rising as it dissolves.
  const cy = pos.y - radius * 0.9 - dissolving * 18 + facing.y * lean;
  const rx = radius * 1.15 * breath * (1 + 0.4 * dissolving);
  const ry = radius * 1.35 / breath;

  ctx.save();
  ctx.globalAlpha = alpha;
  // The ember glow under and around it, stronger through a wind-up.
  const glowR = rx * (2 + look.windup * 0.8);
  const glow = ctx.createRadialGradient(cx, cy, rx * 0.4, cx, cy, glowR);
  glow.addColorStop(0, `rgba(255, 106, 61, ${0.18 + 0.32 * look.windup})`);
  glow.addColorStop(1, 'rgba(232, 40, 58, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
  ctx.fill();

  // Smoke wisps curling up from its crown (and pouring off as it comes apart).
  for (let i = 0; i < 4; i++) {
    const phase = ((timeMs / (900 + i * 170) + i * 0.27) % 1 + 1) % 1;
    const wx = cx + Math.sin(timeMs / 380 + i * 1.9) * rx * 0.5 + (i - 1.5) * 4;
    const wy = cy - ry * 0.8 - phase * (16 + dissolving * 30);
    ctx.globalAlpha = alpha * (1 - phase) * 0.55;
    ctx.fillStyle = INK_EDGE;
    ctx.beginPath();
    ctx.arc(wx, wy, 3 + 3 * (1 - phase), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = alpha;

  // The ember rim: the same shape a little larger, behind the body.
  ctx.fillStyle = look.windup > 0 ? PALETTE.eclipseGlow : PALETTE.eclipse;
  ctx.globalAlpha = alpha * (0.45 + 0.5 * look.windup + 0.1 * Math.sin(timeMs / 140));
  blob(ctx, cx, cy, rx + 2, ry + 2, 5, 0.08, timeMs, 1.3);
  ctx.fill();

  // The body: ink, darkest at its heart.
  ctx.globalAlpha = alpha;
  const body = ctx.createRadialGradient(cx, cy - ry * 0.2, 2, cx, cy, Math.max(rx, ry));
  body.addColorStop(0, INK);
  body.addColorStop(1, INK_EDGE);
  ctx.fillStyle = body;
  blob(ctx, cx, cy, rx, ry, 5, 0.08, timeMs, 1.3);
  ctx.fill();

  // Two pale eyes, looking where it faces; they narrow as it winds up and blink now and then.
  const blink = Math.sin(timeMs / 2300) > 0.985 ? 0.15 : 1;
  const narrow = (1 - 0.6 * look.windup) * blink;
  const ex = cx + facing.x * rx * 0.3;
  const ey = cy - ry * 0.2 + facing.y * ry * 0.15;
  const flicker = 0.85 + 0.15 * Math.sin(timeMs / 90);
  ctx.globalAlpha = alpha * flicker;
  ctx.fillStyle = EYE;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(ex + side * rx * 0.32, ey, 2.6, Math.max(0.6, 4 * narrow), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
