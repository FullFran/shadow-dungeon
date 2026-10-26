import { describe, expect, it } from 'vitest';
import { applyRemotePlayers, playerSnapshot } from '../../src/core/sync';
import { createWorld } from '../../src/core/world';
import { vec } from '../../src/core/vec';
import { decodeMessage, encodeMessage } from '../../src/net/protocol';
import { createSession, type NetSession } from '../../src/net/session';
import { createFakeScheduler, createMemoryHub } from '../../src/net/transport';
import type { RosterEntry } from '../../src/net/protocol';
import { PROTOCOL_VERSION } from '../../src/net/version';

/** Shiny skins in co-op (odd/tasks/shiny-echo.md): the skin travels in hello, the roster and state, so teammates see it. */
const LOADOUT = ['shadow-claw', 'play-rough'] as const;
const world = (shiny: boolean) => createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(10, 10), localId: 'p2', species: 'zorua', shiny });

describe('shiny on the wire', () => {
  it('bumped the protocol (an older peer would drop the skin silently)', () => {
    // 4: shiny skins; 5: player hits on the compressed chart and the card floor's `held` (odd/tasks/type-balance.md).
    expect(PROTOCOL_VERSION).toBe(5);
  });

  it('hello and roster entries carry it only when it is exactly true', () => {
    const hello = decodeMessage(encodeMessage({ t: 'hello', species: 'zorua', loadout: [], shiny: true }));
    expect(hello?.t === 'hello' && hello.shiny).toBe(true);
    for (const shiny of [undefined, false, 'yes', 1]) {
      const plain = decodeMessage(JSON.stringify({ t: 'hello', species: 'zorua', loadout: [], shiny }));
      expect(plain?.t === 'hello' && plain.shiny, String(shiny)).toBeUndefined();
    }
    const lobby = decodeMessage(JSON.stringify({ t: 'lobby', players: [{ peer: 'a', id: 'p1', species: 'zorua', shiny: true }, { peer: 'b', id: 'p2', species: 'abra', shiny: 'x' }] }));
    expect(lobby?.t === 'lobby' && lobby.players.map((p) => p.shiny)).toEqual([true, undefined]);
  });

  it('a state carries it to the teammate, whose copy of the player wears it', () => {
    for (const shiny of [true, false]) {
      const decoded = decodeMessage(encodeMessage({ t: 'state', at: 5, floor: 1, p: playerSnapshot(world(shiny)) }));
      expect(decoded?.t === 'state' && decoded.p.shiny === true).toBe(shiny);
      if (decoded?.t !== 'state') throw new Error('no state');
      const host = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(10, 10) });
      const seen = applyRemotePlayers(host, [decoded.p]);
      expect(seen.remotes[0]!.player.shiny === true).toBe(shiny);
    }
  });
});

describe('shiny in the room roster', () => {
  interface Peer {
    session: NetSession;
    roster: readonly RosterEntry[];
  }
  const peer = (hub: ReturnType<typeof createMemoryHub<string>>, id: string, scheduler: ReturnType<typeof createFakeScheduler>): Peer => {
    const session = createSession({ transport: hub.connect(id), scheduler });
    const p: Peer = { session, roster: [] };
    session.onRoster((roster) => (p.roster = roster));
    return p;
  };

  it('the host and the guests see who wears a skin, and a repick puts it on or off', () => {
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const host = peer(hub, 'h', scheduler);
    host.session.host(42, 1, 'mimikyu', { lobby: true, shiny: true });
    const guest = peer(hub, 'g', scheduler);
    guest.session.join('zorua', LOADOUT, 'Ana', true);
    expect(guest.roster.map((r) => [r.id, r.species, r.shiny === true])).toEqual([
      ['p1', 'mimikyu', true],
      ['p2', 'zorua', true],
    ]);
    guest.session.repick('zorua', LOADOUT, false);
    host.session.repick('mimikyu', LOADOUT, false);
    expect(host.roster.map((r) => r.shiny === true)).toEqual([false, false]);
    expect(guest.roster.map((r) => r.shiny === true)).toEqual([false, false]);
  });
});
