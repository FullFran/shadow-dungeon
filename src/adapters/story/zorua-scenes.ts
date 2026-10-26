import { SPECIES } from '../../data/species';
import { SPRITE_KEYS } from '../../data/sprites';
import { hash01 } from '../../ui/eclipse';
import { BLEED, disc, fillAll, glow, gradient, silhouette, STAGE, stars } from '../prologue-scenes';
import { figure, floorBand, GROUND, type SceneDraw } from '../story-scenes';

/**
 * Zorua's tableaux (docs/story-quests.md, La Senda del Reflejo), in the
 * prologue's style: the village fountain where a quiet child's reflection is
 * a fox, the forest path that loops back to the same marked tree, and the
 * grudge's white fog with the pack in it, their backs turned.
 */
const { w: W, h: H } = STAGE;

/** Drifting bands of mist across the stage. */
function mist(ctx: CanvasRenderingContext2D, ms: number, color: string, alpha: number, from: number, rows: number): void {
  for (let i = 0; i < rows; i++) {
    const x = ((ms / (130 + i * 35) + hash01(i + 90) * W) % (W + 200)) - 160;
    const g = ctx.createLinearGradient(x, 0, x + 240, 0);
    g.addColorStop(0, `rgba(${color}, 0)`);
    g.addColorStop(0.5, `rgba(${color}, ${alpha})`);
    g.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x, from + i * 9, 240, 10);
  }
}

/** The fountain: a round basin of still water; on its rim a quiet child (or Zorua); in the water, a fox. */
const fountain: SceneDraw = (ctx, t, panel) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#06060c'], [0.6, '#10121c'], [1, '#000000']]));
  stars(ctx, t.localMs, 0.35, 30, 81);
  floorBand(ctx, '#14141c');
  const cx = W / 2;
  const rim = GROUND - 34;
  const water = { top: rim + 6, height: 22 };
  // The basin, its water and the spout.
  ctx.fillStyle = '#2a2a36';
  ctx.fillRect(cx - 74, rim, 148, 6);
  ctx.fillRect(cx - 74, water.top + water.height, 148, 4);
  ctx.fillStyle = '#0a1420';
  ctx.fillRect(cx - 70, water.top, 140, water.height);
  ctx.fillStyle = '#2a2a36';
  ctx.fillRect(cx - 4, rim - 34, 8, 34);
  ctx.fillRect(cx - 16, rim - 36, 32, 3);
  glow(ctx, cx, water.top + 10, 70, '#8fb4ff', 0.1);
  const sprite = SPRITE_KEYS[SPECIES[panel.figure?.form ?? 'zorua'].sprite];
  const sitter = W * (panel.figure?.x ?? 0.36);
  if (panel.figure) figure(ctx, t, { ...panel, figure: { ...panel.figure, x: panel.figure.x ?? 0.36 } }, '#b4c8ff', 0.35, panel.figure.form ? 1.8 : 2.2, rim + 2);
  else {
    // A quiet child sitting on the rim, hugging its knees, its back to the spout; a rim of light from the water.
    const body = (fill: string, grow: number): void => {
      disc(ctx, sitter, rim - 24, 4 + grow, fill);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(sitter - 5 - grow, rim - 18 - grow);
      ctx.lineTo(sitter + 4 + grow, rim - 18 - grow);
      ctx.lineTo(sitter + 9 + grow, rim + grow);
      ctx.lineTo(sitter - 7 - grow, rim + grow);
      ctx.closePath();
      ctx.fill();
    };
    body('#5a6a90', 1);
    body('#0b0d15', 0);
  }
  // The reflection is always the fox, upside down in the water, wobbling.
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - 70, water.top, 140, water.height);
  ctx.clip();
  ctx.translate(Math.round(Math.sin(t.localMs / 600) * 1), 2 * water.top);
  ctx.scale(1, -1);
  silhouette(ctx, t.sheets, t.localMs, { sprite, anim: 'Idle', row: 0, x: sitter, y: water.top, scale: 1.4, fill: '#05080e', rim: '#7aa0e6', shade: 0.55, alpha: 0.75 });
  ctx.restore();
};

/** The loop: a path that leaves on the right and comes back on the left, round one old tree with claw marks. */
const loop: SceneDraw = (ctx, t, panel) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#04070a'], [0.6, '#0a1410'], [1, '#000000']]));
  // Far trunks.
  for (let i = 0; i < 9; i++) {
    const x = Math.round(hash01(i + 20) * (W + BLEED * 2)) - BLEED;
    ctx.fillStyle = `rgba(20, 34, 28, ${0.6 + hash01(i + 30) * 0.4})`;
    ctx.fillRect(x, 0, 6 + Math.round(hash01(i + 40) * 6), GROUND);
  }
  floorBand(ctx, '#0e1610');
  // The path: an ellipse of pale earth that closes on itself.
  ctx.strokeStyle = '#3a3a2a';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(W / 2, GROUND + 6, 120, 14, 0, 0, Math.PI * 2);
  ctx.stroke();
  // The same tree, in the middle of the loop, its bark scored all over.
  ctx.fillStyle = '#1c1612';
  ctx.fillRect(W / 2 - 8, GROUND - 70, 16, 74);
  ctx.fillStyle = '#5a4a3a';
  for (let i = 0; i < 12; i++) ctx.fillRect(W / 2 - 6 + (i % 3) * 4, GROUND - 60 + Math.floor(i / 3) * 9, 1, 5);
  mist(ctx, t.localMs, '160, 180, 170', 0.1, GROUND - 30, 4);
  if (panel.figure) figure(ctx, t, { ...panel, figure: { ...panel.figure, x: panel.figure.x ?? 0.7 } }, '#a8d0b8', 0.35, panel.figure.form ? 2 : 2.4);
};

/** The white fog of the grudge: pale trunks, and the pack standing in it with their backs turned. */
const fog: SceneDraw = (ctx, t, panel) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#1a1c22'], [0.6, '#2a2e34'], [1, '#08080a']]));
  for (let i = 0; i < 6; i++) {
    const x = Math.round(hash01(i + 50) * (W + BLEED * 2)) - BLEED;
    ctx.fillStyle = 'rgba(200, 204, 210, 0.12)';
    ctx.fillRect(x, 0, 5, GROUND);
  }
  floorBand(ctx, '#1e2026');
  // The pack, far off, facing away (row 4 is the back), fading in and out of the fog.
  for (let i = 0; i < 4; i++) {
    const fade = 0.25 + 0.2 * Math.sin(t.localMs / 1300 + i * 1.7);
    silhouette(ctx, t.sheets, t.localMs + i * 400, { sprite: SPRITE_KEYS.zoroark, anim: 'Idle', row: 4, x: W * (0.12 + i * 0.24), y: GROUND - 8, scale: 1.3, fill: '#d8dce4', rim: '#ffffff', shade: 1, alpha: Math.max(0, fade) });
  }
  mist(ctx, t.localMs, '230, 232, 236', 0.22, GROUND - 60, 7);
  if (panel.figure) figure(ctx, t, panel, '#f0f2f6', 0.4);
};

export const ZORUA_SCENES = { fountain, loop, fog } as const;
