import { describe, expect, it } from 'vitest';
import { applyRemotePlayers, playerSnapshot } from '../../src/core/sync';
import { vec } from '../../src/core/vec';
import { createWorld } from '../../src/core/world';
import { MOVES, type MoveId } from '../../src/data/moves';
import { decodeMessage, encodeMessage, type NetMessage } from '../../src/net/protocol';

const world = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(10, 10), localId: 'p2' });
const shot = (moveId?: MoveId, id = 'j4') => ({
  id,
  owner: 'player' as const,
  type: 'ground' as const,
  attackerTypes: ['ground' as const],
  power: 90,
  pos: vec(55.55, 66.66),
  vel: vec(220, -3),
  radius: 11,
  remainingMs: 400,
  damageMultiplier: 1,
  ...(moveId ? { moveId } : {}),
});
const state = (projectiles: unknown[]): NetMessage => ({ t: 'state', at: 5, floor: 1, p: playerSnapshot({ ...world, projectiles: projectiles as never }) });
const decoded = (message: NetMessage) => {
  const out = decodeMessage(encodeMessage(message));
  if (out?.t !== 'state') throw new Error('not a state');
  return out.p;
};

describe("a peer's shot tells which move it is, so it looks right on every screen", () => {
  it.each(Object.keys(MOVES).map((id) => [id as MoveId] as const))('%s crosses the wire', (moveId) => {
    expect(decoded(state([shot(moveId)])).projectiles[0]?.moveId).toBe(moveId);
  });

  it('reaches the peer that draws it', () => {
    const snapshot = decoded(state([shot('earth-power')]));
    const peer = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(10, 10), localId: 'p1' });
    const after = applyRemotePlayers(peer, [snapshot]);
    expect(after.remotes[0]?.projectiles[0]?.moveId).toBe('earth-power');
  });

  it('a shot without a move, or with one this build does not know, still arrives as a ball of its type', () => {
    expect(decoded(state([shot()])).projectiles[0]?.moveId).toBeUndefined();
    const wire = JSON.parse(encodeMessage(state([shot('earth-power')]))) as unknown;
    const text = JSON.stringify(wire).replace('earth-power', 'not-a-move');
    const out = decodeMessage(text);
    expect(out?.t === 'state' && out.p.projectiles[0]?.id).toBe('j4');
    expect(out?.t === 'state' && out.p.projectiles[0]?.moveId).toBeUndefined();
  });

  it('a message from a peer without the field still decodes (its shape did not change for older fields)', () => {
    const out = decoded(state([shot()]));
    expect(out.projectiles[0]).toMatchObject({ id: 'j4', type: 'ground', radius: 11 });
  });

  it('an enemy shot never carries a move', () => {
    const snapshot = playerSnapshot({ ...world, projectiles: [{ ...shot('earth-power'), owner: 'enemy' }] as never });
    expect(snapshot.projectiles).toEqual([]);
  });

  it('adds little to a state message: the longest move name costs under 30 bytes per shot', () => {
    const longest = (Object.keys(MOVES) as MoveId[]).sort((a, b) => b.length - a.length)[0]!;
    const plain = encodeMessage(state([shot()])).length;
    const named = encodeMessage(state([shot(longest)])).length;
    expect(named - plain).toBeLessThan(30);
    expect(named - plain).toBeGreaterThan(0);
  });
});
