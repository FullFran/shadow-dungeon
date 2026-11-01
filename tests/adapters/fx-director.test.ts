import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENEMY_BEHAVIOUR } from '../../src/data/enemies';
import { MOVES, type MoveDef } from '../../src/data/moves';
import { arrivalCue, projectileCue, enemyStrikeCue, deathCue, eventCue, eventDoneCue, stanceCue, rollDustCue, WORLD_CUES, cueRequest } from '../../src/adapters/fx/cues';
import { FxDirector, moveSpawn, type DirectorView } from '../../src/adapters/fx/director';
import { EFFECT_IDS, loadEffect } from '../../src/adapters/fx/effects';
import { bakeEffect } from '../../src/adapters/fx/bake';
import { FxStore, type FxBackend } from '../../src/adapters/fx/store';
import { FxSystem, MAX_LIVE, type FxSpawn } from '../../src/adapters/fx/system';
import type { BakeMessage } from '../../src/adapters/fx/bake.worker';
import type { PokemonType } from '../../src/data/types';
import { TYPE_COLORS } from '../../src/ui/tokens';

/** A system recording what would play, with every art ready. */
function recording(): { fx: FxSystem; spawned: FxSpawn[] } {
  const fx = new FxSystem(new FxStore(null));
  const spawned: FxSpawn[] = [];
  fx.spawn = (spawn) => {
    spawned.push(spawn);
    return true;
  };
  return { fx, spawned };
}

const ALL_TYPES = Object.keys(TYPE_COLORS) as PokemonType[];

const player = (action: unknown = null, roll: unknown = null) =>
  ({ pos: { x: 100, y: 100 }, action, roll, items: [], upgrades: [], level: 1 }) as unknown as DirectorView['player'];
const swing = (moveId: string, phase = 'active') => ({ moveId, phase, phaseMs: 0, chargeMs: 0, chargeLevel: 0, aimDir: { x: 0, y: 1 } });
const enemy = (over: Record<string, unknown> = {}) =>
  ({ id: 'e1', species: 'zubat', types: ['poison'], pos: { x: 50, y: 50 }, radius: 10, alive: true, hitstunMs: 0, ai: { mode: 'idle', modeMs: 0, modeDurationMs: 0, attackDir: { x: 1, y: 0 } }, ...over }) as unknown as DirectorView['enemies'][number];
const view = (over: Partial<DirectorView> = {}): DirectorView => ({ player: player(), remotes: [], enemies: [], ...over });

describe('moves', () => {
  it.each((Object.values(MOVES) as MoveDef[]).map((m) => [m.id, m] as const))('%s plays at its own reach, or flies as a shot', (_id, move) => {
    const spawn = moveSpawn(move, player(swing(move.id)) as never);
    if (move.hitbox.kind === 'projectile') expect(spawn).toBeNull();
    else {
      expect(spawn?.fit).toBeGreaterThan(0);
      expect(EFFECT_IDS).toContain(spawn?.cue.effect);
    }
  });

  it('plays once when the swing turns active, not while winding up nor again during it', () => {
    const { fx, spawned } = recording();
    const director = new FxDirector(fx);
    director.observe(view({ player: player(swing('slash', 'windup')) }));
    expect(spawned).toHaveLength(0);
    director.observe(view({ player: player(swing('slash')) }));
    director.observe(view({ player: player(swing('slash')) }));
    expect(spawned).toHaveLength(1);
    expect(spawned[0]?.angle).toBeCloseTo(Math.PI / 2);
  });

  it('a co-op peer swing plays from its snapshot', () => {
    const { fx, spawned } = recording();
    const director = new FxDirector(fx);
    director.observe(view({ remotes: [{ id: 'p2', player: player(swing('earthquake')) }] }));
    expect(spawned.map((s) => s.cue.effect)).toEqual(['nature/quake']);
    expect(spawned[0]?.placement).toBe('body');
  });

  it('a move plays under the telegraphs, an impact over the sprites', () => {
    for (const move of Object.values(MOVES) as MoveDef[]) {
      const spawn = moveSpawn(move, player(swing(move.id)) as never);
      if (spawn) expect(spawn.layer, move.id).toBe('ground');
    }
    const { fx, spawned } = recording();
    new FxDirector(fx).handleEvents([{ type: 'enemyHit', enemyId: 'e1', damage: 5, effectiveness: 1, pos: { x: 1, y: 1 }, moveId: 'slash' }], { pos: { x: 0, y: 0 } });
    expect(spawned[0]?.layer).toBe('top');
  });

  it('a roll kicks up dust once', () => {
    const { fx, spawned } = recording();
    const director = new FxDirector(fx);
    director.observe(view({ player: player(null, { ms: 0 }) }));
    director.observe(view({ player: player(null, { ms: 10 }) }));
    expect(spawned.map((s) => s.cue.effect)).toEqual([rollDustCue().effect]);
  });
});

describe('enemies, from state a guest also has', () => {
  it('an attack starting plays its strike once', () => {
    const { fx, spawned } = recording();
    const director = new FxDirector(fx);
    director.observe(view({ enemies: [enemy()] }));
    director.observe(view({ enemies: [enemy({ ai: { mode: 'attack', attackDir: { x: 1, y: 0 } } })] }));
    director.observe(view({ enemies: [enemy({ ai: { mode: 'attack', attackDir: { x: 1, y: 0 } } })] }));
    expect(spawned).toHaveLength(1);
  });

  it('nothing plays for what was already so on the first look (joining mid-fight, a new floor)', () => {
    const { fx, spawned } = recording();
    new FxDirector(fx).observe(view({ enemies: [enemy({ alive: false }), enemy({ id: 'e2', ai: { mode: 'attack' } })] }));
    expect(spawned).toHaveLength(0);
  });

  it('a death puffs once, a boss blasts', () => {
    const { fx, spawned } = recording();
    const director = new FxDirector(fx);
    director.observe(view({ enemies: [enemy(), enemy({ id: 'b', boss: { stance: 'blade' } })] }));
    director.observe(view({ enemies: [enemy({ alive: false }), enemy({ id: 'b', alive: false, boss: { stance: 'blade' } })] }));
    director.observe(view({ enemies: [enemy({ alive: false }), enemy({ id: 'b', alive: false, boss: { stance: 'blade' } })] }));
    expect(spawned.map((s) => s.cue.effect)).toEqual(['spawn/poof', 'explosions/plasma-explosion']);
  });

  it('a boss changing stance flares', () => {
    const { fx, spawned } = recording();
    const director = new FxDirector(fx);
    director.observe(view({ enemies: [enemy({ boss: { stance: 'blade' } })] }));
    director.observe(view({ enemies: [enemy({ boss: { stance: 'shield' } })] }));
    expect(spawned).toHaveLength(1);
  });

  it('a peer hit shows from the snapshot; the local hit is not drawn twice', () => {
    const { fx, spawned } = recording();
    const director = new FxDirector(fx);
    director.observe(view({ enemies: [enemy()] }), 0);
    director.observe(view({ enemies: [enemy({ hitstunMs: 200 })] }), 1000);
    expect(spawned).toHaveLength(1);
    director.observe(view({ enemies: [enemy()] }), 2000);
    director.handleEvents([{ type: 'enemyHit', enemyId: 'e1', damage: 5, effectiveness: 1, pos: { x: 1, y: 1 }, moveId: 'slash' }], { pos: { x: 0, y: 0 } });
    director.observe(view({ enemies: [enemy({ hitstunMs: 400 })] }), 2016);
    expect(spawned).toHaveLength(2);
  });

  it('a guest whose predicted hit is undone by a late snapshot and confirmed again sees one spark', () => {
    const { fx, spawned } = recording();
    const director = new FxDirector(fx);
    director.observe(view({ enemies: [enemy()] }), 1000);
    director.handleEvents([{ type: 'enemyHit', enemyId: 'e1', damage: 5, effectiveness: 1, pos: { x: 1, y: 1 }, moveId: 'slash' }], { pos: { x: 0, y: 0 } });
    director.observe(view({ enemies: [enemy({ hitstunMs: 200 })] }), 1016);
    director.observe(view({ enemies: [enemy()] }), 1066);
    director.observe(view({ enemies: [enemy({ hitstunMs: 180 })] }), 1116);
    expect(spawned).toHaveLength(1);
  });

  it('a guest whose predicted kill is undone by a late snapshot and confirmed again sees one death', () => {
    const { fx, spawned } = recording();
    const director = new FxDirector(fx);
    director.observe(view({ enemies: [enemy()] }), 1000);
    director.observe(view({ enemies: [enemy({ alive: false })] }), 1016);
    director.observe(view({ enemies: [enemy()] }), 1066);
    director.observe(view({ enemies: [enemy({ alive: false })] }), 1116);
    expect(spawned.map((s) => s.cue.effect)).toEqual(['spawn/poof']);
  });

  it('after a reset, a new floor stays quiet on its first look', () => {
    const { fx, spawned } = recording();
    const director = new FxDirector(fx);
    director.observe(view({ enemies: [enemy()] }), 0);
    director.reset();
    director.observe(view({ enemies: [enemy({ id: 'e9' }), enemy({ id: 'e10' })] }), 16);
    expect(spawned).toHaveLength(0);
  });

  it('a summon mid-floor puffs in, what was there at the start does not', () => {
    const { fx, spawned } = recording();
    const director = new FxDirector(fx);
    director.observe(view({ enemies: [enemy()] }));
    expect(spawned).toHaveLength(0);
    director.observe(view({ enemies: [enemy(), enemy({ id: 'e2' })] }));
    expect(spawned.map((s) => s.cue.effect)).toEqual(['spawn/poof']);
  });

  it('a floor event paying out bursts once, and a floor entered with it done stays quiet', () => {
    const { fx, spawned } = recording();
    const director = new FxDirector(fx);
    const event = { kind: 'crystal', pos: { x: 1, y: 1 } };
    director.observe(view({ simaEvent: event }));
    director.observe(view({ simaEvent: { ...event, done: true } }));
    director.observe(view({ simaEvent: { ...event, done: true } }));
    expect(spawned.map((s) => s.cue.effect)).toEqual(['ice/ice-shatter']);
    const second = recording();
    new FxDirector(second.fx).observe(view({ simaEvent: { ...event, done: true } }));
    expect(second.spawned).toHaveLength(0);
  });

  it('a damage-over-time tick shows no hit spark', () => {
    const { fx, spawned } = recording();
    new FxDirector(fx).handleEvents([{ type: 'enemyHit', enemyId: 'e1', damage: 1, effectiveness: 1, pos: { x: 1, y: 1 }, dot: 'burn' }], { pos: { x: 0, y: 0 } });
    expect(spawned).toHaveLength(0);
  });

  it.each(Object.entries(ENEMY_BEHAVIOUR))('%s has a strike', (_species, def) => {
    expect(EFFECT_IDS).toContain(enemyStrikeCue(def?.kind, 'normal').effect);
  });
});

describe('wiring read from the source', () => {
  const game = readFileSync('src/app/game.ts', 'utf8');
  const renderer = readFileSync('src/adapters/renderer.ts', 'utf8');

  it('every floor change resets the director', () => {
    const enterFloor = game.slice(game.indexOf('function enterFloor('), game.indexOf('function enterFloor(') + 3000);
    expect(enterFloor).toContain('fxDirector.reset()');
    expect(enterFloor).toContain('fxDirector.prepare(');
    expect(game).toMatch(/let world: WorldState[^\n]*\n[\s\S]{0,800}fxDirector\.prepare\(world\.player\.loadout\)/);
  });

  it('effects on the ground go under the telegraphs', () => {
    expect(renderer.indexOf("fx?.draw(ctx, 'ground')")).toBeGreaterThan(0);
    expect(renderer.indexOf("fx?.draw(ctx, 'ground')")).toBeLessThan(renderer.indexOf('telegraphs(enemy, posOf(enemy.id, enemy.pos), timeMs)'));
  });

  it('the stairs stay the Mystery Dungeon stairs: no effect on them', () => {
    const start = renderer.indexOf('function stairsTile(');
    expect(renderer.slice(start, renderer.indexOf('\n  }\n', start))).not.toContain('fx');
    expect(WORLD_CUES).not.toHaveProperty('stairs');
  });

  it("a peer's shots keep their velocity, so they fly with their baked look", () => {
    expect(renderer).toMatch(/for \(const p of remote\.projectiles\) drawables\.push\(projectile\(\{[^}]*vel: p\.vel/);
  });
});

describe('art', () => {
  it('every moving shot keeps its head on the anchor: none uses art that is tall around it', async () => {
    for (const type of ALL_TYPES) {
      const c = projectileCue(type);
      const baked = bakeEffect(await loadEffect(c.effect), cueRequest(c));
      expect(baked.bounds.bottom - baked.bounds.top, `${type} ${c.effect}`).toBeLessThan(80);
    }
  }, 60_000);

  it('every enemy, world and event look exists, bakes and takes its tint', async () => {
    const kinds = new Set(Object.values(ENEMY_BEHAVIOUR).map((d) => d?.kind));
    const cues = [...[...kinds].map((k) => enemyStrikeCue(k, 'water')), deathCue('normal', false), deathCue('normal', true), stanceCue('fire'), rollDustCue(), arrivalCue(), eventDoneCue('crystal'), eventDoneCue('vault'), ...Object.values(WORLD_CUES),
      ...['levelUp', 'berryEaten', 'perfectDodge', 'playerHurt', 'cardCaptured', 'disguiseBroken'].map((type) => eventCue({ type })!)];
    for (const c of cues) {
      const mod = await loadEffect(c.effect);
      if (c.tint) expect(mod.meta?.options, c.effect).toHaveProperty('palette');
      expect(bakeEffect(mod, cueRequest(c)).frames.some((f) => f.w > 0), c.effect).toBe(true);
    }
  }, 120_000);
});

describe('store and system', () => {
  function fakeBackend(): FxBackend & { posted: BakeMessage[]; released: unknown[] } {
    return { posted: [], released: [], onReply: null, post(m) { this.posted.push(m); }, toImage: async () => ({}) as CanvasImageSource, release(i) { this.released.push(i); } };
  }
  const baked = (w: number, h: number) => ({ width: w, height: h, pixels: new Uint8ClampedArray(w * h * 4), frames: [{ x: 0, y: 0, w, h, dx: 0, dy: 0 }], loop: false, bounds: { left: 0, top: 0, right: w, bottom: h } });
  const flush = () => new Promise((r) => setTimeout(r, 0));

  it('asks to bake once, then serves it', async () => {
    const backend = fakeBackend();
    const store = new FxStore(backend);
    expect(store.get('a', { effect: 'x', frames: 1 })).toBeNull();
    expect(store.get('a', { effect: 'x', frames: 1 })).toBeNull();
    expect(backend.posted).toHaveLength(1);
    backend.onReply?.({ key: 'a', baked: baked(10, 10) });
    await flush();
    expect(store.get('a', { effect: 'x', frames: 1 })).not.toBeNull();
    expect(store.decodedBytes).toBe(400);
  });

  it('a failed bake is not retried: the hand-drawn look stays', async () => {
    const backend = fakeBackend();
    const store = new FxStore(backend);
    store.get('a', { effect: 'x', frames: 1 });
    backend.onReply?.({ key: 'a', error: 'boom' });
    await flush();
    expect(store.get('a', { effect: 'x', frames: 1 })).toBeNull();
    expect(backend.posted).toHaveLength(1);
  });

  it('over the cap it drops the longest unused, never one in use', async () => {
    const backend = fakeBackend();
    const store = new FxStore(backend, 1000);
    store.tick(0);
    store.get('old', { effect: 'x', frames: 1 });
    backend.onReply?.({ key: 'old', baked: baked(10, 10) });
    await flush();
    store.tick(10_000);
    store.get('new', { effect: 'x', frames: 1 });
    store.get('other', { effect: 'x', frames: 1 });
    backend.onReply?.({ key: 'new', baked: baked(15, 15) });
    await flush();
    expect(backend.released).toHaveLength(1);
    expect(store.decodedBytes).toBe(900);
    store.get('new', { effect: 'x', frames: 1 });
    backend.onReply?.({ key: 'other', baked: baked(15, 15) });
    await flush();
    // 'new' was drawn just now: kept, even past the cap, until it goes idle.
    expect(backend.released).toHaveLength(1);
  });

  it('keeps at most MAX_LIVE effects and ends them after their play', async () => {
    const backend = fakeBackend();
    const store = new FxStore(backend);
    const cue = { effect: 'x', tint: null, frames: 1, playMs: 100 };
    const system = new FxSystem(store);
    expect(system.spawn({ cue, x: 0, y: 0, placement: 'body', layer: 'top' })).toBe(false);
    backend.onReply?.({ key: backend.posted[0]!.key, baked: baked(4, 4) });
    await flush();
    for (let i = 0; i < MAX_LIVE + 5; i++) system.spawn({ cue, x: 0, y: 0, placement: 'body', layer: 'top' });
    expect(system.liveCount).toBe(MAX_LIVE);
    system.update(100);
    expect(system.liveCount).toBe(0);
  });
});
