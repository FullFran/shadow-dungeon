import { hash01 } from '../../ui/eclipse';
import { BLEED, disc, fillAll, glow, gradient, STAGE, stars, type SceneTime } from '../prologue-scenes';
import { figure, GROUND, type SceneDraw } from '../story-scenes';

/**
 * Piplup's tableaux (docs/story-quests.md, La Senda del Lago Helado): the
 * ice shelf at dusk with a refused berry, the dusk sea with a lone figure
 * facing it, and the dark water under the ice where something gleams.
 */
const { w: W, h: H } = STAGE;

/** The ice shelf at dusk: a pale floe with a crack, the cold sky over it, a berry left on the ice. */
const ice: SceneDraw = (ctx, t, panel) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#1a2440'], [0.55, '#6a5878'], [0.75, '#c08a78'], [1, '#2a3044']]));
  stars(ctx, t.localMs, 0.25, 30, 61);
  // The shelf.
  ctx.fillStyle = gradient(ctx, GROUND - 8, H + BLEED, [[0, '#b4c8da'], [0.12, '#5c7290'], [0.4, '#222c40'], [1, '#0c1018']]);
  ctx.fillRect(-BLEED, GROUND - 8, W + BLEED * 2, H);
  ctx.fillStyle = '#e8f2fa';
  ctx.fillRect(-BLEED, GROUND - 8, W + BLEED * 2, 1);
  // A crack running across it.
  ctx.fillStyle = '#4a6078';
  let cx = W * 0.15;
  for (let i = 0; i < 14; i++) {
    const y = GROUND - 2 + Math.round(Math.sin(i * 1.7) * 3);
    ctx.fillRect(Math.round(cx), y, 6, 1);
    cx += 5 + hash01(i + 77) * 4;
  }
  // The berry, glinting.
  const bx = W * 0.3;
  disc(ctx, bx, GROUND - 6, 3, '#c83a5a');
  ctx.fillStyle = '#3c7a3a';
  ctx.fillRect(bx - 1, GROUND - 10, 2, 2);
  ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + 0.5 * Math.sin(t.localMs / 500)})`;
  ctx.fillRect(bx - 1, GROUND - 8, 1, 1);
  // Snow drifting.
  for (let i = 0; i < 26; i++) {
    const y = ((hash01(i + 300) * H + t.localMs * (0.008 + hash01(i + 301) * 0.01)) % (H + 20)) - 10;
    ctx.fillStyle = 'rgba(240, 246, 255, 0.6)';
    ctx.fillRect(Math.round(hash01(i + 302) * W + Math.sin(t.localMs / 900 + i) * 4), Math.round(y), 1, 1);
  }
  if (panel.figure) figure(ctx, t, { ...panel, figure: { ...panel.figure, x: panel.figure.x ?? 0.58 } }, '#ffe2c8', 0.15);
};


/** The dusk sea: a low sun in the water, its long road of light, a figure on the shore facing it. */
const sea: SceneDraw = (ctx, t, panel) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#2a2a52'], [0.45, '#b8687a'], [0.62, '#f0a868'], [1, '#30304a']]));
  const horizon = GROUND - 30;
  glow(ctx, W / 2, horizon, 80, 'rgba(255, 220, 160, 0.9)', 0.5);
  disc(ctx, W / 2, horizon, 12, '#ffd68a');
  ctx.fillStyle = gradient(ctx, horizon, H + BLEED, [[0, '#6a5a7a'], [0.5, '#2c3050'], [1, '#0a0c18']]);
  ctx.fillRect(-BLEED, horizon, W + BLEED * 2, H);
  // The road of light on the water, broken by slow swell.
  for (let i = 0; i < 12; i++) {
    const wobble = Math.round(Math.sin(t.localMs / 600 + i * 0.9) * 3);
    ctx.fillStyle = `rgba(255, 214, 150, ${0.5 - i * 0.035})`;
    ctx.fillRect(W / 2 - 10 + i + wobble, horizon + 3 + i * 3, 20 - i * 2 + i * 3, 1);
  }
  // The shore under the figure.
  ctx.fillStyle = '#141420';
  ctx.fillRect(-BLEED, GROUND - 2, W + BLEED * 2, H);
  if (panel.figure) figure(ctx, t, panel, '#ffcf98', 0.25);
};


/** Under the ice: dark water, the hole of light far above, bubbles, something faint shining further down. */
const underice: SceneDraw = (ctx, t, panel) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#1c3a56'], [0.3, '#0a1a2c'], [1, '#000208']]));
  // The ceiling of ice and the hole in it.
  ctx.fillStyle = '#9ab8d0';
  ctx.fillRect(-BLEED, -BLEED, W + BLEED * 2, BLEED + 16);
  ctx.fillStyle = '#0a1a2c';
  ctx.fillRect(W * 0.42, 6, W * 0.16, 10);
  glow(ctx, W / 2, 10, 70, '#d8ecff', 0.35);
  // Shafts of light from the hole.
  ctx.fillStyle = 'rgba(200, 228, 255, 0.07)';
  ctx.beginPath();
  ctx.moveTo(W * 0.42, 16);
  ctx.lineTo(W * 0.58, 16);
  ctx.lineTo(W * 0.7, H);
  ctx.lineTo(W * 0.3, H);
  ctx.fill();
  // Far below, the glow that calls.
  const lure = 0.5 + 0.5 * Math.sin(t.localMs / 700);
  glow(ctx, W * 0.7, H - 6, 30, '#ffe680', 0.15 + 0.15 * lure);
  disc(ctx, W * 0.7, H - 6, 1.5, `rgba(255, 240, 160, ${0.5 + 0.5 * lure})`);
  // Bubbles going up.
  for (let i = 0; i < 12; i++) {
    const y = H - (((t.localMs / (25 + hash01(i + 5) * 20)) + hash01(i) * H) % (H - 10));
    ctx.fillStyle = 'rgba(200, 230, 255, 0.5)';
    ctx.fillRect(Math.round(W * 0.44 + hash01(i + 3) * W * 0.12 + Math.sin(y / 9) * 2), Math.round(y), 1, 1);
  }
  if (!panel.figure) return;
  // The figure sinks slowly, or hangs there, its back to the light.
  const sinking = panel.figure.anim === 'Hurt' ? Math.min(14, t.localMs / 400) : 0;
  ctx.save();
  ctx.translate(0, -40 + sinking);
  figure(ctx, t, panel, '#a8d0ff', 0.3);
  ctx.restore();
};


export const PIPLUP_SCENES = { ice, sea, underice } as const;
