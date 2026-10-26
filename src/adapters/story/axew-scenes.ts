import { SPRITE_KEYS } from '../../data/sprites';
import { drawEclipse, hash01 } from '../../ui/eclipse';
import { BLEED, disc, embers, fillAll, glow, gradient, silhouette, STAGE, stars, type SceneTime } from '../prologue-scenes';
import { figure, floorBand, GROUND, type SceneDraw } from '../story-scenes';

/**
 * Axew's tableaux (docs/story-quests.md, La Senda del Colmillo): a tusk
 * regrowing through a crack of light, the old tree of the ravine scored with
 * marks too high, and the burning sky the elders went into.
 */
const { w: W, h: H } = STAGE;

/** A crack of light in dark rock, and in it a tusk that grows back slowly over the beat. */
const crack: SceneDraw = (ctx, t, panel) => {
  fillAll(ctx, '#030204');
  // The rock face.
  ctx.fillStyle = '#100c0e';
  ctx.fillRect(-BLEED, -BLEED, W + BLEED * 2, H + BLEED * 2);
  // The crack: a jagged seam of light down the middle.
  const cx = W / 2;
  glow(ctx, cx, H / 2, 90, '#fff0c8', 0.18);
  ctx.fillStyle = '#fff4d8';
  let x = cx;
  for (let y = -BLEED; y < H + BLEED; y += 6) {
    x = cx + Math.round(Math.sin(y * 0.21) * 5 + (hash01(y + 400) - 0.5) * 3);
    ctx.fillRect(x - 1, y, 2 + Math.round(hash01(y + 401)), 6);
  }
  // The tusk: a pale wedge growing out of the crack into the light.
  const grow = Math.min(1, t.localMs / 6000);
  const len = Math.round(8 + 26 * grow);
  ctx.fillStyle = '#e8e2d0';
  for (let i = 0; i < len; i++) {
    const w = Math.max(1, Math.round(6 * (1 - i / (len + 4))));
    ctx.fillRect(cx + 2 + i, H / 2 + 6 - Math.round(i * 0.5) - Math.floor(w / 2), 1, w);
  }
  ctx.fillStyle = '#b8a888';
  ctx.fillRect(cx + 1, H / 2 + 2, 2, 8);
  embers(ctx, t.localMs, 8, 0.2, ['#fff4d8', '#ffd890']);
  figure(ctx, t, panel, '#fff0c8', 0.3);
};


/** The old tree of the ravine: a broad trunk scored with claw marks far too high, its roots torn at the foot. */
const tree: SceneDraw = (ctx, t, panel) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#06080c'], [0.6, '#141a16'], [1, '#000000']]));
  stars(ctx, t.localMs, 0.2, 24, 83);
  floorBand(ctx, '#18140e');
  const tx = W * 0.62;
  // Trunk and crown.
  ctx.fillStyle = '#2a1e16';
  ctx.fillRect(tx - 18, -BLEED, 36, GROUND + BLEED);
  ctx.fillStyle = '#1a2416';
  for (let i = 0; i < 7; i++) disc(ctx, tx - 50 + i * 17, -6 + Math.round(hash01(i + 60) * 18), 22, '#121a10');
  // The roots at the foot, some torn and pointing up.
  ctx.fillStyle = '#2a1e16';
  ctx.fillRect(tx - 34, GROUND - 4, 16, 4);
  ctx.fillRect(tx + 18, GROUND - 4, 18, 4);
  ctx.fillRect(tx - 30, GROUND - 12, 3, 8);
  ctx.fillRect(tx + 30, GROUND - 14, 3, 10);
  // The marks: three deep ones high up, and a hundred small furious ones low down.
  glow(ctx, tx, 36, 30, '#ffe0a0', 0.1);
  ctx.fillStyle = '#c8a878';
  for (let i = 0; i < 3; i++) for (let k = 0; k < 9; k++) ctx.fillRect(tx - 10 + i * 8 + Math.round(k * 0.4), 22 + k * 3, 2, 3);
  ctx.fillStyle = '#7a5c40';
  for (let i = 0; i < 18; i++) ctx.fillRect(Math.round(tx - 14 + hash01(i + 70) * 26), Math.round(GROUND - 30 + hash01(i + 71) * 18), 1, 4);
  if (panel.figure) figure(ctx, t, { ...panel, figure: { ...panel.figure, x: panel.figure.x ?? 0.4 } }, '#ffd8a0', 0.3);
};


/** A sky on fire: the red ring over a burning horizon, the elders as far shapes against it (or the figure alone). */
const burning: SceneDraw = (ctx, t, panel) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#1a0204'], [0.45, '#6a140e'], [0.75, '#e0581c'], [1, '#2a0804']]));
  drawEclipse(ctx, W * 0.5, 38, 15, 0.9 + 0.1 * Math.sin(t.localMs / 900), W + BLEED, H + BLEED);
  // The ravine's rim, black against the fire.
  ctx.fillStyle = '#080204';
  ctx.beginPath();
  ctx.moveTo(-BLEED, GROUND - 10);
  for (let x = -BLEED; x <= W + BLEED; x += 16) ctx.lineTo(x, GROUND - 10 - Math.round(hash01(x + 900) * 8));
  ctx.lineTo(W + BLEED, H + BLEED);
  ctx.lineTo(-BLEED, H + BLEED);
  ctx.fill();
  if (panel.figure) figure(ctx, t, panel, '#ff8a3a', 0.85, 2.8);
  else {
    for (const [x, scale] of [[0.3, 1.5], [0.5, 1.8], [0.68, 1.5]] as const) {
      silhouette(ctx, t.sheets, t.localMs, { sprite: SPRITE_KEYS.haxorus, anim: 'Walk', row: 4, x: W * x, y: GROUND - 10, scale, fill: '#080204', rim: '#ff8a3a' });
    }
  }
  embers(ctx, t.localMs, 30, 0.6, ['#ffd06a', '#ff5a2a']);
};

export const AXEW_SCENES = { crack, tree, burning } as const;
