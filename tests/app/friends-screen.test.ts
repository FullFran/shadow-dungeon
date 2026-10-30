import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Friend } from '../../src/adapters/friends-api';
import { friendsHeartbeat, HEARTBEAT_MS, joinableRoom, loadFriends, sortFriends, type Heartbeat } from '../../src/app/friends-screen';
import { catalog, LANGUAGES } from '../../src/i18n';
import { ROOM_CODE_ALPHABET } from '../../src/net/room-code';

const ROOT = join(__dirname, '../..');
const friend = (o: Partial<Friend>): Friend => ({ id: 'abcdefghij12345', nickname: 'Ana', state: 'offline', room: null, ...o });

describe('the friend code', () => {
  it('uses the room code alphabet on the server too', () => {
    const go = readFileSync(join(ROOT, 'server/internal/friends/friends.go'), 'utf8');
    expect(go.match(/CodeAlphabet = "([^"]+)"/)![1]).toBe(ROOM_CODE_ALPHABET);
  });
});

describe('the friends list', () => {
  it('puts rooms first, then online, then offline, each by name', () => {
    const list = [friend({ nickname: 'off' }), friend({ nickname: 'zed', state: 'online' }), friend({ nickname: 'Beto', state: 'room', room: 'K7M3A' }), friend({ nickname: 'alba', state: 'online' }), friend({ nickname: 'Ana', state: 'room', room: 'K7M3A' })];
    expect(sortFriends(list).map((f) => f.nickname)).toEqual(['Ana', 'Beto', 'alba', 'zed', 'off']);
  });
  it('does not touch the list it gets', () => {
    const list = [friend({ nickname: 'b' }), friend({ nickname: 'a' })];
    sortFriends(list);
    expect(list[0]!.nickname).toBe('b');
  });
});

describe('joining a friend', () => {
  it('goes by the normalized room code', () => {
    expect(joinableRoom(friend({ state: 'room', room: 'K7M3A' }), null)).toBe('K7M3A');
  });
  it('refuses a bad code from the server', () => {
    expect(joinableRoom(friend({ state: 'room', room: 'K7M2Q' }), null)).toBeNull();
    expect(joinableRoom(friend({ state: 'room', room: '../x' }), null)).toBeNull();
    expect(joinableRoom(friend({ state: 'room', room: null }), null)).toBeNull();
  });
  it('offers nothing when not in a room, or already in that one', () => {
    expect(joinableRoom(friend({ state: 'online', room: 'K7M3A' }), null)).toBeNull();
    expect(joinableRoom(friend({ state: 'room', room: 'K7M3A' }), 'K7M3A')).toBeNull();
    expect(joinableRoom(friend({ state: 'room', room: 'K7M3A' }), 'ACDEF')).toBe('K7M3A');
  });
  it('joins through openLobby, with the room code checks', () => {
    const main = readFileSync(join(ROOT, 'src/app/main.ts'), 'utf8');
    expect(main.match(/openLobby\(root, code, false, undefined, /g)).toHaveLength(2);
    const screen = readFileSync(join(ROOT, 'src/app/friends-screen.ts'), 'utf8');
    expect(screen).toContain('normalizeRoomCode(friend.room)');
  });
});

describe('signed out', () => {
  it('the window asks the server nothing', async () => {
    let asked = 0;
    const api = {
      overview: () => {
        asked++;
        return Promise.resolve({ ok: false, error: 'unavailable' } as const);
      },
    };
    expect(await loadFriends(api, null)).toEqual({ ok: false, error: 'denied' });
    expect(asked).toBe(0);
    expect((await loadFriends(api, 'tok')).ok).toBe(false);
    expect(asked).toBe(1);
  });
});

/** A heartbeat over a test clock. */
function rig() {
  const state = { session: null as { who: string; token: string } | null, room: null as string | null, visible: true };
  const sent: [string, string | null][] = [];
  let tick: (() => void) | null = null;
  const beat: Heartbeat = friendsHeartbeat({
    session: () => state.session,
    room: () => state.room,
    visible: () => state.visible,
    send: (token, room) => sent.push([token, room]),
    start: (fn, ms) => {
      expect(ms).toBe(HEARTBEAT_MS);
      tick = fn;
      return 1;
    },
    stop: () => {
      tick = null;
    },
  });
  return { state, sent, beat, tick: () => tick?.(), armed: () => tick !== null };
}
const ana = { who: 'a@x', token: 'tok-a' };

describe('the heartbeat', () => {
  it('sends nothing, and arms nothing, signed out', () => {
    const r = rig();
    r.state.room = 'K7M3A';
    r.beat.sync();
    r.tick();
    expect(r.sent).toEqual([]);
    expect(r.armed()).toBe(false);
  });
  it('beats on signing in, then once per period', () => {
    const r = rig();
    r.state.session = ana;
    r.beat.sync();
    expect(r.sent).toEqual([['tok-a', null]]);
    r.tick();
    r.tick();
    expect(r.sent).toHaveLength(3);
    expect(HEARTBEAT_MS).toBe(60_000);
  });
  it('beats on request when signed in, and never as a guest', () => {
    const r = rig();
    r.beat.now();
    expect(r.sent).toEqual([]);
    r.state.session = ana;
    r.beat.sync();
    r.beat.now();
    expect(r.sent).toHaveLength(2);
  });
  it('a sync that changes nothing sends nothing', () => {
    const r = rig();
    r.state.session = ana;
    r.beat.sync();
    r.beat.sync();
    r.beat.sync();
    expect(r.sent).toHaveLength(1);
  });
  it('publishes the room at once on entering, and clears it at once on leaving', () => {
    const r = rig();
    r.state.session = ana;
    r.beat.sync();
    r.state.room = 'K7M3A';
    r.beat.sync();
    expect(r.sent.at(-1)).toEqual(['tok-a', 'K7M3A']);
    r.tick();
    expect(r.sent.at(-1)).toEqual(['tok-a', 'K7M3A']);
    r.state.room = null;
    r.beat.sync();
    expect(r.sent.at(-1)).toEqual(['tok-a', null]);
  });
  it('stops with the tab hidden and beats again on coming back', () => {
    const r = rig();
    r.state.session = ana;
    r.beat.sync();
    r.state.visible = false;
    r.beat.sync();
    expect(r.armed()).toBe(false);
    expect(r.sent).toHaveLength(1);
    r.state.visible = true;
    r.beat.sync();
    expect(r.sent).toHaveLength(2);
    expect(r.armed()).toBe(true);
  });
  it('keeps beating with the tab hidden while in a room: a host waiting on a chat is still there', () => {
    const r = rig();
    r.state.session = ana;
    r.state.room = 'K7M3A';
    r.beat.sync();
    r.state.visible = false;
    r.beat.sync();
    r.tick();
    expect(r.sent).toHaveLength(2);
    expect(r.armed()).toBe(true);
    // Leaving with it hidden still clears the room, then it rests.
    r.state.room = null;
    r.beat.sync();
    expect(r.sent.at(-1)).toEqual(['tok-a', null]);
    expect(r.armed()).toBe(false);
  });
  it('logging out stops it, and clears a published room with the token that published it', () => {
    const r = rig();
    r.state.session = ana;
    r.state.room = 'K7M3A';
    r.beat.sync();
    r.state.session = null;
    r.beat.sync();
    expect(r.sent.at(-1)).toEqual(['tok-a', null]);
    expect(r.armed()).toBe(false);
    const before = r.sent.length;
    r.tick();
    r.beat.sync();
    expect(r.sent).toHaveLength(before);
  });
  it('changing account clears the old one and beats as the new one', () => {
    const r = rig();
    r.state.session = ana;
    r.state.room = 'K7M3A';
    r.beat.sync();
    r.state.session = { who: 'b@x', token: 'tok-b' };
    r.beat.sync();
    expect(r.sent.slice(-2)).toEqual([
      ['tok-a', null],
      ['tok-b', 'K7M3A'],
    ]);
  });
  it('a refreshed token is the same account: it just uses the new one', () => {
    const r = rig();
    r.state.session = ana;
    r.state.room = 'K7M3A';
    r.beat.sync();
    r.state.session = { who: 'a@x', token: 'tok-a2' };
    r.beat.sync();
    r.tick();
    expect(r.sent.at(-1)).toEqual(['tok-a2', 'K7M3A']);
    expect(r.sent.filter((s) => s[1] === null)).toEqual([]);
  });
});

describe('wiring', () => {
  const main = readFileSync(join(ROOT, 'src/app/main.ts'), 'utf8');
  it('the heartbeat follows the account, the room and the tab', () => {
    expect(main.slice(main.indexOf('function leaveNet('), main.indexOf('async function connectLocal(')).match(/friendsBeat\?\.sync\(\)/g)).toHaveLength(1);
    expect(main.slice(main.indexOf('onChange: () => {'), main.indexOf('onReplaced: () => {'))).toContain('friendsBeat?.sync()');
    expect(main).toMatch(/visibilitychange', \(\) => friendsBeat\?\.sync\(\)\)/);
    const lobby = main.slice(main.indexOf('async function openLobby('), main.indexOf('function townLobby('));
    expect(lobby.indexOf('friendsBeat?.sync()')).toBeGreaterThan(lobby.indexOf('room = {'));
  });
  it('the heartbeat starts after the room it reads is declared', () => {
    expect(main.indexOf('friendsBeat = friendsHeartbeat(')).toBeGreaterThan(main.indexOf('let room: {'));
  });
  it('logging out closes the window', () => {
    expect(main.slice(main.indexOf('onChange: () => {'), main.indexOf('onReplaced: () => {'))).toContain('openFriends.leave()');
  });
  it('the window is one step from the town menu, in both towns, and from Options', () => {
    expect(main.match(/openFriends: townFriends\(root\)/g)).toHaveLength(2);
    expect(main.slice(main.indexOf('function optionsScreen('), main.indexOf('function optionsScreen(') + 1600)).toContain('friendsScreen(root');
  });
});

describe('friends text', () => {
  it('exists in every language, without em dashes', () => {
    const keys = Object.keys(catalog('es')).filter((k) => k.startsWith('friends.'));
    expect(keys.length).toBeGreaterThan(10);
    for (const lang of LANGUAGES) {
      for (const key of [...keys, 'townMenu.friends', 'townMenu.friends.about', 'title.friends', 'options.about.friends']) {
        expect(catalog(lang)[key], `${lang} ${key}`).toBeTruthy();
        expect(catalog(lang)[key], `${lang} ${key}`).not.toContain('—');
      }
    }
  });
  it('says what friends see', () => {
    expect(catalog('es')['friends.privacy']).toContain('apodo');
    expect(catalog('es')['friends.privacy']).toContain('sala');
    expect(catalog('en')['friends.privacy']).toContain('nickname');
    expect(catalog('en')['friends.privacy']).toContain('room');
  });
});
