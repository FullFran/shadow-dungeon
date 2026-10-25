import { describe, expect, it } from 'vitest';
import { spellCardKey, TREVENANT } from '../../src/data/enemies';
import { ROOMS } from '../../src/data/rooms';
import { TUNING } from '../../src/data/tuning';
import { curseGapDir, rootLanes, treantCardAt } from '../../src/core/treant';
import type { GameEvent, PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { distance, vec, type Vec2 } from '../../src/core/vec';
import { guestEnemyContacts } from '../../src/core/victim';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { catalog, LANGUAGES } from '../../src/i18n';
import { IDLE, ticksFor } from './helpers';

const HOLLOW = { width: ROOMS.hollow.width, height: ROOMS.hollow.height };
const PLAYER_D = 2 * TUNING.player.radius;
const fight = (playerPos: Vec2 = vec(400, 520), treePos: Vec2 = vec(400, 230)) =>
  spawnEnemy(createWorld({ seed: 1, arena: HOLLOW, playerPos }), 'trevenant', treePos);
const first = (s: WorldState) => s.enemies[0]!;
const hurt = (events: GameEvent[]) => events.some((e) => e.type === 'playerHurt' || e.type === 'disguiseBroken');
/** Steps with the player kept alive and in place (an invulnerable dummy), collecting events and every projectile seen. */
function watch(state: WorldState, ms: number, until: (s: WorldState) => boolean = () => false, playerInput: PlayerInput = IDLE) {
  let current = state;
  const events: GameEvent[] = [];
  const shots = new Map<string, WorldState['projectiles'][number]>();
  for (let i = 0; i < ticksFor(ms) && !until(current); i++) {
    current = step({ ...current, player: { ...current.player, hp: current.player.maxHp } }, playerInput, FIXED_DT_MS);
    events.push(...current.events);
    for (const p of current.projectiles) if (!shots.has(p.id)) shots.set(p.id, p);
  }
  return { state: current, events, shots: [...shots.values()] };
}
const untilStance = (stance: string) => (s: WorldState) => first(s).boss?.stance === stance && first(s).ai.mode === 'telegraph';

describe('Trevenant spell cards', () => {
  it('slams, then plays roots, spiral and curse in turn with a slam between each, every card named in both languages', () => {
    expect([0, 1, 2, 3].map((i) => treantCardAt(TREVENANT, i))).toEqual(['roots', 'spiral', 'curse', 'roots']);
    const { events } = watch(fight(), 60000, (s) => (first(s).boss?.combosDone ?? 0) >= 4);
    const stances = events.flatMap((e) => (e.type === 'bossStance' ? [e.stance] : []));
    expect(stances.slice(0, 7)).toEqual(['roots', 'slam', 'spiral', 'slam', 'curse', 'slam', 'roots']);
    for (const card of ['roots', 'spiral', 'curse', 'grove'] as const) {
      const key = spellCardKey('trevenant', card)!;
      for (const language of LANGUAGES) {
        expect(catalog(language)[key], `${language} ${key}`).toMatch(/«.+»/);
        expect(catalog(language)[`boss.stance.${card}`]).toBeTruthy();
      }
    }
    for (const language of LANGUAGES) expect(catalog(language)['boss.stance.slam']).toBeTruthy();
    expect(spellCardKey('trevenant', 'slam')).toBeNull();
  });

  it('telegraphs every attack for at least half a second on easy', () => {
    const { events } = watch(fight(), 60000, (s) => (first(s).boss?.combosDone ?? 0) >= 4);
    const telegraphs = events.flatMap((e) => (e.type === 'enemyTelegraph' ? [e] : []));
    expect(new Set(telegraphs.map((t) => t.attack))).toEqual(new Set(['slam', 'roots', 'spiral', 'curse']));
    for (const t of telegraphs) expect(t.durationMs, t.attack).toBeGreaterThanOrEqual(500);
  });

  it('roots: each wave bursts from every other lane (the player is never left without a lane), the next wave from the others, after the last roots are gone; a roll does not save you', () => {
    expect(TREVENANT.roots.spike.pierceRoll).toBe(true);
    expect(TREVENANT.roots.spike.lifetimeMs).toBeLessThan(TREVENANT.roots.waveGapMs);
    const start = watch(fight(), 20000, untilStance('roots')).state;
    const waves: number[][] = [];
    let state = start;
    for (let wave = 0; wave < TREVENANT.roots.waves; wave++) {
      const before = new Set(state.projectiles.map((p) => p.id));
      const after = watch(state, 3000, (s) => s.projectiles.some((p) => !before.has(p.id) && p.radius === TREVENANT.roots.spike.radius));
      state = after.state;
      const spikes = state.projectiles.filter((p) => !before.has(p.id) && p.radius === TREVENANT.roots.spike.radius);
      expect(spikes.every((p) => p.vel.x === 0 && p.vel.y === 0 && p.pierceRoll === true)).toBe(true);
      const lanes = [...new Set(spikes.map((p) => Math.floor(p.pos.x / TREVENANT.roots.laneWidth)))].sort((a, b) => a - b);
      waves.push(lanes);
      const total = Math.floor(HOLLOW.width / TREVENANT.roots.laneWidth);
      expect(lanes.length).toBeLessThan(total);
      expect(lanes.every((l) => l % 2 === lanes[0]! % 2)).toBe(true);
      // Between two struck lanes there is room for the player.
      expect(TREVENANT.roots.laneWidth * 2 - 2 * TREVENANT.roots.spike.radius).toBeGreaterThan(PLAYER_D * 2);
      expect(rootLanes(first(state), HOLLOW.width)).toEqual(lanes);
      state = { ...state, projectiles: state.projectiles.filter((p) => before.has(p.id)) };
    }
    expect(waves[0]![0]! % 2).not.toBe(waves[1]![0]! % 2);
    // The first wave strikes the player's own lane: it has to move.
    expect(waves[0]).toContain(Math.floor(start.player.pos.x / TREVENANT.roots.laneWidth));
  });

  it('spiral: arms of leaves wind out, and the shots of an arm are far enough apart to slip between', () => {
    const start = watch(fight(), 30000, untilStance('spiral')).state;
    const { shots } = watch(start, 6000, (s) => first(s).ai.mode === 'recover');
    const leaves = shots.filter((p) => p.radius === TREVENANT.spiral.leaf.radius);
    expect(leaves).toHaveLength(TREVENANT.spiral.arms * TREVENANT.spiral.bursts);
    const step = TREVENANT.spiral.everyMs / 1000;
    const speed = TREVENANT.spiral.leaf.speed;
    // Two shots of one arm, fired one burst apart, seen when the older is 150 px out.
    const r = 150;
    const a = vec(r, 0);
    const turn = (TREVENANT.spiral.turnDegrees * Math.PI) / 180;
    const b = vec((r - speed * step) * Math.cos(turn), (r - speed * step) * Math.sin(turn));
    expect(distance(a, b) - 2 * TREVENANT.spiral.leaf.radius).toBeGreaterThan(PLAYER_D + 8);
    // The arms are a quarter turn apart.
    expect(((2 * Math.PI) / TREVENANT.spiral.arms) * r).toBeGreaterThan(4 * PLAYER_D);
  });

  it('curse: a ring around the player with a gap away from the tree, closing in to its centre; walking out through the gap is safe', () => {
    const start = watch(fight(vec(400, 470)), 40000, untilStance('curse')).state;
    const locked = watch(start, 3000, (s) => s.projectiles.some((p) => p.radius === TREVENANT.curse.shot.radius && p.type === TREVENANT.curse.shot.type)).state;
    const ring = locked.projectiles.filter((p) => p.type === TREVENANT.curse.shot.type && p.radius === TREVENANT.curse.shot.radius);
    expect(ring).toHaveLength(TREVENANT.curse.count - TREVENANT.curse.gap);
    const centre = first(locked).ai.aimPoint!;
    expect(distance(centre, vec(400, 470))).toBeLessThan(2);
    for (const p of ring) {
      expect(distance(p.pos, centre)).toBeCloseTo(TREVENANT.curse.radius, 0);
      // Inward, and spent when it reaches the centre.
      expect(p.vel.x * (centre.x - p.pos.x) + p.vel.y * (centre.y - p.pos.y)).toBeGreaterThan(0);
      expect((p.remainingMs / 1000) * TREVENANT.curse.shot.speed).toBeLessThanOrEqual(TREVENANT.curse.radius + 2);
    }
    const gap = curseGapDir(first(locked));
    // Away from the tree on the first ring.
    expect(gap.y).toBeGreaterThan(0.9);
    const gapArc = (TREVENANT.curse.gap + 1) * ((2 * Math.PI) / TREVENANT.curse.count) * TREVENANT.curse.radius - 2 * TREVENANT.curse.shot.radius;
    expect(gapArc).toBeGreaterThan(2 * PLAYER_D);
    // Walk out through the gap: not hit by the first ring.
    // (Only the curse ring in the air: the slam's leaves are not part of this check.)
    const out = { ...locked, projectiles: ring, player: { ...locked.player, disguiseBroken: true } };
    const ids = new Set(ring.map((p) => p.id));
    let s: WorldState = out;
    const events: GameEvent[] = [];
    for (let i = 0; i < ticksFor(1600); i++) {
      s = step(s, { ...IDLE, move: gap }, FIXED_DT_MS);
      events.push(...s.events);
      // Until the second ring is thrown.
      if (s.projectiles.some((p) => !ids.has(p.id))) break;
    }
    expect(events.some((e) => e.type === 'playerHurt')).toBe(false);
  });

  it('a guest is hit by the slam on its own side, never by a card', () => {
    const base = fight(vec(400, 280));
    const as = (stance: 'slam' | 'roots') => ({ ...base, role: 'guest' as const, enemies: [{ ...first(base), boss: { ...first(base).boss!, stance }, ai: { ...first(base).ai, mode: 'attack' as const, contact: 'none' as const } }] });
    const slam: GameEvent[] = [];
    guestEnemyContacts(as('slam'), slam);
    expect(hurt(slam)).toBe(true);
    const roots: GameEvent[] = [];
    guestEnemyContacts(as('roots'), roots);
    expect(hurt(roots)).toBe(false);
  });
});
