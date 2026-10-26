import { hash01 } from '../../ui/eclipse';
import { BLEED, fillAll, glow, gradient, STAGE, type SceneTime } from '../prologue-scenes';
import { figure, floorBand, GROUND, type SceneDraw } from '../story-scenes';

/**
 * Abra's tableaux (docs/story-quests.md, La Senda del Sueño): the moss bed
 * where it sleeps (and vanishes, a teleport's shimmer), a bent spoon in a
 * cone of pale light, and the boy who woke up as Kadabra.
 */
const { w: W, h: H } = STAGE;

/** Abra's bed: a nook of moss in the dark, a slow dream of motes above whoever sleeps there. */
const sleep: SceneDraw = (ctx, t, panel) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#04030a'], [0.6, '#120c22'], [1, '#000000']]));
  floorBand(ctx, '#16201a');
  // The moss pillow.
  ctx.fillStyle = '#2f4a2c';
  ctx.beginPath();
  ctx.ellipse(W / 2, GROUND + 2, 34, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3e6136';
  ctx.beginPath();
  ctx.ellipse(W / 2 - 4, GROUND, 22, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  glow(ctx, W / 2, GROUND - 26, 70, '#c9a6ff', 0.14 + 0.05 * Math.sin(t.localMs / 900));
  // The dream: motes that rise and fade above the sleeper.
  for (let i = 0; i < 10; i++) {
    const phase = ((t.localMs / 3000) + hash01(i + 5)) % 1;
    ctx.fillStyle = `rgba(214, 190, 255, ${(1 - phase) * 0.7})`;
    ctx.fillRect(Math.round(W / 2 - 18 + hash01(i + 8) * 36 + Math.sin(phase * 6 + i) * 3), Math.round(GROUND - 30 - phase * 50), 1, 1);
  }
  figure(ctx, t, panel, '#c9a6ff', 0.3, 2.4);
};


/** A small spoon bent at the neck, lying in a cone of pale light. */
const spoon: SceneDraw = (ctx, t, panel) => {
  fillAll(ctx, '#020205');
  floorBand(ctx, '#121018');
  const sx = W * (panel.figure ? 0.62 : 0.5);
  // The cone of light from above.
  const cone = ctx.createLinearGradient(0, -BLEED, 0, GROUND);
  cone.addColorStop(0, 'rgba(220, 220, 255, 0)');
  cone.addColorStop(1, 'rgba(220, 220, 255, 0.12)');
  ctx.fillStyle = cone;
  ctx.beginPath();
  ctx.moveTo(sx - 6, -BLEED);
  ctx.lineTo(sx + 6, -BLEED);
  ctx.lineTo(sx + 40, GROUND);
  ctx.lineTo(sx - 40, GROUND);
  ctx.fill();
  glow(ctx, sx, GROUND - 4, 40, '#e8e8ff', 0.2);
  // The bowl lies flat; the handle rises from a bend at the neck, trembling a little.
  const tremble = Math.round(Math.sin(t.localMs / 140) * 0.6);
  ctx.fillStyle = '#c8ccd8';
  ctx.beginPath();
  ctx.ellipse(sx - 8, GROUND - 3, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(sx - 3, GROUND - 4, 5, 2);
  ctx.fillRect(sx + 2 + tremble, GROUND - 10, 2, 6);
  ctx.fillRect(sx + 3 + tremble, GROUND - 16, 2, 6);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(sx - 10, GROUND - 5, 2, 1);
  figure(ctx, t, panel, '#d8c8ff', 0.25);
};


/** A boy's shape that wavers and comes apart into the figure (Kadabra) over the beat. */
const boy: SceneDraw = (ctx, t, panel) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#000000'], [0.6, '#160e1e'], [1, '#000000']]));
  floorBand(ctx, '#1a1222');
  glow(ctx, W / 2, GROUND - 28, 90, '#ffd27a', 0.12);
  const melt = Math.min(1, Math.max(0, (t.localMs - 1500) / 4000));
  // The boy: a narrow dark shape, a spoon held out, breaking into rising flecks as it melts.
  ctx.globalAlpha = 1 - melt;
  ctx.fillStyle = '#0a0710';
  const bx = W / 2;
  ctx.fillRect(bx - 5, GROUND - 46, 10, 10); // head
  ctx.fillRect(bx - 7, GROUND - 36, 14, 20); // body
  ctx.fillRect(bx - 6, GROUND - 16, 4, 16); // legs
  ctx.fillRect(bx + 2, GROUND - 16, 4, 16);
  ctx.fillRect(bx + 7, GROUND - 32, 8, 3); // arm out
  ctx.fillStyle = '#c8ccd8';
  ctx.fillRect(bx + 15, GROUND - 36, 2, 7); // the spoon
  ctx.globalAlpha = 1;
  for (let i = 0; i < 24; i++) {
    const rise = melt * (20 + hash01(i + 3) * 30);
    ctx.fillStyle = `rgba(255, 214, 140, ${melt * (1 - melt) * 2 * hash01(i + 9)})`;
    ctx.fillRect(Math.round(bx - 8 + hash01(i + 1) * 16), Math.round(GROUND - 4 - hash01(i + 2) * 44 - rise), 1, 1);
  }
  if (!panel.figure) return;
  ctx.save();
  ctx.globalAlpha = melt;
  figure(ctx, t, panel, '#ffd27a', 0.15);
  ctx.restore();
};


export const ABRA_SCENES = { sleep, spoon, boy } as const;
