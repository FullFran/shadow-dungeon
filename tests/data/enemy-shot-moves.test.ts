import { describe, expect, it } from 'vitest';
import { MOVES, type MoveId } from '../../src/data/moves';
import { FLYING_SHOT_MOVE, FLYING_SHOT_BOSSES } from '../../src/data/shot-moves';
import { ERUPTION_MOVES, HAND_DRAWN_SHOTS } from '../../src/adapters/fx/cues';
import { bossOf, everyShot } from './enemy-shots';

/**
 * Issue #67 (design note 2): every moving enemy shot is a move a Pokémon can
 * learn, and its type is that move's type. One listed exception (owner,
 * 2026-11-24): no Flying move exists, so the Flying shots of two Senda bosses
 * keep their Flying damage and are drawn as Swift.
 */

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

  it('no shot is a move that does not fly as a baked shot (Bonemerang\'s hand-drawn bone, Earth Power\'s eruptions)', () => {
    const odd = shots.filter((s) => HAND_DRAWN_SHOTS.has(String(s.shot.move)) || ERUPTION_MOVES.has(String(s.shot.move)));
    expect(odd.map((s) => `${s.source} ${String(s.shot.move)}`).slice(0, 20)).toEqual([]);
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
