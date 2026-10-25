import { BREAK_RULE, LEADER, roleOf, threatOf, type LeaderChance } from '../data/encounters';
import type { Floor, FloorSpawn } from './dungeon';
import { deriveSeed } from './rng';
import { draws, rising } from './sima';
import type { EnemyState, GameEvent, WorldState } from './state';
import { enemyTimeScale } from './time';
import { distance } from './vec';

/**
 * Leaders (docs/gdd.md §3 "Encuentros con sentido"), pure. Some groups of a
 * generated floor follow a leader: crowned, tougher, paying bonus
 * experience, and calling a rally cry that heals and hurries its followers.
 * When it falls the followers break by their role's rule (data/encounters.ts
 * `BREAK_RULE`). Who leads is drawn from the floor seed, so every peer of a
 * shared run crowns the same enemies; the host runs the cries and the
 * breaks, and a guest breaks its followers when the host shows the leader down.
 */

const LEADER_SALT = 0x1ead;

/** Chance that a group of a floor at `depth` follows a leader. */
export const leaderChance = (rule: LeaderChance | undefined, depth: number): number => (rule ? rising(rule, depth) : 0);

/**
 * Crowns the leaders of a generated floor: each room with two or more
 * enemies rolls once against the depth's chance; its leader is the enemy of
 * the highest threat (the first such on a tie). A pure draw from the seed.
 */
export function assignLeaders(floor: Floor, seed: number, depth: number, rule: LeaderChance | undefined): Floor {
  const chance = leaderChance(rule, depth);
  if (chance <= 0) return floor;
  const draw = draws(deriveSeed(seed, depth + LEADER_SALT));
  const rooms = [...new Set(floor.spawns.map((s) => s.room))].sort((a, b) => a - b);
  const crowned = new Set<FloorSpawn>();
  for (const room of rooms) {
    const here = floor.spawns.filter((s) => s.room === room);
    if (draw() >= chance || here.length < 2) continue;
    crowned.add(here.reduce((best, s) => (threatOf(s.species) > threatOf(best.species) ? s : best), here[0]!));
  }
  if (crowned.size === 0) return floor;
  return { ...floor, spawns: floor.spawns.map((s) => (crowned.has(s) ? { ...s, leader: true as const } : s)) };
}

/** Its followers' clock: a broken one (slow rule) runs slower, an inspired one (its leader stands) a little faster. */
export function bandTimeScale(enemy: Pick<EnemyState, 'band' | 'broken'>): number {
  if (enemy.broken?.rule === 'slow') return LEADER.break.slowPace;
  return enemy.band ? LEADER.inspiredPace : 1;
}

/** Experience multiplier of a defeated enemy: a leader pays its bonus. */
export const leaderXp = (enemy: Pick<EnemyState, 'leader'>): number => (enemy.leader ? LEADER.xp : 1);

/** A follower breaks: it leaves its band and takes its role's rule (a stagger reels at once). */
function broke(enemy: EnemyState): EnemyState {
  const { band: _band, ...rest } = enemy;
  const rule = BREAK_RULE[roleOf(enemy.species)];
  const ms = rule === 'stagger' ? LEADER.break.staggerMs : LEADER.break.slowMs;
  return { ...rest, broken: { rule, ms }, ...(rule === 'stagger' ? { hitstunMs: Math.max(enemy.hitstunMs, LEADER.break.staggerMs) } : {}) };
}

/**
 * Every peer: the followers of a leader seen down break (once: they leave
 * its band). A guest runs this alone, for its own drawing; the stagger it
 * sets is replaced by the host's next snapshot anyway.
 */
export function breakBands(state: WorldState, events: GameEvent[]): WorldState {
  const fallen = state.enemies.filter((e) => e.leader && !e.alive && state.enemies.some((f) => f.band === e.id));
  if (fallen.length === 0) return state;
  const ids = new Set(fallen.map((e) => e.id));
  for (const leader of fallen) events.push({ type: 'leaderFell', enemyId: leader.id, followers: state.enemies.filter((f) => f.band === leader.id && f.alive).length });
  return { ...state, enemies: state.enemies.map((e) => (e.band && ids.has(e.band) ? (e.alive ? broke(e) : (({ band: _b, ...rest }) => rest)(e)) : e)) };
}

/** A leader that can call: alive, awake, not reeling, with a living follower. */
const canCall = (state: WorldState, leader: EnemyState): boolean =>
  leader.alive && leader.hitstunMs <= 0 && leader.ai.mode !== 'asleep' && leader.ai.mode !== 'dormant' && state.enemies.some((f) => f.band === leader.id && f.alive);

/**
 * Host (and solo), after the enemies acted: the breaks, the break timers and
 * the rally cries, on the enemy clock.
 */
export function updateLeaders(state: WorldState, dtMs: number, events: GameEvent[]): WorldState {
  const broken = breakBands(state, events);
  const ms = dtMs * enemyTimeScale(broken);
  if (!broken.enemies.some((e) => e.leader || e.broken)) return broken;
  let enemies = broken.enemies.map((e): EnemyState => {
    if (!e.broken) return e;
    const left = e.broken.ms - ms;
    if (left > 0) return { ...e, broken: { ...e.broken, ms: left } };
    const { broken: _gone, ...rest } = e;
    return rest;
  });
  for (const leader of enemies.filter((e) => e.leader)) {
    const now = { ...broken, enemies };
    if (!leader.leader || !canCall(now, leader)) {
      if (leader.leader?.rallying !== undefined) enemies = enemies.map((e) => (e.id === leader.id ? { ...e, leader: { rallyMs: LEADER.rally.everyMs } } : e));
      continue;
    }
    const { rallyMs, rallying } = leader.leader;
    if (rallying === undefined) {
      const left = rallyMs - ms;
      if (left > 0) {
        enemies = enemies.map((e) => (e.id === leader.id ? { ...e, leader: { rallyMs: left } } : e));
        continue;
      }
      events.push({ type: 'leaderRally', enemyId: leader.id, phase: 'windup' });
      enemies = enemies.map((e) => (e.id === leader.id ? { ...e, leader: { rallyMs: 0, rallying: 0 } } : e));
      continue;
    }
    const into = rallying + ms;
    if (into < LEADER.rally.telegraphMs) {
      enemies = enemies.map((e) => (e.id === leader.id ? { ...e, leader: { rallyMs: 0, rallying: into } } : e));
      continue;
    }
    // The cry: every follower in reach heals a share and may strike again at once.
    events.push({ type: 'leaderRally', enemyId: leader.id, phase: 'cry' });
    enemies = enemies.map((e) => {
      if (e.id === leader.id) return { ...e, leader: { rallyMs: LEADER.rally.everyMs } };
      if (e.band !== leader.id || !e.alive || distance(e.pos, leader.pos) > LEADER.rally.radius) return e;
      return { ...e, hp: Math.min(e.maxHp, e.hp + LEADER.rally.heal * e.maxHp), ai: { ...e.ai, cooldownMs: 0 } };
    });
  }
  return { ...broken, enemies };
}

/**
 * After a floor's enemies spawned: every follower of a crowned group takes
 * its leader's id (the enemies of `spawns` are the world's last ones, in order).
 */
export function joinBands(state: WorldState, spawns: readonly FloorSpawn[]): WorldState {
  const first = state.enemies.length - spawns.length;
  const leaders = new Map<number, string>();
  spawns.forEach((s, i) => {
    if (s.leader) leaders.set(s.room, state.enemies[first + i]!.id);
  });
  if (leaders.size === 0) return state;
  return {
    ...state,
    enemies: state.enemies.map((e, i) => {
      const spawn = spawns[i - first];
      const leader = spawn ? leaders.get(spawn.room) : undefined;
      return spawn && leader && leader !== e.id ? { ...e, band: leader } : e;
    }),
  };
}

/** Whether a follower is near enough its leader to hear the cry (for drawing and tests). */
export const inRally = (leader: Pick<EnemyState, 'pos'>, follower: Pick<EnemyState, 'pos'>): boolean => distance(leader.pos, follower.pos) <= LEADER.rally.radius;
