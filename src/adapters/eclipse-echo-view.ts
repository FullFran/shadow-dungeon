import { coronaPockets, eclipseCentre, laneGaps, nooseRadius } from '../core/eclipse-echo';
import type { EnemyState, WorldState } from '../core/state';
import { angleOf, type Vec2 } from '../core/vec';
import { ECLIPSE_ECHO } from '../data/enemies';

/**
 * The Eclipse Echo on screen (presentation only): a corrupted shadow of
 * Mimikyu (its sheets through a dark red filter, a slow pulsing halo), and
 * the ground marks of its cards: the corona's burning arena with its three
 * pockets, the noose's closing ring and its gap, the lanes' first gap and a
 * ring of light while any other card winds up.
 */

/** Its look: Mimikyu's busted form gone black and red. */
export const ECHO_FILTER = 'brightness(0.3) contrast(1.6) sepia(1) hue-rotate(-40deg) saturate(3) drop-shadow(0 0 2px #ff2a3a) drop-shadow(0 0 4px #000000)';

const def = ECLIPSE_ECHO;

/** Ground marks of its card in play (world units, under the actors). */
export function drawEclipseZones(ctx: CanvasRenderingContext2D, state: WorldState, enemy: EnemyState, pos: Vec2, timeMs: number): void {
  if (!enemy.alive || !enemy.boss) return;
  const { mode, modeMs, modeDurationMs } = enemy.ai;
  const stance = enemy.boss.stance;
  const centre = eclipseCentre(state);
  const progress = modeDurationMs > 0 ? Math.min(1, modeMs / modeDurationMs) : 1;
  // The halo: always there, faster while it winds up.
  const halo = ctx.createRadialGradient(pos.x, pos.y - 10, 4, pos.x, pos.y - 10, 46);
  halo.addColorStop(0, `rgba(255, 40, 60, ${0.35 + 0.15 * Math.sin(timeMs / (mode === 'telegraph' ? 90 : 500))})`);
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(pos.x - 46, pos.y - 56, 92, 92);
  if (mode !== 'telegraph' && mode !== 'attack') return;
  const { width, height } = state.arena;
  if (stance === 'corona') {
    const pockets = coronaPockets(def.corona, centre, enemy.ai.aimPoint ?? centre);
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    for (const p of pockets) {
      ctx.moveTo(p.x + def.corona.pocketRadius, p.y);
      ctx.arc(p.x, p.y, def.corona.pocketRadius, 0, Math.PI * 2);
    }
    ctx.fillStyle = mode === 'attack' ? 'rgba(255, 80, 40, 0.6)' : `rgba(255, 40, 40, ${0.08 + 0.22 * progress})`;
    ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(255, 230, 200, 0.9)';
    ctx.lineWidth = 2;
    for (const p of pockets) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, def.corona.pocketRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }
  if (stance === 'noose') {
    const r = mode === 'attack' ? nooseRadius(def.noose, modeMs) : def.noose.fromRadius;
    const gapAt = angleOf(enemy.ai.attackDir);
    const half = ((def.noose.gapDegrees / 2) * Math.PI) / 180;
    ctx.strokeStyle = mode === 'attack' ? 'rgba(255, 60, 60, 0.9)' : `rgba(255, 60, 60, ${0.25 + 0.4 * progress})`;
    ctx.lineWidth = mode === 'attack' ? def.noose.width : 3;
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, r, gapAt + half, gapAt - half + Math.PI * 2);
    ctx.stroke();
    // The gap, lit.
    ctx.strokeStyle = 'rgba(255, 240, 200, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, r, gapAt - half, gapAt + half);
    ctx.stroke();
    return;
  }
  if (mode !== 'telegraph') return;
  if (stance === 'lanes') {
    const gap = laneGaps(def.lanes, width, enemy.ai.aimPoint?.x ?? width / 2)[0]!;
    ctx.fillStyle = `rgba(255, 60, 60, ${0.2 + 0.3 * progress})`;
    ctx.fillRect(0, 0, width, 8);
    ctx.fillStyle = 'rgba(255, 240, 200, 0.5)';
    ctx.fillRect(gap - def.lanes.gapWidth / 2, 0, def.lanes.gapWidth, 8);
    return;
  }
  ctx.strokeStyle = `rgba(255, 90, 90, ${0.9 - 0.6 * progress})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y - 10, 16 + 50 * progress, 0, Math.PI * 2);
  ctx.stroke();
}
