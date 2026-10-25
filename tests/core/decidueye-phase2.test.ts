import { describe, expect, it } from 'vitest';
import { DECIDUEYE, ENEMY_SHOT_CAP, spellCardKey } from '../../src/data/enemies';
import { ROOMS } from '../../src/data/rooms';
import { TUNING } from '../../src/data/tuning';
import { fanPerch, rainSafeLane, stitchSources } from '../../src/core/archer';
import { spawnShot } from '../../src/core/brain';
import { insideRect } from '../../src/core/geometry';
import type { GameEvent, ProjectileState, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { distance, vec } from '../../src/core/vec';
import { loadRoom } from '../../src/core/rooms';
import { createWorld } from '../../src/core/world';
import { catalog, LANGUAGES } from '../../src/i18n';
import { IDLE, ticksFor } from './helpers';

const P2 = DECIDUEYE.phase2;
const PLAYER_D = 2 * TUNING.player.radius;
const first = (s: WorldState) => s.enemies[0]!;
const roost = (): WorldState => loadRoom(createWorld({ seed: 1, arena: { width: 1, height: 1 }, playerPos: vec(0, 0) }), 'roost');
/** The roost with Decidueye at half HP (or below `share`). */
const wounded = (share = 0.5, state = roost()): WorldState => ({ ...state, enemies: state.enemies.map((e) => ({ ...e, hp: e.maxHp * share })) });

function watch(state: WorldState, ms: number, until: (s: WorldState) => boolean = () => false) {
  let current = state;
  const events: GameEvent[] = [];
  const shots = new Map<string, ProjectileState>();
  let most = 0;
  for (let i = 0; i < ticksFor(ms) && !until(current); i++) {
    current = step({ ...current, player: { ...current.player, hp: current.player.maxHp } }, IDLE, FIXED_DT_MS);
    events.push(...current.events);
    for (const p of current.projectiles) if (!shots.has(p.id)) shots.set(p.id, p);
    most = Math.max(most, current.projectiles.filter((p) => p.owner === 'enemy').length);
  }
  return { state: current, events, shots: [...shots.values()], most };
}
const stances = (events: GameEvent[]) => events.flatMap((e) => (e.type === 'bossStance' ? [e.stance] : []));
const inPhase2 = () => watch(wounded(), 4000, (s) => first(s).boss?.phase === 2 && first(s).ai.mode === 'approach').state;
const untilCard = (card: string) => (s: WorldState) => first(s).boss?.stance === card && first(s).ai.mode === 'telegraph';

describe('Decidueye phase 2', () => {
  it('fades into the mist once at half HP ("El Arquero se desvanece en la niebla"), a long harmless opening, never in a Sima echo', () => {
    const fade = watch(wounded(), 400);
    expect(stances(fade.events)[0]).toBe('mist');
    const mist = fade.events.find((e) => e.type === 'enemyTelegraph' && e.attack === 'mist');
    expect(mist && mist.type === 'enemyTelegraph' ? mist.durationMs : 0).toBe(P2.mistMs);
    expect(P2.mistMs).toBeGreaterThanOrEqual(1500);
    const after = watch(fade.state, 3000);
    expect(first(after.state).boss?.phase).toBe(2);
    // Lower again: no second fade.
    const lower = watch(wounded(0.2, after.state), 20000);
    expect(stances(lower.events)).not.toContain('mist');
    // An echo stays in phase 1.
    const echo = watch({ ...wounded(), enemyScale: { hp: 1, damage: 1, echo: true as const } }, 2000);
    expect(stances(echo.events)).not.toContain('mist');
    for (const language of LANGUAGES) expect(catalog(language)[spellCardKey('decidueye', 'mist')!]).toBeTruthy();
    expect(catalog('es')[spellCardKey('decidueye', 'mist')!]).toBe('El Arquero se desvanece en la niebla');
  });

  it('plays rain, fan, feathers, dive and stitch in turn, each named and every telegraph at least half a second', () => {
    const { events } = watch(inPhase2(), 90000, (s) => (first(s).boss?.combosDone ?? 0) >= P2.cards.length);
    const played = stances(events).filter((s) => s !== 'mist');
    expect(played.slice(0, 5)).toEqual(['rain', 'fan', 'feathers', 'dive', 'stitch']);
    for (const t of events) if (t.type === 'enemyTelegraph' && t.attack !== 'vanish') expect(t.durationMs, t.attack).toBeGreaterThanOrEqual(500);
    for (const card of ['rain', 'feathers', 'stitch'] as const) {
      for (const language of LANGUAGES) {
        expect(catalog(language)[spellCardKey('decidueye', card)!]).toMatch(/«.+»/);
        expect(catalog(language)[`boss.stance.${card}`]).toBeTruthy();
      }
    }
  });

  it('rain: arrows pour down every lane but one; the safe lane moves one lane each wave, the last wave is gone before the next pours; a roll does not save you', () => {
    const start = watch(inPhase2(), 20000, untilCard('rain')).state;
    const laneW = start.arena.width / P2.rain.lanes;
    const safeLanes: number[] = [];
    let state = start;
    let lastSpawnEnd = -1;
    for (let wave = 0; wave < P2.rain.waves; wave++) {
      const safe = rainSafeLane(first(state), start.arena.width);
      safeLanes.push(safe);
      const before = new Set(state.projectiles.map((p) => p.id));
      // Rain arrows of the last wave are all gone (fallen or stopped) before this wave pours.
      const pouring = watch(state, 4000, (s) => s.projectiles.some((p) => !before.has(p.id) && p.pierceRoll === true));
      if (lastSpawnEnd >= 0) expect(pouring.state.projectiles.filter((p) => before.has(p.id) && p.pierceRoll)).toHaveLength(0);
      const wave = watch(pouring.state, P2.rain.spawnMs + 50);
      const arrows = wave.shots.concat(pouring.state.projectiles).filter((p) => !before.has(p.id) && p.pierceRoll === true);
      expect(arrows.length).toBeGreaterThan(P2.rain.lanes);
      const lanes = new Set(arrows.map((p) => Math.floor(p.pos.x / laneW)));
      expect(lanes.has(safe)).toBe(false);
      expect(lanes.size).toBe(P2.rain.lanes - 1);
      // The safe lane leaves room: neighbouring columns are far enough from its middle.
      const middle = (safe + 0.5) * laneW;
      for (const p of arrows) expect(Math.abs(p.pos.x - middle) - P2.rain.arrow.radius).toBeGreaterThan(PLAYER_D * 1.5);
      state = watch(wave.state, 3000, (s) => first(s).boss?.comboIndex !== first(wave.state).boss?.comboIndex || first(s).ai.mode === 'recover').state;
      lastSpawnEnd = 1;
    }
    for (let i = 1; i < safeLanes.length; i++) expect(Math.abs(safeLanes[i]! - safeLanes[i - 1]!)).toBe(1);
    expect(P2.rain.arrow.pierceRoll).toBe(true);
    expect(P2.rain.waveTelegraphMs).toBeGreaterThanOrEqual(500);
  });

  it('the roost trees stop arrows and leaves, and stand clear of the perches, the start and the archer', () => {
    const trees = ROOMS.roost.obstacles.filter((o) => o.cover);
    expect(trees.length).toBeGreaterThanOrEqual(3);
    const r = ROOMS.roost;
    const points = [vec(r.playerStart.x, r.playerStart.y), vec(r.spawns[0]!.x, r.spawns[0]!.y), ...[vec(320, 380), vec(320, 20), vec(20, 200), vec(620, 200)].map((p) => fanPerch(r, p, DECIDUEYE.fan.edgeInset))];
    for (const t of trees) for (const p of points) expect(distance(p, vec(t.x + t.width / 2, t.y + t.height / 2))).toBeGreaterThan(t.width);
    // A rain of arrows: none is ever inside a tree.
    const start = watch(inPhase2(), 20000, untilCard('rain')).state;
    let state = start;
    for (let i = 0; i < ticksFor(4000); i++) {
      state = step({ ...state, player: { ...state.player, hp: state.player.maxHp } }, IDLE, FIXED_DT_MS);
      for (const p of state.projectiles) for (const t of trees) expect(insideRect(p.pos, t)).toBe(false);
    }
  });

  it('feathers: from the middle of the clearing, arms wind out with room between the shots of an arm', () => {
    const start = watch(inPhase2(), 40000, untilCard('feathers')).state;
    expect(distance(first(start).pos, vec(start.arena.width / 2, start.arena.height / 2))).toBeLessThan(2);
    const f = P2.feathers;
    const r = 150;
    const turn = (f.turnDegrees * Math.PI) / 180;
    const back = r - (f.feather.speed * f.everyMs) / 1000;
    expect(distance(vec(r, 0), vec(back * Math.cos(turn), back * Math.sin(turn))) - 2 * f.feather.radius).toBeGreaterThan(PLAYER_D + 6);
    const { shots } = watch(start, 6000, (s) => first(s).ai.mode === 'recover');
    expect(shots.filter((p) => p.radius === f.feather.radius && p.type === f.feather.type)).toHaveLength(f.arms * f.bursts);
  });

  it('stitch: two shadow clones in the far corners and the archer aim at one spot, which stops following before they fire', () => {
    const start = watch(inPhase2(), 60000, untilCard('stitch')).state;
    const sources = stitchSources(first(start), start.arena);
    expect(sources).toHaveLength(3);
    const aim = first(start).ai.aimPoint!;
    const far = aim.y > start.arena.height / 2 ? P2.stitch.inset : start.arena.height - P2.stitch.inset;
    expect(sources.slice(1).every((p) => p.y === far)).toBe(true);
    const locked = watch(start, 2000, (s) => first(s).ai.modeDurationMs - first(s).ai.modeMs <= P2.stitch.lockMs).state;
    const lockAim = first(locked).ai.aimPoint!;
    const moved = { ...locked, player: { ...locked.player, pos: vec(locked.player.pos.x + 120, locked.player.pos.y) } };
    const fired = watch(moved, 1000, (s) => s.projectiles.some((p) => p.type === P2.stitch.arrow.type && p.radius === P2.stitch.arrow.radius && !p.pierceRoll)).state;
    const lines = fired.projectiles.filter((p) => p.radius === P2.stitch.arrow.radius && p.type === P2.stitch.arrow.type && !p.pierceRoll);
    expect(lines.length).toBe(3 * P2.stitch.arrowsPerLine);
    // Every arrow heads for the locked spot.
    for (const p of lines) {
      const to = { x: lockAim.x - p.pos.x, y: lockAim.y - p.pos.y };
      const cos = (to.x * p.vel.x + to.y * p.vel.y) / (Math.hypot(to.x, to.y) * Math.hypot(p.vel.x, p.vel.y));
      expect(cos).toBeGreaterThan(0.99);
    }
  });

  it('never has more enemy projectiles in the air than the cap', () => {
    let state = roost();
    for (let i = 0; i < ENEMY_SHOT_CAP + 20; i++) state = spawnShot(state, first(state), DECIDUEYE.volley.arrow, vec(1, 0));
    expect(state.projectiles.filter((p) => p.owner === 'enemy')).toHaveLength(ENEMY_SHOT_CAP);
    const { most } = watch(inPhase2(), 60000);
    expect(most).toBeLessThanOrEqual(ENEMY_SHOT_CAP);
    expect(most).toBeGreaterThan(40);
  });
});

