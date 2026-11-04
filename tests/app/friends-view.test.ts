import { describe, expect, it } from 'vitest';
import type { FriendsOverview } from '../../src/adapters/friends-api';
import { friendsView, gateFor, initialOf } from '../../src/app/friends-screen';
import { catalog, LANGUAGES } from '../../src/i18n';

const ID = (n: number) => `abcdefghij${String(n).padStart(5, '0')}`;
const overview = (patch: Partial<FriendsOverview> = {}): FriendsOverview => ({ code: 'K7M3AQ2X', friends: [], incoming: [], outgoing: [], ...patch });

describe('friends view model', () => {
  it('sorts rooms first, then online, then offline, with a display name and an initial', () => {
    const view = friendsView(
      overview({
        friends: [
          { id: ID(1), nickname: 'zed', state: 'offline', room: null },
          { id: ID(2), nickname: 'beto', state: 'room', room: 'K7M3A' },
          { id: ID(3), nickname: '', state: 'online', room: null },
        ],
      }),
      null,
    );
    expect(view.friends.map((f) => [f.name, f.state, f.initial])).toEqual([
      ['beto', 'room', 'B'],
      ['', 'online', '?'],
      ['zed', 'offline', 'Z'],
    ]);
  });

  it('offers Join only for a valid room that is not the one I am in, and marks my own room', () => {
    const friends = [
      { id: ID(1), nickname: 'ana', state: 'room' as const, room: 'K7M3A' },
      { id: ID(2), nickname: 'ben', state: 'room' as const, room: 'K7M' },
    ];
    const away = friendsView(overview({ friends }), null);
    expect(away.friends.map((f) => [f.name, f.joinRoom])).toEqual([
      ['ana', 'K7M3A'],
      ['ben', null],
    ]);
    const together = friendsView(overview({ friends }), 'K7M3A');
    expect(together.friends.find((f) => f.name === 'ana')).toMatchObject({ joinRoom: null, inMyRoom: true, stateKey: 'friends.state.same' });
  });

  it('counts who is online (rooms count) and keeps requests and waiting codes apart', () => {
    const view = friendsView(
      overview({
        friends: [
          { id: ID(1), nickname: 'a', state: 'online', room: null },
          { id: ID(2), nickname: 'b', state: 'room', room: 'K7M3A' },
          { id: ID(3), nickname: 'c', state: 'offline', room: null },
        ],
        incoming: [{ id: ID(4), nickname: 'dana' }],
        outgoing: [{ id: ID(5), code: 'K7M3AQ2X' }],
      }),
      null,
    );
    expect(view.onlineCount).toBe(2);
    expect(view.requests).toEqual([{ id: ID(4), name: 'dana', initial: 'D' }]);
    expect(view.waiting).toEqual([{ id: ID(5), code: 'K7M3AQ2X' }]);
    expect(view.code).toBe('K7M3AQ2X');
  });

  it('every state label exists in every language', () => {
    const view = friendsView(overview({ friends: [{ id: ID(1), nickname: 'a', state: 'offline', room: null }] }), null);
    for (const language of LANGUAGES) expect(view.friends.map((f) => f.stateKey).filter((k) => !(k in catalog(language))), language).toEqual([]);
  });
});

describe('initialOf', () => {
  it('is the first letter, upper-cased, or ? for no name', () => {
    expect(initialOf('ana')).toBe('A');
    expect(initialOf('Ñandú')).toBe('Ñ');
    expect(initialOf('')).toBe('?');
    expect(initialOf('  ')).toBe('?');
  });
});

describe('the signed-out gate', () => {
  it('shows the account card with no token and the list with one', () => {
    expect(gateFor(null)).toBe('account');
    expect(gateFor('tok')).toBe('list');
  });
});
