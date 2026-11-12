import { familiarPoints, fanDirections, laneGap, laneGapOf, laserDirections, laserFiring, sweepAngle, turretPoints, turretsFiring, waveDirections } from '../core/danmaku';
import type { EnemyState } from '../core/state';
import type { Vec2 } from '../core/vec';
import type { DanmakuCard, DanmakuDef, DanmakuPattern } from '../data/enemies';
import { cardInfo, type CardFightDef } from '../data/cards';
import { cardStep } from '../core/cards';

/**
 * Telegraphs of the caves' bullet-hell bosses (core/danmaku.ts), drawn on
 * the ground under everything, from the snapshot fields only (so guests see
 * them too): a pulsing ring with the gap marked for bubble rings, a spinning
 * glow for spirals, the kelp band at the far end with its safe lane lit, the
 * anchor's reach (the swept sector, then the arm), the bursting circle
 * (solid red once locked: it is a positional attack, walk out of it) and the
 * awakening's double ring.
 */
const DEG = Math.PI / 180;
const EDGE = 'rgba(255, 90, 90, 0.85)';
const DANGER = 'rgba(255, 70, 70, 0.22)';
const LOCKED = 'rgba(255, 60, 60, 0.42)';
const SAFE = 'rgba(190, 255, 230, 0.16)';

export function drawDanmaku(ctx: CanvasRenderingContext2D, enemy: EnemyState, def: DanmakuDef, pos: Vec2, arena: { width: number; height: number }, timeMs: number): void {
  const { ai } = enemy;
  const stance = enemy.boss?.stance;
  const progress = ai.modeDurationMs > 0 ? Math.min(1, ai.modeMs / ai.modeDurationMs) : 1;
  const winding = ai.mode === 'telegraph';
  const striking = ai.mode === 'attack';
  if (ai.mode === 'transform' && stance === 'awaken') {
    ctx.strokeStyle = 'rgba(120, 220, 255, 0.85)';
    ctx.lineWidth = 3;
    for (const phase of [0, 0.5]) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, enemy.radius + 8 + 90 * ((progress + phase) % 1), 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }
  if (!winding && !striking) return;
  const card = def.patterns[stance as DanmakuCard];
  if (card) drawPattern(ctx, enemy, card.pattern, pos, arena, timeMs);
}

/**
 * A guardian's spell card (core/cards.ts), from the snapshot fields: the
 * declaration (a double ring closing in, gold for a survival card) and then
 * the telegraph of the move in play, like the caves' bosses.
 */
export function drawCardFight(ctx: CanvasRenderingContext2D, enemy: EnemyState, fight: CardFightDef, pos: Vec2, arena: { width: number; height: number }, timeMs: number): void {
  const { ai } = enemy;
  const progress = ai.modeDurationMs > 0 ? Math.min(1, ai.modeMs / ai.modeDurationMs) : 1;
  if (ai.mode === 'transform') {
    ctx.strokeStyle = cardInfo(enemy.boss?.stance)?.survival ? 'rgba(255, 215, 110, 0.9)' : 'rgba(200, 160, 255, 0.85)';
    ctx.lineWidth = 3;
    for (const phase of [0, 0.5]) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, enemy.radius + 8 + 110 * (1 - ((progress + phase) % 1)), 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }
  if (ai.mode !== 'telegraph' && ai.mode !== 'attack') return;
  const step = cardStep(fight, enemy);
  // The move's pattern and its layers (a laser or familiars layer warns like a pattern of its own).
  if (step) for (const p of [step.pattern, ...(step.layers ?? [])]) drawPattern(ctx, enemy, p, pos, arena, timeMs);
}

/** Every pattern kind this module draws a telegraph for (tests/adapters/danmaku-vfx.test.ts iterates them). */
export const TELEGRAPHED_KINDS: readonly DanmakuPattern['kind'][] = ['rings', 'spiral', 'lanes', 'fan', 'walls', 'turrets', 'sweep', 'zone', 'familiars', 'wave', 'closing', 'scatter', 'homing', 'laser'];

/** Far enough to reach every wall of any arena. */
const BEAM_PX = 1400;

/** The telegraph of one danmaku pattern while it winds up (and, for sweeps and zones, while it strikes). */
function drawPattern(ctx: CanvasRenderingContext2D, enemy: EnemyState, p: DanmakuPattern, pos: Vec2, arena: { width: number; height: number }, timeMs: number): void {
  const { ai } = enemy;
  const progress = ai.modeDurationMs > 0 ? Math.min(1, ai.modeMs / ai.modeDurationMs) : 1;
  const winding = ai.mode === 'telegraph';
  const striking = ai.mode === 'attack';
  const aim = Math.atan2(ai.attackDir.y, ai.attackDir.x);
  if (p.kind === 'rings' || p.kind === 'spiral') {
    if (!winding) return;
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, enemy.radius + 6 + 24 * (1 - progress), 0, Math.PI * 2);
    ctx.stroke();
    if (p.kind === 'rings') {
      // The first ring's gap: a bright wedge towards the player.
      const half = ((p.gap + 1) / 2) * (360 / p.perRing) * DEG;
      ctx.fillStyle = SAFE;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.arc(pos.x, pos.y, 120, aim - half, aim + half);
      ctx.closePath();
      ctx.fill();
    } else {
      const spin = timeMs / 300;
      ctx.strokeStyle = 'rgba(255, 230, 140, 0.7)';
      for (let arm = 0; arm < p.arms; arm++) {
        const a = aim + spin + (arm * 2 * Math.PI) / p.arms;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x + Math.cos(a) * 60, pos.y + Math.sin(a) * 60);
        ctx.stroke();
      }
    }
    return;
  }
  if (p.kind === 'lanes' && striking && p.snake && ai.aimPoint) {
    // A snaking curtain: the next wave's lane, faintly, so the walk can be read ahead.
    const next = laneGapOf(p, arena.width, ai.aimPoint.x, (enemy.boss?.comboIndex ?? 0) + 1);
    ctx.fillStyle = SAFE;
    ctx.fillRect(next - p.gapWidth / 2, 0, p.gapWidth, arena.height);
    return;
  }
  if (p.kind === 'fan') {
    if (!winding) return;
    // The first fan's blades, growing from the body.
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = 2;
    for (const d of fanDirections(ai.attackDir, p.perFan, p.spreadDeg, 0)) {
      ctx.beginPath();
      ctx.moveTo(pos.x + d.x * (enemy.radius + 4), pos.y + d.y * (enemy.radius + 4));
      ctx.lineTo(pos.x + d.x * (enemy.radius + 4 + 70 * progress), pos.y + d.y * (enemy.radius + 4 + 70 * progress));
      ctx.stroke();
    }
    return;
  }
  if (p.kind === 'walls') {
    if (!winding || !ai.aimPoint) return;
    // Both edges darken; the gap row (where the shields will not meet) is lit across the room.
    const gap = laneGap(arena.height, ai.aimPoint.y, p.gapWidth, p.shiftPx, 0);
    const band = 22;
    ctx.fillStyle = `rgba(120, 140, 200, ${0.3 + 0.4 * progress})`;
    for (const x of [0, arena.width - band]) {
      ctx.fillRect(x, 0, band, Math.max(0, gap - p.gapWidth / 2));
      ctx.fillRect(x, gap + p.gapWidth / 2, band, Math.max(0, arena.height - gap - p.gapWidth / 2));
    }
    ctx.fillStyle = SAFE;
    ctx.fillRect(0, gap - p.gapWidth / 2, arena.width, p.gapWidth);
    return;
  }
  if (p.kind === 'turrets') {
    // The floating swords: the pair about to fire glows.
    const points = turretPoints(p, arena);
    const next = turretsFiring(points.length, p.atOnce, winding ? 0 : (enemy.boss?.comboIndex ?? 0) + 1);
    for (const [i, at] of points.entries()) {
      const hot = next.includes(i);
      const bob = Math.sin(timeMs / 260 + i) * 3;
      ctx.strokeStyle = hot ? 'rgba(255, 120, 120, 0.95)' : 'rgba(200, 210, 235, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(at.x, at.y - 12 + bob);
      ctx.lineTo(at.x, at.y + 12 + bob);
      ctx.moveTo(at.x - 6, at.y + 5 + bob);
      ctx.lineTo(at.x + 6, at.y + 5 + bob);
      ctx.stroke();
      if (hot) {
        ctx.strokeStyle = EDGE;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(at.x, at.y + bob, 16 + 6 * (1 - progress), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    return;
  }
  if (p.kind === 'familiars') {
    // The familiars on their circle (where they are now), the ones about to fire glowing.
    const points = familiarPoints(p, pos, ai.attackDir, arena, striking ? ai.modeMs : 0);
    const next = turretsFiring(points.length, p.atOnce, winding ? 0 : Math.floor(ai.modeMs / p.gapMs) + 1);
    for (const [i, at] of points.entries()) {
      const hot = next.includes(i);
      ctx.fillStyle = hot ? 'rgba(255, 140, 140, 0.9)' : 'rgba(210, 220, 245, 0.75)';
      ctx.beginPath();
      ctx.arc(at.x, at.y, 7 + Math.sin(timeMs / 200 + i) * 1.5, 0, Math.PI * 2);
      ctx.fill();
      if (hot) {
        ctx.strokeStyle = EDGE;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(at.x, at.y, 14 + 5 * (1 - progress), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    return;
  }
  if (p.kind === 'wave' || p.kind === 'scatter' || p.kind === 'homing') {
    if (!winding) return;
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = 2;
    if (p.kind === 'wave') {
      // The arms swinging from the body.
      const reach = enemy.radius + 6 + 64 * progress;
      for (const d of waveDirections(ai.attackDir, { ...p, everyMs: Math.max(1, timeMs % p.periodMs) }, 1)) {
        ctx.beginPath();
        ctx.moveTo(pos.x + d.x * (enemy.radius + 4), pos.y + d.y * (enemy.radius + 4));
        ctx.lineTo(pos.x + d.x * reach, pos.y + d.y * reach);
        ctx.stroke();
      }
    } else if (p.kind === 'scatter') {
      // The cone the spread fills.
      const half = (p.coneDeg / 2) * DEG;
      ctx.fillStyle = DANGER;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.arc(pos.x, pos.y, 80 + 40 * progress, aim - half, aim + half);
      ctx.closePath();
      ctx.fill();
    } else {
      // The orbs gathering round the body.
      ctx.fillStyle = 'rgba(255, 150, 210, 0.8)';
      for (let i = 0; i < p.orbs; i++) {
        const a = timeMs / 250 + (i * 2 * Math.PI) / p.orbs;
        ctx.beginPath();
        ctx.arc(pos.x + Math.cos(a) * (enemy.radius + 10), pos.y + Math.sin(a) * (enemy.radius + 10), 3 + 3 * progress, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return;
  }
  if (p.kind === 'closing') {
    // The ring that will close: on the mark, its gap lit on the side away from the boss.
    const at = ai.aimPoint;
    if (!at) return;
    const ring = winding ? 0 : Math.floor(ai.modeMs / p.gapMs) + 1;
    if (ring >= p.rings) return;
    const gapAt = aim + ring * p.gapTurnDeg * DEG;
    const half = ((p.gap + 1) / 2) * (360 / p.perRing) * DEG;
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(at.x, at.y, p.radius, gapAt + half, gapAt - half + Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = SAFE;
    ctx.beginPath();
    ctx.moveTo(at.x, at.y);
    ctx.arc(at.x, at.y, p.radius, gapAt - half, gapAt + half);
    ctx.closePath();
    ctx.fill();
    return;
  }
  if (p.kind === 'laser') {
    // The warning lines of the volley about to fire: thin, brighter as the beam nears (owner option 4a).
    const t = striking ? ai.modeMs : 0;
    const volley = Math.floor(t / p.everyMs);
    if (volley >= p.volleys) return;
    const local = t - volley * p.everyMs;
    const firing = laserFiring(p, Math.floor(t / p.beamEveryMs)) !== null;
    if (local >= p.warnMs + p.fireMs) return;
    const heat = winding ? 0.25 * progress : firing ? 1 : Math.min(1, local / Math.max(1, p.warnMs));
    ctx.strokeStyle = `rgba(255, 80, 80, ${0.25 + 0.6 * heat})`;
    ctx.lineWidth = firing ? 3 : 1;
    for (const d of laserDirections(ai.attackDir, p, volley)) {
      ctx.beginPath();
      ctx.moveTo(pos.x + d.x * (enemy.radius + 2), pos.y + d.y * (enemy.radius + 2));
      ctx.lineTo(pos.x + d.x * BEAM_PX, pos.y + d.y * BEAM_PX);
      ctx.stroke();
    }
    return;
  }
  if (p.kind === 'lanes') {
    if (!winding || !ai.aimPoint) return;
    const gap = laneGapOf(p, arena.width, ai.aimPoint.x, 0);
    const band = 24;
    const down = ai.attackDir.y > 0;
    const y = down ? 0 : arena.height - band;
    ctx.fillStyle = `rgba(40, 110, 60, ${0.35 + 0.35 * progress})`;
    ctx.fillRect(0, y, Math.max(0, gap - p.gapWidth / 2), band);
    ctx.fillRect(gap + p.gapWidth / 2, y, Math.max(0, arena.width - gap - p.gapWidth / 2), band);
    ctx.fillStyle = EDGE;
    ctx.fillRect(0, down ? y + band - 2 : y, arena.width * progress, 2);
    ctx.fillStyle = SAFE;
    ctx.fillRect(gap - p.gapWidth / 2, 0, p.gapWidth, arena.height);
    return;
  }
  if (p.kind === 'sweep') {
    const start = aim - (p.sweepDeg / 2) * DEG;
    ctx.fillStyle = winding ? DANGER : LOCKED;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.arc(pos.x, pos.y, p.radius, start, start + p.sweepDeg * DEG * (winding ? progress : 1));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, p.radius - 1, start, start + p.sweepDeg * DEG);
    ctx.stroke();
    if (striking) {
      // The anchor's arm and chain.
      const arm = sweepAngle(ai.attackDir, p.sweepDeg, p.sweepMs, ai.modeMs);
      ctx.strokeStyle = 'rgba(200, 210, 220, 0.95)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x + Math.cos(arm) * p.radius, pos.y + Math.sin(arm) * p.radius);
      ctx.stroke();
    }
    return;
  }
  // Zone: the circle that bursts; solid once locked.
  const at = ai.aimPoint ?? pos;
  const locked = striking || ai.modeDurationMs - ai.modeMs <= p.lockMs;
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = locked ? 3 : 1;
  ctx.setLineDash(locked ? [] : [6, 4]);
  ctx.beginPath();
  ctx.arc(at.x, at.y, p.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = locked ? LOCKED : DANGER;
  ctx.beginPath();
  ctx.arc(at.x, at.y, Math.max(1, p.radius * (winding ? progress : 1)), 0, Math.PI * 2);
  ctx.fill();
}

/** Riptide: Dhelmise sinks during its wind-up (drawn fading) and surfaces on the mark. */
export const danmakuSinking = (enemy: EnemyState, def: DanmakuDef): boolean => {
  const card = def.patterns[enemy.boss?.stance as DanmakuCard];
  return enemy.ai.mode === 'telegraph' && card?.pattern.kind === 'zone' && card.pattern.at === 'target';
};
