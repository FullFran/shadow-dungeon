import { describe, expect, it } from 'vitest';
import { clearDevServiceWorkers } from '../../src/pwa/register';

describe('development never runs behind a stale service worker', () => {
  it('dev cleanup unregisters every worker and deletes the game caches only', async () => {
    const unregistered: string[] = [];
    const deleted: string[] = [];
    const registration = (scope: string) => ({ scope, unregister: async () => (unregistered.push(scope), true) });
    const removed = await clearDevServiceWorkers(
      { getRegistrations: async () => [registration('http://localhost:5173/'), registration('http://localhost:5173/sub/')] },
      { keys: async () => ['mazmorra-art-dev', 'mazmorra-runtime-1', 'someone-else'], delete: async (name: string) => (deleted.push(name), true) },
    );
    expect(unregistered).toEqual(['http://localhost:5173/', 'http://localhost:5173/sub/']);
    expect(deleted).toEqual(['mazmorra-art-dev', 'mazmorra-runtime-1']);
    expect(removed).toBe(2);
  });

  it('nothing to clear is a no-op', async () => {
    const removed = await clearDevServiceWorkers({ getRegistrations: async () => [] }, { keys: async () => [], delete: async () => true });
    expect(removed).toBe(0);
  });
});
