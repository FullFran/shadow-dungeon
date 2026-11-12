import { describe, expect, it } from 'vitest';
import { drawCardFight, TELEGRAPHED_KINDS } from '../../src/adapters/danmaku-vfx';
import type { EnemyState } from '../../src/core/state';
import { vec } from '../../src/core/vec';
import { spawnEnemy } from '../../src/core/world';
import type { CardFightDef } from '../../src/data/cards';
import type { DanmakuPattern, DanmakuShot } from '../../src/data/enemies';
import { world } from '../core/helpers';

/** Every card pattern kind is telegraphed on every peer from the snapshot fields (GDD §9): a kind nobody draws fails here. */
const SHOT: DanmakuShot = { power: 10, type: 'ghost', speed: 100, radius: 5, lifetimeMs: 4000 };
const ATTACK = { power: 20, type: 'ghost' as const, pierceRoll: true as const };

const SAMPLES: Record<DanmakuPattern['kind'], DanmakuPattern> = {
  rings: { kind: 'rings', rings: 2, perRing: 12, gap: 3, gapTurnDeg: 20, gapMs: 500, shot: SHOT },
  spiral: { kind: 'spiral', arms: 2, everyMs: 200, durationMs: 1000, turnDegPerShot: 10, shot: SHOT },
  lanes: { kind: 'lanes', waves: 2, gapMs: 500, spacing: 30, gapWidth: 90, shiftPx: 40, shot: SHOT },
  fan: { kind: 'fan', fans: 2, perFan: 3, spreadDeg: 30, gapMs: 400, aim: 'each', shot: SHOT },
  walls: { kind: 'walls', waves: 2, gapMs: 900, spacing: 30, gapWidth: 100, shiftPx: 60, shot: SHOT },
  turrets: { kind: 'turrets', points: [{ x: 0.1, y: 0.1 }], atOnce: 1, volleys: 2, gapMs: 500, perVolley: 1, spreadDeg: 0, shot: SHOT },
  sweep: { kind: 'sweep', radius: 100, sweepDeg: 180, sweepMs: 600, armDeg: 30, attack: ATTACK },
  zone: { kind: 'zone', at: 'self', radius: 80, lockMs: 0, impactMs: 200, attack: ATTACK },
  familiars: { kind: 'familiars', count: 2, radius: 80, degPerSec: 40, centre: 'boss', atOnce: 1, volleys: 3, gapMs: 600, perVolley: 1, spreadDeg: 0, aim: 'target', shot: SHOT },
  wave: { kind: 'wave', arms: 2, everyMs: 100, durationMs: 1000, amplitudeDeg: 25, periodMs: 1000, shot: SHOT },
  closing: { kind: 'closing', rings: 2, gapMs: 800, perRing: 16, gap: 4, radius: 150, gapTurnDeg: 20, shot: SHOT },
  scatter: { kind: 'scatter', bursts: 2, gapMs: 400, count: 6, coneDeg: 50, salt: 3, aim: 'first', shot: SHOT },
  homing: { kind: 'homing', volleys: 2, gapMs: 900, orbs: 2, spreadDeg: 40, shot: { ...SHOT, steer: { degPerSec: 60, ms: 1500 } } },
  laser: { kind: 'laser', volleys: 1, everyMs: 1200, lines: 2, fanDeg: 30, turnDeg: 10, warnMs: 600, fireMs: 400, beamEveryMs: 50, shot: SHOT },
};

function recorder() {
  let calls = 0;
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (target, name: string) => (name in target ? target[name] : () => void calls++),
    set: (target, name: string, value) => {
      target[name] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls: () => calls };
}

const fightOf = (p: DanmakuPattern): CardFightDef => ({
  cards: [{ id: 'sc-test-vfx', nameKey: 'x', hpShare: 1, timerMs: 30_000, restMs: 500, steps: [{ telegraphMs: 800, recoverMs: 800, pattern: p }] }],
  aggroRange: 900,
  breakMs: 1000,
  phase2BreakMs: 1000,
  maxShots: 100,
  walkSpeed: 0,
  keepDistance: 0,
  power: 1,
});

describe('card pattern telegraphs', () => {
  it('the sample table covers every kind the module draws', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual([...TELEGRAPHED_KINDS].sort());
  });

  it.each(TELEGRAPHED_KINDS.map((k) => [k] as const))('%s draws its wind-up', (kind) => {
    const state = spawnEnemy(world(vec(400, 500)), 'aegislash', vec(400, 200));
    const base = state.enemies[0]!;
    const enemy: EnemyState = {
      ...base,
      boss: { ...base.boss!, stance: 'sc-test-vfx' as never, card: 0 },
      ai: { ...base.ai, mode: 'telegraph', modeMs: 400, modeDurationMs: 800, attack: '0', attackDir: vec(0, 1), aimPoint: vec(400, 450) },
    };
    const { ctx, calls } = recorder();
    drawCardFight(ctx, enemy, fightOf(SAMPLES[kind]), enemy.pos, { width: 800, height: 600 }, 1234);
    expect(calls()).toBeGreaterThan(0);
  });
});
