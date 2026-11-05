import { describe, expect, it } from 'vitest';
import { castInput, createFrameLoop, createPreviewSim, cycleLength, PREVIEW, previewWorld } from '../../src/app/move-preview';
import { tutorCards } from '../../src/app/tutor';
import { MOVES } from '../../src/data/moves';
import { PLAYABLE_SPECIES } from '../../src/data/species';
import { PLAYER_SLOT_LAYOUT } from '../../src/data/slots';
import { vec } from '../../src/core/vec';
import { FIXED_DT_MS } from '../../src/core/timestep';
import type { GameEvent } from '../../src/core/state';

const dummy = previewWorld('mimikyu', 'slash')!.enemies[0]!.pos;

describe('move preview world', () => {
  it('puts the species and the move in its slot, with one passive dummy in front', () => {
    const world = previewWorld('mimikyu', 'slash')!;
    expect(world).not.toBeNull();
    expect(world.player.species).toBe('mimikyu');
    expect(world.player.loadout[PLAYER_SLOT_LAYOUT.indexOf(MOVES.slash.slot)]).toBe('slash');
    expect(world.enemies).toHaveLength(1);
    expect(world.enemies[0]!.ai.mode).toBe('dormant');
    expect(world.player.pos.x).toBeLessThan(world.enemies[0]!.pos.x);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(previewWorld('cubone', 'bone-club', 1))).toBe(JSON.stringify(previewWorld('cubone', 'bone-club', 1)));
  });

  it('carries the owned rank of the move', () => {
    expect(previewWorld('cubone', 'bone-club', 2)!.player.moveRanks).toEqual({ 'bone-club': 2 });
  });

  it('every move of every playable species can be set up (kit and tutor offer)', () => {
    for (const species of PLAYABLE_SPECIES) {
      for (const card of tutorCards({ coins: 0 }, species, 'all')) expect(previewWorld(species, card.move), `${species} ${card.move}`).not.toBeNull();
    }
  });
});

describe('cast schedule', () => {
  it('presses the move slot once for a plain move and never before the cast start', () => {
    const def = MOVES.slash;
    const slot = PLAYER_SLOT_LAYOUT.indexOf(def.slot);
    expect(castInput(def, slot, 0, dummy).slots[slot]).toBe(false);
    expect(castInput(def, slot, PREVIEW.castAtMs, dummy).slots[slot]).toBe(true);
    expect(castInput(def, slot, PREVIEW.castAtMs + 200, dummy).slots[slot]).toBe(false);
  });

  it('holds a charge move until its top level, then lets go', () => {
    const def = Object.values(MOVES).find((m) => m.charge && m.charge.length > 1)!;
    const slot = PLAYER_SLOT_LAYOUT.indexOf(def.slot);
    const top = def.charge![def.charge!.length - 1]!.holdMs;
    expect(castInput(def, slot, PREVIEW.castAtMs + top - 20, dummy).slots[slot]).toBe(true);
    expect(castInput(def, slot, PREVIEW.castAtMs + top + 400, dummy).slots[slot]).toBe(false);
  });

  it('aims at the dummy and the cycle is about 1.6 s, longer only when the move needs it', () => {
    expect(castInput(MOVES.slash, 0, 0, dummy).aim).toEqual(dummy);
    expect(cycleLength(MOVES.slash)).toBeGreaterThanOrEqual(1600);
    expect(cycleLength(MOVES.slash)).toBeLessThan(2400);
  });
});

describe('preview sim', () => {
  const play = (sim: NonNullable<ReturnType<typeof createPreviewSim>>, ms: number): GameEvent[] => {
    const events: GameEvent[] = [];
    for (let t = 0; t < ms; t += FIXED_DT_MS) events.push(...sim.advance(FIXED_DT_MS));
    return events;
  };

  it('casts the move and hits the dummy within one cycle (a damaging move)', () => {
    const sim = createPreviewSim('mimikyu', 'slash')!;
    expect(play(sim, 2400).some((e) => e.type === 'enemyHit')).toBe(true);
  });

  it('every damaging move of every playable species lands on the dummy within a cycle or two', () => {
    const missed: string[] = [];
    for (const species of PLAYABLE_SPECIES) {
      for (const card of tutorCards({ coins: 0 }, species, 'all')) {
        const def = MOVES[card.move];
        if (def.power <= 0) continue;
        const sim = createPreviewSim(species, card.move)!;
        let hit = false;
        for (let t = 0; t < cycleLength(def) * 2 && !hit; t += FIXED_DT_MS) hit = sim.advance(FIXED_DT_MS).some((e) => e.type === 'enemyHit');
        if (!hit) missed.push(`${species}:${card.move}`);
      }
    }
    expect(missed).toEqual([]);
  });

  it('loops: the cycle counter runs and the dummy never falls', () => {
    const sim = createPreviewSim('mimikyu', 'slash')!;
    play(sim, cycleLength(MOVES.slash) * 3 + 100);
    expect(sim.cycles).toBeGreaterThanOrEqual(3);
    expect(sim.world.enemies[0]!.alive).toBe(true);
  });
});

describe('frame loop', () => {
  const fakeEnv = () => {
    const live = new Map<number, (now: number) => void>();
    let next = 1;
    return {
      live,
      env: {
        raf: (cb: (now: number) => void) => {
          live.set(next, cb);
          return next++;
        },
        caf: (id: number) => void live.delete(id),
      },
      tick(now: number) {
        for (const [id, cb] of [...live]) {
          live.delete(id);
          cb(now);
        }
      },
    };
  };

  it('runs one frame per rAF, with the elapsed time, and keeps exactly one rAF pending', () => {
    const f = fakeEnv();
    const frames: number[] = [];
    const loop = createFrameLoop(f.env, (ms) => frames.push(ms));
    loop.start();
    expect(f.live.size).toBe(1);
    f.tick(100);
    f.tick(116);
    expect(frames).toEqual([0, 16]);
    expect(f.live.size).toBe(1);
  });

  it('stop leaves no rAF pending and no more frames', () => {
    const f = fakeEnv();
    const frames: number[] = [];
    const loop = createFrameLoop(f.env, (ms) => frames.push(ms));
    loop.start();
    f.tick(0);
    loop.stop();
    expect(f.live.size).toBe(0);
    expect(loop.running).toBe(false);
    f.tick(50);
    expect(frames).toHaveLength(1);
  });

  it('start twice does not double the loop; restart after stop works and does not catch up', () => {
    const f = fakeEnv();
    const frames: number[] = [];
    const loop = createFrameLoop(f.env, (ms) => frames.push(ms));
    loop.start();
    loop.start();
    expect(f.live.size).toBe(1);
    f.tick(10);
    loop.stop();
    loop.start();
    f.tick(5000);
    expect(f.live.size).toBe(1);
    expect(frames[frames.length - 1]).toBe(0);
  });
});
