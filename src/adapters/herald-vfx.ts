import { emitContext, heraldCard, heraldOf } from '../core/herald/brain';
import { laneCentre, laneDirection, laserLines } from '../core/herald/patterns';
import type { EnemyState, WorldState } from '../core/state';
import type { Vec2 } from '../core/vec';
import type { HeraldDef, HeraldLayer } from '../data/herald';
import { SPRITE_KEYS, SPRITES } from '../data/sprites';
import { heraldWear } from '../core/herald/generate';

/**
 * How a Herald of the Eclipse reads on screen (core/herald), from the
 * snapshot fields only (guests see it too): a glow in its type's colour
 * under it, the wind-up ring closing on it, the aim line to the mark, the
 * safe lane of a wall, the gap of a closing ring, the laser warning lines
 * before they fire (thin, then bright), and its awakening. Its burning
 * pockets use the shared positional telegraph (core/victim.ts `pierceZone`).
 */
const DEG = Math.PI / 180;

const rgba = (hex: string, a: number): string => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/** The boss bar line of a herald: its name and the card in play of its count (the notches and the clock are every card boss's: core/boss.ts `bossBar`). */
export function heraldBarText(state: WorldState, enemyId: string): { label: string; colour: string; cards: number } | null {
  const enemy = state.enemies.find((e) => e.id === enemyId);
  if (!enemy?.herald || !enemy.boss) return null;
  const def = heraldOf(state, enemy);
  if (!def) return null;
  const index = Math.min(def.cards.length, enemy.boss.combosDone + 1);
  return { label: `${def.name} · ${index}/${def.cards.length}`, colour: def.theme.colour, cards: def.cards.length };
}

/** Draw scale of a herald's sheets: small sheets twice their size, so every herald stands out as a boss. */
export function heraldScale(enemy: Pick<EnemyState, 'herald'>): number {
  if (!enemy.herald) return 1;
  const key = (SPRITE_KEYS as Record<string, string>)[heraldWear(enemy.herald.seed).sprite];
  const idle = key ? SPRITES.sprites[key]?.anims.Idle : undefined;
  return idle && idle.frameWidth <= 32 ? 2 : 1;
}

function ring(ctx: CanvasRenderingContext2D, pos: Vec2, radius: number, colour: string, width: number): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function line(ctx: CanvasRenderingContext2D, from: Vec2, dir: Vec2, length: number, colour: string, width: number): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(from.x + dir.x * length, from.y + dir.y * length);
  ctx.stroke();
}

/** Laser warnings of the attack in progress (or the first volley, during the wind-up). */
function laserWarnings(ctx: CanvasRenderingContext2D, state: WorldState, enemy: EnemyState, layer: Extract<HeraldLayer, { kind: 'laser' }>, pos: Vec2, colour: string): void {
  const t = enemy.ai.mode === 'attack' ? enemy.ai.modeMs : enemy.ai.modeMs - enemy.ai.modeDurationMs;
  const ctxEmit = { ...emitContext(state, enemy), origin: pos };
  const reach = Math.hypot(state.arena.width, state.arena.height);
  for (let v = 0; v < layer.volleys; v++) {
    const warnAt = layer.startMs + v * layer.everyMs;
    const fireAt = warnAt + layer.warnMs;
    if (t < warnAt - (enemy.ai.mode === 'telegraph' ? enemy.ai.modeDurationMs : 0) || t > fireAt + layer.fireMs) continue;
    const firing = t >= fireAt;
    const k = Math.max(0, Math.min(1, (t - warnAt) / layer.warnMs));
    for (const dir of laserLines(layer, ctxEmit, v)) line(ctx, pos, dir, reach, firing ? rgba(colour, 0.9) : rgba(colour, 0.25 + 0.45 * k), firing ? 3 : 1);
  }
}

/** Ground telegraphs of a herald, under everything. */
export function drawHerald(ctx: CanvasRenderingContext2D, state: WorldState, enemy: EnemyState, def: HeraldDef, pos: Vec2, timeMs: number): void {
  const { ai } = enemy;
  const colour = def.theme.colour;
  // Its glow, breathing.
  const g = ctx.createRadialGradient(pos.x, pos.y, 2, pos.x, pos.y, enemy.radius * 3);
  g.addColorStop(0, rgba(def.theme.glow, 0.45 + 0.15 * Math.sin(timeMs / 400)));
  g.addColorStop(1, rgba(def.theme.glow, 0));
  ctx.fillStyle = g;
  ctx.fillRect(pos.x - enemy.radius * 3, pos.y - enemy.radius * 3, enemy.radius * 6, enemy.radius * 6);
  const progress = ai.modeDurationMs > 0 ? Math.min(1, ai.modeMs / ai.modeDurationMs) : 1;
  if (ai.mode === 'transform') {
    for (const phase of [0, 0.5]) ring(ctx, pos, enemy.radius + 8 + 110 * ((progress + phase) % 1), rgba(colour, 0.85), 3);
    return;
  }
  const card = heraldCard(def, enemy.boss?.stance);
  if (!card || (ai.mode !== 'telegraph' && ai.mode !== 'attack')) return;
  const winding = ai.mode === 'telegraph';
  if (winding) ring(ctx, pos, enemy.radius + 6 + 30 * (1 - progress), rgba(colour, 0.9), 2);
  const mark = ai.aimPoint;
  for (const layer of card.layers) {
    if (layer.kind === 'laser') {
      laserWarnings(ctx, state, enemy, layer, pos, colour);
      continue;
    }
    if (!winding || !mark) continue;
    const aimed = layer.kind === 'stream' || ((layer.kind === 'ring' || layer.kind === 'wave' || layer.kind === 'scatter') && layer.aim === 'aimed');
    if (aimed) {
      const d = { x: mark.x - pos.x, y: mark.y - pos.y };
      const len = Math.hypot(d.x, d.y) || 1;
      ctx.setLineDash([4, 6]);
      line(ctx, pos, { x: d.x / len, y: d.y / len }, len, rgba(colour, 0.5), 1);
      ctx.setLineDash([]);
    }
    if (layer.kind === 'lanes') {
      // The wall's edge and its safe lane at the mark.
      const dir = laneDirection(layer, { mark, arena: state.arena });
      const span = layer.flip ? state.arena.height : state.arena.width;
      const centre = laneCentre(span, layer.flip ? mark.y : mark.x, layer.gapWidth, layer.shiftPx, 0);
      ctx.fillStyle = 'rgba(190, 255, 230, 0.16)';
      if (layer.flip) ctx.fillRect(0, centre - layer.gapWidth / 2, state.arena.width, layer.gapWidth);
      else ctx.fillRect(centre - layer.gapWidth / 2, 0, layer.gapWidth, state.arena.height);
      ctx.fillStyle = rgba(colour, 0.5);
      if (layer.flip) ctx.fillRect(dir.x > 0 ? 0 : state.arena.width - 6, 0, 6, state.arena.height);
      else ctx.fillRect(0, dir.y > 0 ? 0 : state.arena.height - 6, state.arena.width, 6);
    }
    if (layer.kind === 'closing') {
      // The ring that will close, and its gap towards the mark.
      const c = { x: state.arena.width / 2, y: state.arena.height / 2 };
      ring(ctx, c, layer.radius, rgba(colour, 0.35), 2);
      const a = Math.atan2(mark.y - c.y, mark.x - c.x);
      const half = ((layer.gap / 2) * 360 * DEG) / layer.perRing;
      ctx.strokeStyle = 'rgba(190, 255, 230, 0.8)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(c.x, c.y, layer.radius, a - half, a + half);
      ctx.stroke();
    }
  }
  // The spiral and the static families: a slow spin of light at the body while winding.
  if (winding && card.layers.some((l) => l.kind === 'spiral' || l.kind === 'wave')) {
    const spin = timeMs / 260;
    for (let i = 0; i < 3; i++) line(ctx, pos, { x: Math.cos(spin + (i * 2 * Math.PI) / 3), y: Math.sin(spin + (i * 2 * Math.PI) / 3) }, enemy.radius + 14, rgba(colour, 0.6), 2);
  }
}
