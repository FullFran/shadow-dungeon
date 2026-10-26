import { describe, expect, it } from 'vitest';
import { expectedLevel } from '../../src/core/fairness';
import { levelMaxHp } from '../../src/core/progression';
import { roomCleared } from '../../src/core/rooms';
import { atLevel, bossStop, gauntletStops, heraldStop, progressTrial, SHRINE_BOSSES, startTrial, trialHurt, type TrialProgress } from '../../src/core/shrine';
import { DIFFICULTIES } from '../../src/data/difficulty';
import { floorsOf, dungeonById } from '../../src/data/dungeons';
import { GAUNTLETS, SHRINE } from '../../src/data/shrine';
import type { WorldState } from '../../src/core/state';

const ORDER = ['sableye', 'aegislash', 'trevenant', 'decidueye', 'lanturn', 'dhelmise', 'salazzle', 'nihilego'];
const fell = (world: WorldState): WorldState => ({ ...world, enemies: world.enemies.map((e) => ({ ...e, alive: false, hp: 0 })) });
const bossOf = (world: WorldState) => world.enemies.find((e) => e.boss);

describe('shrine bosses', () => {
  it('lists the eight fixed arenas of the story dungeons in dungeon order, mid-boss before guardian', () => {
    expect(SHRINE_BOSSES.map((b) => b.boss)).toEqual(ORDER);
    for (const b of SHRINE_BOSSES) {
      const def = dungeonById(b.dungeon);
      expect(def.plan[b.floor - 1]?.kind).toBe('room');
      expect(b.role).toBe(b.floor === floorsOf(def) ? 'guardian' : 'midboss');
    }
  });

  it('builds every gauntlet from known bosses; «Todos los juramentos» is every boss in dungeon order', () => {
    for (const g of GAUNTLETS) expect(gauntletStops(g.id).map((s) => s.boss)).toEqual(g.bosses);
    expect(gauntletStops('oaths').map((s) => s.boss)).toEqual(ORDER);
    expect(gauntletStops('guardians').every((s) => s.role === 'guardian')).toBe(true);
  });
});

describe('rematch setup', () => {
  for (const stop of SHRINE_BOSSES) {
    for (const difficulty of DIFFICULTIES) {
      it(`${stop.boss} on ${difficulty}: its own arena at the expected level, no items, no offer`, () => {
        const level = expectedLevel(stop.dungeon, stop.floor, difficulty);
        const { run, world, trial } = startTrial(7, { difficulty, upgrades: { maxHp: 5 } as never }, [stop]);
        expect(run.dungeon).toBe(stop.dungeon);
        expect(run.floor).toBe(stop.floor);
        expect(run.offer).toBeNull();
        expect(run.clockMs).toBeUndefined();
        expect(bossOf(world)?.species).toBe(stop.boss);
        expect(world.referenceLevel).toBe(level);
        expect(world.player.level).toBe(level);
        expect(world.player.items).toEqual([]);
        expect(world.player.upgrades).toBeUndefined();
        expect(world.player.hp).toBe(world.player.maxHp);
        expect(trial).toEqual({ stops: [stop], index: 0, pauseMs: null });
      });
    }
  }

  it('fights a herald by seed on a Sima herald floor with no run clock', () => {
    const stop = heraldStop(12345);
    const { run, world } = startTrial(3, { difficulty: 'normal' }, [stop]);
    expect(run.dungeon).toBe('eclipse-chasm');
    expect(run.clockMs).toBeUndefined();
    expect(world.enemies.find((e) => e.herald)?.herald?.seed).toBe(12345);
    expect(world.player.level).toBe(expectedLevel('eclipse-chasm', stop.floor, 'normal'));
  });

  it('raises a level-1 player to a level with its HP and experience', () => {
    const { world } = startTrial(1, {}, [bossStop('sableye')!]);
    const raised = atLevel(world.player, 5);
    expect(raised.level).toBe(5);
    expect(raised.maxHp - world.player.maxHp).toBe(levelMaxHp(5) - levelMaxHp(world.player.level));
    expect(raised.hp).toBe(raised.maxHp);
    expect(atLevel(raised, 5)).toEqual(raised);
  });
});

describe('trial progress', () => {
  const start = (id: 'guardians' | 'oaths' = 'guardians') => startTrial(9, { difficulty: 'normal' }, gauntletStops(id));
  const step = (p: { trial: TrialProgress['trial']; run: TrialProgress['run']; world: WorldState }, dtMs = 100) => progressTrial(p.trial, p.run, p.world, dtMs);

  it('goes on while the boss stands, ends in defeat when the player falls', () => {
    const s = start();
    expect(step(s).outcome).toBeNull();
    expect(step(s).entered).toBe(false);
    expect(step({ ...s, world: { ...s.world, player: { ...s.world.player, hp: 0 } } }).outcome).toBe('defeat');
  });

  it('a single rematch is won as soon as its room is cleared', () => {
    const s = startTrial(1, {}, [bossStop('trevenant')!]);
    expect(step({ ...s, world: fell(s.world) }).outcome).toBe('victory');
  });

  it('pauses after each fight, then loads the next boss with HP carried over plus the heal, at its own level', () => {
    const s = start();
    const hurt = { ...s.world, player: { ...s.world.player, hp: Math.round(s.world.player.maxHp * 0.5) } };
    const down = fell(hurt);
    const paused = step({ ...s, world: down }, 1000);
    expect(paused.outcome).toBeNull();
    expect(paused.entered).toBe(false);
    expect(paused.trial.pauseMs).toBe(SHRINE.pauseMs - 1000);
    const next = step({ trial: paused.trial, run: paused.run, world: down }, SHRINE.pauseMs);
    expect(next.entered).toBe(true);
    expect(next.trial.index).toBe(1);
    expect(next.trial.pauseMs).toBeNull();
    const stop = gauntletStops('guardians')[1]!;
    expect(next.run.dungeon).toBe(stop.dungeon);
    expect(next.run.floor).toBe(stop.floor);
    expect(bossOf(next.world)?.species).toBe('decidueye');
    expect(roomCleared(next.world)).toBe(false);
    const p = next.world.player;
    expect(p.level).toBe(expectedLevel(stop.dungeon, stop.floor, 'normal'));
    const share = hurt.player.hp / hurt.player.maxHp;
    expect(p.hp).toBe(Math.min(p.maxHp, Math.round((share + SHRINE.heal) * p.maxHp)));
    expect(next.world.referenceLevel).toBe(p.level);
  });

  it('never heals past full, and runs every boss of «Todos los juramentos» to a victory', () => {
    let s: { trial: TrialProgress['trial']; run: TrialProgress['run']; world: WorldState } = start('oaths');
    const seen = [bossOf(s.world)?.species];
    let outcome: TrialProgress['outcome'] = null;
    for (let i = 0; i < 40 && !outcome; i++) {
      const p = step({ ...s, world: fell(s.world) }, SHRINE.pauseMs);
      outcome = p.outcome;
      if (p.entered) {
        seen.push(bossOf(p.world)?.species);
        expect(p.world.player.hp).toBeLessThanOrEqual(p.world.player.maxHp);
      }
      s = p;
    }
    expect(outcome).toBe('victory');
    expect(seen).toEqual(ORDER);
  });
});

describe('no-hit', () => {
  it('counts a hurt or a broken disguise as a hit, nothing else', () => {
    expect(trialHurt([])).toBe(false);
    expect(trialHurt([{ type: 'disguiseBroken' }])).toBe(true);
    expect(trialHurt([{ type: 'playerHurt', damage: 3 }])).toBe(true);
    expect(trialHurt([{ type: 'levelUp', level: 2 }])).toBe(false);
  });
});
