import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import {
  attemptsAfter,
  clearResume,
  createResumeWriter,
  encodeResume,
  packMinimap,
  parseResume,
  readResume,
  RESUME_KEY,
  RESUME_VERSION,
  resumeOwner,
  unpackMinimap,
  writeResume,
  type ResumeRecord,
  type RunLaunch,
  type RunPart,
} from '../../src/app/run-resume';
import { emptyTally } from '../../src/core/coins';
import { crossFogWall } from '../../src/core/fog-wall';
import { progressRun, startRun, tickRunClock, withFogWall, type RunState } from '../../src/core/run';
import { gauntletStops, heraldStop, progressTrial, SHRINE_BOSSES, startTrial, type TrialState } from '../../src/core/shrine';
import type { PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { CHALLENGES, DUNGEONS, ECLIPSE, floorsOf, SENDA_ROADS, TUTORIAL, type DungeonDef } from '../../src/data/dungeons';
import { WORLD } from '../../src/data/world';
import { buildTownGrid } from '../../src/town/map';

const BUILD = '9.9.9-test';
const WHO = { owner: 'local', build: BUILD };
const view = { x: 0, y: 0, width: 512, height: 320 };

/** The nearest living enemy, or null. */
const nearest = (world: WorldState) => {
  const alive = world.enemies.filter((e) => e.alive);
  return alive.length === 0 ? null : alive.reduce((best, e) => (Math.hypot(e.pos.x - world.player.pos.x, e.pos.y - world.player.pos.y) < Math.hypot(best.pos.x - world.player.pos.x, best.pos.y - world.player.pos.y) ? e : best));
};

/** Puts the player beside the nearest enemy, so the script fights (damage rolls consume the RNG). */
const engage = (world: WorldState): WorldState => {
  const foe = nearest(world);
  return foe ? { ...world, player: { ...world.player, pos: vec(foe.pos.x + 18, foe.pos.y) } } : world;
};

/** A scripted player: it closes on the nearest enemy and attacks it, rolling now and then, so enemies, projectiles and the RNG all move. */
function input(i: number, world: WorldState): PlayerInput {
  const foe = nearest(world);
  const toward = foe ? vec(foe.pos.x - world.player.pos.x, foe.pos.y - world.player.pos.y) : vec(Math.cos(i / 17), Math.sin(i / 17));
  const len = Math.hypot(toward.x, toward.y) || 1;
  const dir = vec(toward.x / len, toward.y / len);
  const close = foe !== null && len < 28;
  return {
    move: close ? vec(-dir.y, dir.x) : dir,
    aim: vec(world.player.pos.x + dir.x * 40, world.player.pos.y + dir.y * 40),
    aimPointer: false,
    roll: i % 97 === 0,
    slots: world.player.loadout.map((_, s) => s === (i % 60 < 40 ? 0 : 1)),
    slotMouse: world.player.loadout.map(() => false),
    lock: false,
    click: false,
    wheel: 0,
    view,
  };
}

interface Play {
  run: RunState;
  world: WorldState;
  trial: TrialState | null;
}

/** The game's per-tick order (src/app/game.ts `simulate`), without the presentation. */
function advance(from: Play, ticks: number, startTick = 0): Play {
  let { run, world, trial } = from;
  for (let i = 0; i < ticks; i++) {
    world = step(world, input(startTick + i, world), FIXED_DT_MS);
    run = tickRunClock(run, FIXED_DT_MS);
    const p = trial ? progressTrial(trial, run, world, FIXED_DT_MS) : progressRun(run, world);
    if (trial && 'trial' in p) trial = p.trial;
    if (p.outcome) break;
    if (p.entered) {
      run = p.run;
      world = trial ? p.world : withFogWall(p.run, p.world);
    } else {
      run = p.run;
      if (p.crossed) world = p.world;
    }
  }
  return { run, world, trial };
}

const partOf = (play: Play): RunPart => ({
  run: play.run,
  world: play.world,
  floorStart: play.world,
  tally: emptyTally(),
  floorStartTally: emptyTally(),
  kills: { ghost: 3 },
  floorStartKills: {},
  floorHit: true,
  restartsUsed: 1,
  simaSpent: 0,
  floorStartSpent: 0,
  bossPicks: [2],
  simaLog: [],
  memoriesRead: [],
  bossesMourned: [],
  lowHpSaid: false,
  merchantBerries: 0,
  merchantSold: false,
  shrineTimePaid: false,
  eventRewarded: false,
  bonfire: null,
  bonfireUsed: 0,
  trial: play.trial,
  trialHit: false,
  realMs: 4321,
});

const launchOf = (dungeon: string, play: Play): RunLaunch => ({ dungeon: dungeon as RunLaunch['dungeon'], seed: play.run.seed, difficulty: 'easy' });

const recordOf = (play: Play, dungeon: string, owner = 'local'): ResumeRecord => ({
  version: RESUME_VERSION,
  owner,
  build: BUILD,
  runId: 'run-1',
  savedAt: 1000,
  attempts: 0,
  kind: 'run',
  launch: launchOf(dungeon, play),
  part: partOf(play),
});

const roundTrip = (record: ResumeRecord, owner = 'local'): ResumeRecord | null => parseResume(encodeResume(record), owner, BUILD);

/** Plain JSON view: what a restored state must equal (undefined fields are not data). */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const everyDungeon: readonly DungeonDef[] = [...DUNGEONS, ...CHALLENGES, ...SENDA_ROADS, TUTORIAL];

describe('a run survives a reload', () => {
  for (const dungeon of everyDungeon) {
    for (const floor of [1, Math.min(3, floorsOf(dungeon))]) {
      it(`round-trips every dungeon kind: ${dungeon.id} floor ${floor} (state after restore equals state before, next ticks identical)`, { timeout: 60_000 }, () => {
        const started = startRun(11, {}, floor, dungeon.id);
        const before = advance({ run: started.run, world: engage(withFogWall(started.run, started.world)), trial: null }, 150);
        // The script really moved the world (a frozen one would make the comparison empty).
        expect(before.world.tick).toBeGreaterThan(started.world.tick);
        expect(before.world.player.pos).not.toEqual(started.world.player.pos);
        const restored = roundTrip(recordOf(before, dungeon.id));
        expect(restored?.kind).toBe('run');
        if (restored?.kind !== 'run') return;
        expect(restored.part.world).toEqual(plain(before.world));
        expect(restored.part.run).toEqual(plain(before.run));
        // The RNG continues: the next 240 ticks of both are the same world.
        const live = advance(before, 240, 150);
        const again = advance({ run: restored.part.run, world: restored.part.world, trial: null }, 240, 150);
        expect(plain(again.world)).toEqual(plain(live.world));
        expect(plain(again.run)).toEqual(plain(live.run));
        expect(again.world.rng).toBe(live.world.rng);
      });
    }
  }

  it('continues a consumed RNG exactly: crits rolled after the restore are the ones rolled without it', { timeout: 60_000 }, () => {
    const started = startRun(21, {}, 1, 'crypt-of-the-sword-king');
    const armed = engage({ ...started.world, player: { ...started.world.player, items: ['scope-lens', 'scope-lens', 'scope-lens', 'scope-lens'] } });
    const before = advance({ run: started.run, world: armed, trial: null }, 240);
    // The fight really drew from the generator (otherwise this proves nothing).
    expect(before.world.rng).not.toBe(started.world.rng);
    const restored = roundTrip(recordOf(before, 'crypt-of-the-sword-king'));
    if (restored?.kind !== 'run') throw new Error('not restored');
    expect(restored.part.world.rng).toBe(before.world.rng);
    const live = advance(before, 300, 240);
    const again = advance({ run: restored.part.run, world: restored.part.world, trial: null }, 300, 240);
    expect(live.world.rng).not.toBe(before.world.rng);
    expect(again.world.rng).toBe(live.world.rng);
    expect(plain(again.world)).toEqual(plain(live.world));
  });

  it('round-trips the Sima (endless clock included)', () => {
    const started = startRun(5, {}, 4, ECLIPSE.id);
    const before = advance({ run: started.run, world: withFogWall(started.run, started.world), trial: null }, 90);
    expect(before.run.clockMs).toBeDefined();
    const restored = roundTrip(recordOf(before, ECLIPSE.id));
    if (restored?.kind !== 'run') throw new Error('not restored');
    expect(restored.part.run.clockMs).toBe(before.run.clockMs);
    expect(plain(advance({ run: restored.part.run, world: restored.part.world, trial: null }, 120, 90).world)).toEqual(plain(advance(before, 120, 90).world));
  });

  const trials = [
    { name: 'a boss', stops: SHRINE_BOSSES.slice(0, 1) },
    { name: 'a gauntlet', stops: gauntletStops('oaths') },
    { name: 'a herald', stops: [heraldStop(7)] },
  ];
  for (const { name, stops } of trials) {
    it(`round-trips a shrine fight: ${name}`, { timeout: 60_000 }, () => {
      const t = startTrial(9, {}, stops);
      const before = advance({ run: t.run, world: engage(crossFogWall(t.world)), trial: t.trial }, 150);
      const restored = roundTrip({ ...(recordOf(before, stops[0]!.dungeon) as Extract<ResumeRecord, { kind: 'run' }>), launch: { dungeon: stops[0]!.dungeon, seed: 9, difficulty: 'easy', trial: { request: { kind: 'boss', id: stops[0]!.boss, stops, difficulty: 'easy' }, from: 'title', pick: { species: 'mimikyu', loadout: before.world.player.loadout } } } });
      if (restored?.kind !== 'run') throw new Error('not restored');
      expect(restored.part.trial).toEqual(plain(before.trial));
      expect(restored.launch.trial?.from).toBe('title');
      const live = advance(before, 200, 150);
      const again = advance({ run: restored.part.run, world: restored.part.world, trial: restored.part.trial }, 200, 150);
      expect(plain(again.world)).toEqual(plain(live.world));
    });
  }

  it('keeps the run meta the end screen and "Reiniciar planta" read', () => {
    const started = startRun(3, {}, 1, 'crypt-of-the-sword-king');
    const play = advance({ run: started.run, world: started.world, trial: null }, 30);
    const restored = roundTrip(recordOf(play, 'crypt-of-the-sword-king'));
    if (restored?.kind !== 'run') throw new Error('not restored');
    expect(restored.part).toMatchObject({ kills: { ghost: 3 }, floorHit: true, restartsUsed: 1, bossPicks: [2], realMs: 4321 });
    expect(restored.part.floorStart).toEqual(plain(play.world));
  });

  it('packs the minimap memory and restores it only onto a grid of the same size', () => {
    const seen = new Uint8Array(12);
    seen[0] = 1;
    seen[7] = 1;
    const text = packMinimap(seen);
    expect(unpackMinimap(text, 4, 3)).toEqual(seen);
    expect(unpackMinimap(text, 5, 3)).toBeNull();
    expect(unpackMinimap(undefined, 4, 3)).toBeNull();
    expect(unpackMinimap('01x1', 2, 2)).toBeNull();
  });
});

describe('a stored run is only trusted when it is whole', () => {
  const started = startRun(11, {}, 1, 'crypt-of-the-sword-king');
  const play = advance({ run: started.run, world: started.world, trial: null }, 30);
  const good = recordOf(play, 'crypt-of-the-sword-king');
  const withWorld = (patch: (w: Record<string, unknown>) => void): string => {
    const raw = JSON.parse(encodeResume(good)) as { part: { world: Record<string, unknown> } };
    patch(raw.part.world);
    return JSON.stringify(raw);
  };
  const withRecord = (patch: (r: Record<string, unknown>) => void): string => {
    const raw = JSON.parse(encodeResume(good)) as Record<string, unknown>;
    patch(raw);
    return JSON.stringify(raw);
  };

  it('accepts what it wrote', () => {
    expect(parseResume(encodeResume(good), 'local', BUILD)).not.toBeNull();
  });

  it.each([
    ['nothing', null],
    ['broken JSON', '{"version":1,'],
    ['a number', '7'],
    ['an array', '[]'],
  ])('rejects %s', (_name, text) => {
    expect(parseResume(text, 'local', BUILD)).toBeNull();
  });

  it('rejects old, newer and missing versions', () => {
    for (const version of [0, 2, 99, '1', null, undefined]) expect(parseResume(withRecord((r) => (r.version = version)), 'local', BUILD)).toBeNull();
  });

  it('rejects another owner: a run never crosses to another account', () => {
    expect(parseResume(encodeResume(good), 'user-42', BUILD)).toBeNull();
    expect(parseResume(encodeResume({ ...good, owner: 'user-42' }), 'user-42', BUILD)).not.toBeNull();
  });

  it('rejects an unknown kind, dungeon or malformed launch', () => {
    expect(parseResume(withRecord((r) => (r.kind = 'party')), 'local', BUILD)).toBeNull();
    expect(parseResume(withRecord((r) => ((r.launch as Record<string, unknown>).dungeon = 'nowhere')), 'local', BUILD)).toBeNull();
    expect(parseResume(withRecord((r) => ((r.launch as Record<string, unknown>).seed = 'x')), 'local', BUILD)).toBeNull();
    expect(parseResume(withRecord((r) => ((r.launch as Record<string, unknown>).difficulty = 'godlike')), 'local', BUILD)).toBeNull();
  });

  it('rejects a world that is corrupt', () => {
    expect(parseResume(withWorld((w) => ((w.player as Record<string, unknown>).hp = Number.NaN)), 'local', BUILD)).toBeNull();
    expect(parseResume(withWorld((w) => ((w.player as Record<string, unknown>).hp = null)), 'local', BUILD)).toBeNull();
    expect(parseResume(withWorld((w) => ((w.player as Record<string, unknown>).pos = { x: 'a', y: 1 })), 'local', BUILD)).toBeNull();
    expect(parseResume(withWorld((w) => (w.enemies = 'many')), 'local', BUILD)).toBeNull();
    expect(parseResume(withWorld((w) => ((w.arena as Record<string, unknown>).tiles = { cols: 3, rows: 3, tiles: [1] })), 'local', BUILD)).toBeNull();
    expect(parseResume(withWorld((w) => delete w.rng), 'local', BUILD)).toBeNull();
  });

  it('rejects a player who is already down: a defeat cannot be undone by a reload', () => {
    expect(parseResume(withWorld((w) => ((w.player as Record<string, unknown>).hp = 0)), 'local', BUILD)).toBeNull();
  });

  it('rejects a shared run: a guest, a host with company, or a party', () => {
    expect(parseResume(withWorld((w) => (w.role = 'guest')), 'local', BUILD)).toBeNull();
    expect(parseResume(withWorld((w) => (w.remotes = [{ id: 'p2' }])), 'local', BUILD)).toBeNull();
    expect(parseResume(withWorld((w) => (w.party = 3)), 'local', BUILD)).toBeNull();
  });

  it('rejects a record written by another build: a release may change the shape of the world', () => {
    expect(parseResume(encodeResume(good), 'local', '9.9.8')).toBeNull();
  });

  it('rejects a record whose last restore crashed', () => {
    expect(parseResume(encodeResume({ ...good, attempts: 1 }), 'local', BUILD)).toBeNull();
  });

  it('rejects a world the engine cannot step', () => {
    expect(parseResume(withWorld((w) => (w.projectiles = [{ id: 'x' }])), 'local', BUILD)).toBeNull();
  });

  it('rejects a trial with no stops or a bad arena', () => {
    const t = startTrial(9, {}, SHRINE_BOSSES.slice(0, 1));
    const trialPlay = advance({ run: t.run, world: crossFogWall(t.world), trial: t.trial }, 10);
    const rec = recordOf(trialPlay, SHRINE_BOSSES[0]!.dungeon);
    const tampered = JSON.parse(encodeResume(rec)) as { part: { trial: { index: number } } };
    tampered.part.trial.index = 5;
    expect(parseResume(JSON.stringify(tampered), 'local', BUILD)).toBeNull();
  });
});

describe('the town spot', () => {
  const town = (patch: Partial<Extract<ResumeRecord, { kind: 'town' }>> = {}): ResumeRecord => ({ version: RESUME_VERSION, owner: 'local', build: BUILD, runId: 'town-1', savedAt: 5, attempts: 0, kind: 'town', at: 'refugio', tile: { x: WORLD.refugio.spawn!.x, y: WORLD.refugio.spawn!.y }, ...patch });

  it('restores the map and the tile', () => {
    const grid = buildTownGrid(WORLD.mirador);
    const index = grid.tiles.findIndex((t) => t === 1);
    const tile = { x: index % grid.cols, y: Math.floor(index / grid.cols) };
    expect(roundTrip(town({ at: 'mirador', tile }))).toMatchObject({ kind: 'town', at: 'mirador', tile });
  });

  it('rejects an unknown map, a tile outside it or one inside a wall', () => {
    expect(roundTrip(town({ at: 'moon' as never }))).toBeNull();
    expect(roundTrip(town({ tile: { x: 9999, y: 2 } }))).toBeNull();
    expect(roundTrip(town({ tile: { x: -1, y: 2 } }))).toBeNull();
    expect(roundTrip(town({ tile: { x: 0.5, y: 2 } }))).toBeNull();
    expect(roundTrip(town({ tile: { x: 0, y: 0 } }))).toBeNull();
  });

  it('is tied to its owner and version like a run', () => {
    expect(parseResume(encodeResume(town()), 'someone', BUILD)).toBeNull();
    expect(roundTrip({ ...town(), version: 2 as never })).toBeNull();
  });
});

describe('the record lives and dies with its run', () => {
  const started = startRun(11, {}, 1, 'crypt-of-the-sword-king');
  const play = advance({ run: started.run, world: started.world, trial: null }, 20);
  const launch = launchOf('crypt-of-the-sword-king', play);
  const open = () => {
    const store = memoryStore();
    const writer = createResumeWriter(store, WHO, launch, 'run-A', 0, () => 123);
    return { store, writer };
  };

  it('writes while the run is alive', () => {
    const { store, writer } = open();
    writer.save(partOf(play));
    expect(store.get(RESUME_KEY)).not.toBeNull();
    expect(readResume(store, 'local', BUILD)?.kind).toBe('run');
  });

  it.each(['victory', 'defeat', 'abandon'])('is cleared when the run ends in %s, and a late pagehide cannot bring it back', () => {
    const { store, writer } = open();
    writer.save(partOf(play));
    writer.end();
    expect(store.get(RESUME_KEY)).toBeNull();
    writer.save(partOf(play));
    expect(store.get(RESUME_KEY)).toBeNull();
    expect(readResume(store, 'local', BUILD)).toBeNull();
  });

  it('leaves no record while the player is down, and writes again once up', () => {
    const { store, writer } = open();
    writer.save(partOf(play));
    writer.suspend();
    expect(store.get(RESUME_KEY)).toBeNull();
    writer.save(partOf(play));
    expect(readResume(store, 'local', BUILD)).not.toBeNull();
    writer.end();
    writer.suspend();
    expect(store.get(RESUME_KEY)).toBeNull();
  });

  it('only clears its own record: another tab keeps the one it wrote', () => {
    const { store, writer } = open();
    writer.save(partOf(play));
    clearResume(store, 'run-B');
    expect(readResume(store, 'local', BUILD)).not.toBeNull();
    clearResume(store, 'run-A');
    expect(readResume(store, 'local', BUILD)).toBeNull();
  });

  it('drops a record that does not parse when it is read, so it is not tried twice', () => {
    const store = memoryStore();
    store.set(RESUME_KEY, '{nope');
    expect(readResume(store, 'local', BUILD)).toBeNull();
    expect(store.get(RESUME_KEY)).toBeNull();
  });

  it('drops a record of another account when it is read', () => {
    const { store, writer } = open();
    writer.save(partOf(play));
    expect(readResume(store, 'user-9', BUILD)).toBeNull();
    expect(store.get(RESUME_KEY)).toBeNull();
  });

  it('never throws when the store fails', () => {
    const broken = { get: () => { throw new Error('denied'); }, set: () => { throw new Error('full'); } };
    expect(() => createResumeWriter(broken, WHO, launch, 'run-A', 0, () => 1).save(partOf(play))).not.toThrow();
    expect(readResume(broken, 'local', BUILD)).toBeNull();
    expect(() => clearResume(broken)).not.toThrow();
    expect(() => writeResume(broken, recordOf(play, 'crypt-of-the-sword-king'))).not.toThrow();
  });

  it('counts a crash only when one happened since the restore', () => {
    expect(attemptsAfter(0, false)).toBe(0);
    expect(attemptsAfter(0, true)).toBe(1);
    expect(attemptsAfter(1, false)).toBe(0);
  });

  it('names the owner: the account, else this device', () => {
    expect(resumeOwner('u1')).toBe('u1');
    expect(resumeOwner(null)).toBe('local');
    expect(resumeOwner(undefined)).toBe('local');
  });
});
