import { describe, expect, it } from 'vitest';
import { autoJoin, type AutoJoinResult } from '../../src/net/election';
import { createSession } from '../../src/net/session';
import { createFakeScheduler, createMemoryHub } from '../../src/net/transport';

/** `?net=local` host election: tabs opened at the same instant agree on one host. */
const LOADOUT = ['shadow-claw', 'play-rough'] as const;

function tabs(order: string[]) {
  const scheduler = createFakeScheduler();
  const hub = createMemoryHub<string>();
  const results = new Map<string, AutoJoinResult>();
  const sessions = order.map((id) => ({ id, session: createSession({ transport: hub.connect(id), scheduler }) }));
  for (const [index, { id, session }] of sessions.entries()) {
    void autoJoin({ session, scheduler, searchMs: 700, seed: 100 + index, floor: 1, species: 'mimikyu', loadout: LOADOUT }).then((r) => results.set(id, r));
  }
  return { scheduler, results };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('local host election', () => {
  for (const order of [
    ['tab-a', 'tab-b'],
    ['tab-b', 'tab-a'],
  ]) {
    it(`two tabs searching at once end with one host, the lowest id (opened ${order.join(' then ')})`, async () => {
      const { scheduler, results } = tabs(order);
      scheduler.advance(3000);
      await flush();
      const a = results.get('tab-a')!;
      const b = results.get('tab-b')!;
      expect(a.role).toBe('host');
      expect(b).toMatchObject({ role: 'guest', localId: 'p2', seed: a.seed });
    });
  }

  it('a tab that finds a running host joins it at once', async () => {
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const host = createSession({ transport: hub.connect('tab-z'), scheduler });
    host.host(9, 2, 'mimikyu');
    let result: AutoJoinResult | null = null;
    void autoJoin({ session: createSession({ transport: hub.connect('tab-a'), scheduler }), scheduler, searchMs: 700, seed: 1, floor: 1, species: 'mimikyu', loadout: LOADOUT }).then((r) => (result = r));
    scheduler.advance(10);
    await flush();
    expect(result).toEqual({ role: 'guest', localId: 'p2', seed: 9, floor: 2 });
  });
});
