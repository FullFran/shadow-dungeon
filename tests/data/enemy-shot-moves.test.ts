import { describe, expect, it } from 'vitest';
import { MOVES, type MoveId } from '../../src/data/moves';
import { SPECIES, type SpeciesId } from '../../src/data/species';
import { DIFFICULTIES } from '../../src/data/difficulty';
import { STORY_FIGHTS } from '../../src/data/story/bosses';
import { behaviourAt, behaviourFor } from '../../src/core/tricks';
import { heraldDef } from '../../src/core/herald/generate';
import { SHRINE_BOSSES, gauntletStops, heraldStop } from '../../src/core/shrine';
import { GAUNTLETS } from '../../src/data/shrine';
import { FLYING_SHOT_MOVE, FLYING_SHOT_BOSSES } from '../../src/data/shot-moves';

/**
 * Issue #67 (design note 2): every moving enemy shot is a move a Pokémon can
 * learn, and its type is that move's type. One listed exception (owner,
 * 2026-11-24): no Flying move exists, so the Flying shots of two Senda bosses
 * keep their Flying damage and are drawn as Swift.
 */

interface FoundShot {
  source: string;
  shot: { type: string; move?: unknown; speed: number; radius: number };
}

/** Every moving shot definition (an object with a type, a speed above 0 and a radius) reachable from `root`. */
function shotsOf(root: unknown, source: string, out: FoundShot[], seen = new Set<unknown>()): FoundShot[] {
  if (!root || typeof root !== 'object' || seen.has(root)) return out;
  seen.add(root);
  const o = root as Record<string, unknown>;
  if (typeof o.speed === 'number' && o.speed > 0 && typeof o.radius === 'number' && typeof o.type === 'string') out.push({ source, shot: o as FoundShot['shot'] });
  for (const v of Object.values(o)) shotsOf(v, source, out, seen);
  return out;
}

/** The boss behind a source: a Senda boss is reached both as `story:<id>` and as the species `<id>`. */
const bossOf = (source: string): string => source.replace(/^story:/, '');

function everyShot(): FoundShot[] {
  const out: FoundShot[] = [];
  // Every enemy (regular, card bosses and their cards on every tier, Eclipse echo, evolved line enemies), solo and a full co-op party.
  for (const species of Object.keys(SPECIES) as SpeciesId[]) {
    for (const tier of DIFFICULTIES) {
      shotsOf(behaviourFor(species, tier), species, out);
      shotsOf(behaviourAt(species, tier, 4), species, out);
    }
  }
  // Every Senda boss on every tier.
  for (const [id, tiers] of Object.entries(STORY_FIGHTS)) shotsOf(tiers, `story:${id}`, out);
  // The Sima's heralds (generator output over seeds, depths and tiers) and the Shrine's (its own seeds).
  for (let seed = 1; seed <= 24; seed++) for (const tier of DIFFICULTIES) shotsOf(heraldDef(seed, 10 + seed * 4, tier), 'herald', out);
  for (const seed of [1, 7, 42, 9001]) for (const tier of DIFFICULTIES) shotsOf(heraldDef(heraldStop(seed).heraldSeed!, heraldStop(seed).floor, tier), 'shrine-herald', out);
  // The Shrine's reflections and gauntlets: every stop's boss.
  const stops = [...SHRINE_BOSSES, ...GAUNTLETS.flatMap((g) => gauntletStops(g.id))];
  for (const stop of stops) for (const tier of DIFFICULTIES) shotsOf(behaviourFor(stop.boss, tier), `shrine:${stop.boss}`, out);
  return out;
}

describe('enemy shots are learnable moves (#67)', () => {
  const shots = everyShot();

  it('reaches every kind of shot source', () => {
    const sources = new Set(shots.map((s) => s.source.split(':')[0]));
    for (const s of ['lanturn', 'nihilego', 'aegislash', 'decidueye', 'eclipse-echo', 'story', 'herald', 'shrine-herald', 'shrine']) expect(sources, s).toContain(s);
    expect(shots.length).toBeGreaterThan(1000);
  }, 60_000);

  it('every moving enemy shot names a move that exists and is an attack', () => {
    const missing = shots.filter((s) => typeof s.shot.move !== 'string' || !(s.shot.move in MOVES));
    expect(missing.map((s) => `${s.source} ${s.shot.type} r${s.shot.radius} v${s.shot.speed}`).slice(0, 20)).toEqual([]);
    const selfMoves = shots.filter((s) => MOVES[s.shot.move as MoveId].hitbox.kind === 'self');
    expect(selfMoves.map((s) => `${s.source} ${String(s.shot.move)}`).slice(0, 20)).toEqual([]);
  }, 60_000);

  it('its type is its move type, but for the pinned Flying exception', () => {
    const disagree = shots.filter((s) => MOVES[s.shot.move as MoveId]?.type !== s.shot.type);
    const exception = disagree.filter((s) => s.shot.type === 'flying' && s.shot.move === FLYING_SHOT_MOVE && FLYING_SHOT_BOSSES.some((b) => bossOf(s.source) === b));
    expect(disagree.filter((s) => !exception.includes(s)).map((s) => `${s.source} ${s.shot.type} -> ${String(s.shot.move)}`).slice(0, 20)).toEqual([]);
  }, 60_000);

  it('the Flying exception: no Flying move exists, two Senda bosses only, drawn as Swift', () => {
    expect(Object.values(MOVES).filter((m) => m.type === 'flying')).toEqual([]);
    expect(FLYING_SHOT_MOVE).toBe('swift');
    expect([...FLYING_SHOT_BOSSES].sort()).toEqual(['axew-dragonite', 'litwick-drifblim']);
    const flying = shots.filter((s) => s.shot.type === 'flying');
    expect(flying.length).toBeGreaterThan(0);
    expect(new Set(flying.map((s) => bossOf(s.source)))).toEqual(new Set(FLYING_SHOT_BOSSES));
  }, 60_000);
});
