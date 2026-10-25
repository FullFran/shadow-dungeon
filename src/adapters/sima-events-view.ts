import { simaWaves, type SimaEventState, type SimaPactState } from '../core/sima-events';
import type { Difficulty } from '../data/difficulty';
import type { Vec2 } from '../core/vec';
import { SIMA_EVENTS, type SimaEventKind } from '../data/sima';
import { t } from '../i18n';
import { pixelText } from '../ui/canvas';
import { canvasFont, PALETTE } from '../ui/tokens';

/**
 * The Sima del Eclipse's floor events on screen (presentation only): their
 * objects drawn in code (the vault's chest, the shrine's eclipse altar, the
 * time crystal, the merchant echo, the nest), the wave room's sealed doors,
 * the ambush's tell, and a line of HUD under the run clock (wave counter,
 * crystal time, the hunter's warning, the pact in force).
 */

const TILE = 32;

/** What changed in the event since the last frame, as log keys (each peer works it out from its own world). */
export function simaNews(prev: SimaEventState | undefined, next: SimaEventState | undefined): string[] {
  if (!next || (prev && prev.kind !== next.kind)) return [];
  const out: string[] = [];
  if (!prev?.woke && next.woke) out.push(`sima.log.${next.kind}.woke`);
  if ((next.wave ?? 0) > (prev?.wave ?? 0)) out.push(next.wave === 1 ? 'sima.log.waves.start' : 'sima.log.waves.next');
  if (!prev?.done && next.done && next.outcome) out.push(`sima.log.${next.kind}.${next.outcome}`);
  return out;
}

/** Events announced in the log on entering their floor (the monster house and the ambush stay a surprise). */
export const announcedOnEntry = (kind: SimaEventKind): boolean => kind !== 'monsterHouse' && kind !== 'ambush';

/** Colour of an event on the minimap and its glow. */
export const EVENT_COLORS: Readonly<Record<SimaEventKind, string>> = {
  vault: '#ffd447',
  shrine: '#ff5a6a',
  monsterHouse: '#ff8a3a',
  crystal: '#7fe3ff',
  merchant: '#b48cff',
  nest: '#9adf5a',
  waves: '#ff5a3a',
  ambush: '#c9a36a',
  hunter: '#ff2a3a',
};

function glow(ctx: CanvasRenderingContext2D, pos: Vec2, radius: number, color: string, alpha: number): void {
  const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(pos.x - radius, pos.y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
}

function chest(ctx: CanvasRenderingContext2D, pos: Vec2, open: boolean, timeMs: number): void {
  const x = Math.round(pos.x - 12);
  const y = Math.round(pos.y - 10);
  if (!open) glow(ctx, pos, 30, 'rgba(255, 212, 71, 0.55)', 0.5 + 0.2 * Math.sin(timeMs / 300));
  ctx.fillStyle = '#5a3418';
  ctx.fillRect(x, y + 6, 24, 14);
  ctx.fillStyle = open ? '#2a160a' : '#7a4a22';
  ctx.fillRect(x, open ? y - 2 : y, 24, open ? 4 : 8);
  ctx.fillStyle = '#ffd447';
  ctx.fillRect(x, y + 6, 24, 2);
  ctx.fillRect(x + 10, y + 8, 4, 5);
  if (open) {
    ctx.fillStyle = '#ffe9a0';
    ctx.fillRect(x + 4, y + 4, 16, 3);
  }
}

function altar(ctx: CanvasRenderingContext2D, pos: Vec2, lit: boolean, timeMs: number): void {
  if (lit) glow(ctx, pos, 40, 'rgba(255, 70, 80, 0.6)', 0.55 + 0.25 * Math.sin(timeMs / 420));
  ctx.fillStyle = '#2a1a24';
  ctx.fillRect(Math.round(pos.x - 14), Math.round(pos.y - 4), 28, 14);
  ctx.fillStyle = '#4a2a3c';
  ctx.fillRect(Math.round(pos.x - 16), Math.round(pos.y - 6), 32, 4);
  // The eclipse sigil over it: a black disc in a red ring.
  const cy = pos.y - 18 + Math.sin(timeMs / 500) * 2;
  ctx.fillStyle = lit ? '#ff5a4a' : '#5a2a32';
  ctx.beginPath();
  ctx.arc(pos.x, cy, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(pos.x, cy, 6, 0, Math.PI * 2);
  ctx.fill();
}

function crystal(ctx: CanvasRenderingContext2D, pos: Vec2, left: number, gone: boolean, timeMs: number): void {
  if (gone) {
    ctx.fillStyle = 'rgba(127, 227, 255, 0.25)';
    ctx.fillRect(Math.round(pos.x - 6), Math.round(pos.y + 4), 12, 3);
    return;
  }
  const bob = Math.sin(timeMs / 350) * 3;
  // It flickers as it fades.
  const alpha = left < 0.25 ? 0.5 + 0.5 * Math.abs(Math.sin(timeMs / 90)) : 1;
  glow(ctx, pos, 34, 'rgba(127, 227, 255, 0.7)', 0.5 * alpha);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#7fe3ff';
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y - 18 + bob);
  ctx.lineTo(pos.x + 8, pos.y - 6 + bob);
  ctx.lineTo(pos.x, pos.y + 6 + bob);
  ctx.lineTo(pos.x - 8, pos.y - 6 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e8fbff';
  ctx.fillRect(Math.round(pos.x - 2), Math.round(pos.y - 12 + bob), 3, 6);
  // The time it has left, as an arc around it.
  ctx.strokeStyle = 'rgba(232, 251, 255, 0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y - 6 + bob, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function merchant(ctx: CanvasRenderingContext2D, pos: Vec2, timeMs: number): void {
  const bob = Math.sin(timeMs / 600) * 2;
  glow(ctx, { x: pos.x + 10, y: pos.y - 10 }, 22, 'rgba(255, 200, 120, 0.8)', 0.6);
  ctx.globalAlpha = 0.85;
  // A hooded shade, half see-through, with a lantern.
  ctx.fillStyle = '#3a2a5a';
  ctx.beginPath();
  ctx.moveTo(pos.x - 10, pos.y + 8);
  ctx.lineTo(pos.x - 7, pos.y - 14 + bob);
  ctx.lineTo(pos.x, pos.y - 22 + bob);
  ctx.lineTo(pos.x + 7, pos.y - 14 + bob);
  ctx.lineTo(pos.x + 10, pos.y + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#b48cff';
  ctx.fillRect(Math.round(pos.x - 3), Math.round(pos.y - 14 + bob), 2, 2);
  ctx.fillRect(Math.round(pos.x + 2), Math.round(pos.y - 14 + bob), 2, 2);
  ctx.fillStyle = '#ffcf7a';
  ctx.fillRect(Math.round(pos.x + 9), Math.round(pos.y - 12 + bob), 4, 5);
  ctx.globalAlpha = 1;
}

/** A monster nest (an enemy drawn in code): a dark cocoon that glows harder as the next hatching nears. */
export function drawNest(ctx: CanvasRenderingContext2D, pos: Vec2, hpShare: number, hatchIn: number | null, alpha: number, timeMs: number): void {
  const warn = hatchIn !== null && hatchIn < SIMA_EVENTS.nest.telegraphMs ? 1 - hatchIn / SIMA_EVENTS.nest.telegraphMs : 0;
  ctx.globalAlpha = alpha;
  glow(ctx, pos, 26 + warn * 12, 'rgba(154, 223, 90, 0.8)', 0.25 + 0.6 * warn);
  ctx.globalAlpha = alpha;
  const pulse = 1 + 0.06 * Math.sin(timeMs / (warn > 0 ? 60 : 400));
  ctx.fillStyle = '#1c2414';
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y - 8, 15 * pulse, 18 * pulse, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4a6a2a';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(pos.x, pos.y - 8, 15 * pulse - i * 4, 18 * pulse - i * 5, 0, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }
  ctx.fillStyle = warn > 0 ? '#d8ff7a' : '#9adf5a';
  ctx.fillRect(Math.round(pos.x - 2), Math.round(pos.y - 12), 4, 4);
  // Cracks show the damage it took.
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  if (hpShare < 0.66) {
    ctx.beginPath();
    ctx.moveTo(pos.x - 8, pos.y - 18);
    ctx.lineTo(pos.x - 3, pos.y - 8);
    ctx.lineTo(pos.x - 7, pos.y);
    ctx.stroke();
  }
  if (hpShare < 0.33) {
    ctx.beginPath();
    ctx.moveTo(pos.x + 9, pos.y - 16);
    ctx.lineTo(pos.x + 4, pos.y - 6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** The event's objects and marks, in world units (under the actors). */
export function drawSimaEvent(ctx: CanvasRenderingContext2D, event: SimaEventState, timeMs: number, cols: number): void {
  switch (event.kind) {
    case 'vault':
      chest(ctx, event.pos, event.done, timeMs);
      break;
    case 'shrine':
      altar(ctx, event.pos, !event.done, timeMs);
      break;
    case 'crystal':
      crystal(ctx, event.pos, Math.max(0, (event.remainingMs ?? 0) / SIMA_EVENTS.crystal.fadeMs), event.done, timeMs);
      break;
    case 'merchant':
      merchant(ctx, event.pos, timeMs);
      break;
    case 'waves':
      if (event.sealed) {
        // Red bars across the locked doorways.
        for (const i of event.doors ?? []) {
          const x = (i % cols) * TILE;
          const y = Math.floor(i / cols) * TILE;
          ctx.fillStyle = `rgba(255, 60, 50, ${0.35 + 0.2 * Math.sin(timeMs / 150)})`;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#ff5a3a';
          for (let b = 4; b < TILE; b += 8) ctx.fillRect(x + b, y, 2, TILE);
        }
      }
      break;
    case 'ambush':
      if (event.woke && !event.done) {
        // The tell: the ground cracks and heaves where they wait, with a "!".
        for (const spot of event.spots ?? []) {
          const shake = Math.sin(timeMs / 30) * 2;
          ctx.fillStyle = '#4a3420';
          ctx.beginPath();
          ctx.ellipse(spot.x + shake, spot.y + 4, 14, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#c9a36a';
          ctx.fillRect(Math.round(spot.x - 6 + shake), Math.round(spot.y + 2), 12, 2);
          ctx.font = canvasFont(14, true);
          pixelText(ctx, '!', spot.x, spot.y - 14, PALETTE.danger, 'center');
        }
      }
      break;
    default:
      break;
  }
}

/** One line of event HUD under the run clock (screen units), and the pact in force under it. */
export function drawSimaHud(ctx: CanvasRenderingContext2D, event: SimaEventState | undefined, pact: SimaPactState | undefined, width: number, timeMs: number, difficulty: Difficulty = 'easy'): void {
  const lines: { text: string; color: string }[] = [];
  if (event && !event.done) {
    if (event.kind === 'waves' && (event.wave ?? 0) > 0) lines.push({ text: t('sima.hud.wave').replace('{wave}', String(event.wave)).replace('{waves}', String(simaWaves(SIMA_EVENTS, difficulty))), color: PALETTE.danger });
    if (event.kind === 'crystal') lines.push({ text: t('sima.hud.crystal').replace('{s}', String(Math.ceil((event.remainingMs ?? 0) / 1000))), color: '#7fe3ff' });
    if (event.kind === 'hunter' && (event.remainingMs ?? 0) < 3000) lines.push({ text: t('sima.hud.hunter'), color: Math.floor(timeMs / 250) % 2 === 0 ? PALETTE.danger : PALETTE.text });
  }
  if (pact) lines.push({ text: t('sima.hud.pact').replace('{name}', t(`sima.pact.${pact.id}.name`)).replace('{floors}', String(pact.floorsLeft)), color: PALETTE.eclipseGlow });
  ctx.font = canvasFont();
  lines.forEach((line, i) => pixelText(ctx, line.text, width / 2, 94 + i * 12, line.color, 'center'));
}
