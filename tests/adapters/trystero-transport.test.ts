import { describe, expect, it } from 'vitest';
import { RELAY_REDUNDANCY, roomConfig, TrysteroTransport, type RoomLike } from '../../src/adapters/trystero-transport';

/** A stand-in for a Trystero room: records what is sent, lets the test play the other peers. */
function fakeRoom() {
  const sent: Array<{ data: string; target: unknown }> = [];
  let receive: ((data: string, context: { peerId: string }) => void) | null = null;
  const peers: Record<string, unknown> = {};
  let left = 0;
  const room: RoomLike = {
    makeAction(namespace) {
      expect(namespace).toBe('m');
      return {
        send: (data: string, options?: { target?: unknown }) => {
          sent.push({ data, target: options?.target ?? null });
          return Promise.resolve();
        },
        set onMessage(handler: ((data: string, context: { peerId: string }) => void) | null) {
          receive = handler;
        },
        get onMessage() {
          return receive;
        },
      };
    },
    getPeers: () => peers,
    onPeerJoin: null,
    onPeerLeave: null,
    leave: () => {
      left++;
      return Promise.resolve();
    },
  };
  return { room, sent, peers, receive: (data: string, peerId: string) => receive?.(data, { peerId }), left: () => left };
}

describe('Trystero transport', () => {
  it('sends every message, reliable or not, over the one action to every peer', () => {
    const fake = fakeRoom();
    const transport = new TrysteroTransport(fake.room, 'me');
    transport.send('a', true);
    transport.send('b', false);
    expect(fake.sent).toEqual([
      { data: 'a', target: null },
      { data: 'b', target: null },
    ]);
    expect(transport.selfId).toBe('me');
  });

  it('passes on messages, joins and leaves with the peer id, and lists peers', () => {
    const fake = fakeRoom();
    const transport = new TrysteroTransport(fake.room, 'me');
    const got: string[] = [];
    transport.onMessage((from, m) => got.push(`${from}:${m}`));
    transport.onPeerJoin((p) => got.push(`join:${p}`));
    transport.onPeerLeave((p) => got.push(`leave:${p}`));
    fake.peers['x'] = {};
    fake.room.onPeerJoin?.('x');
    fake.receive('hi', 'x');
    expect(transport.peers()).toEqual(['x']);
    fake.room.onPeerLeave?.('x');
    expect(got).toEqual(['join:x', 'x:hi', 'leave:x']);
  });

  it('leaves the room once on close and sends nothing after', () => {
    const fake = fakeRoom();
    const transport = new TrysteroTransport(fake.room, 'me');
    transport.close();
    transport.close();
    transport.send('late', true);
    expect(fake.left()).toBe(1);
    expect(fake.sent).toEqual([]);
  });
});

// Owner report 2026-11-02: joining a room sometimes took long, or the room had to be made again.
describe('room config', () => {
  it('signals through more Nostr relays than the default five, with the TURN servers when there are some', () => {
    const turn = [{ urls: ['turn:turn.example:3478'], username: 'u', credential: 'c' }];
    expect(RELAY_REDUNDANCY).toBeGreaterThan(5);
    expect(roomConfig('app', turn)).toEqual({ appId: 'app', relayConfig: { redundancy: RELAY_REDUNDANCY }, turnConfig: turn });
    expect(roomConfig('app', [])).toEqual({ appId: 'app', relayConfig: { redundancy: RELAY_REDUNDANCY } });
  });
});
