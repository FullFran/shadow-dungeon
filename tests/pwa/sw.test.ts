import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

/**
 * public/sw.js runs in a sandbox with a fake `self` and a fake Cache Storage
 * (no network, no browser): its pure helpers and its install/activate handlers.
 */
const SOURCE = readFileSync(join(__dirname, '..', '..', 'public', 'sw.js'), 'utf8');
const SCOPE = 'https://user.github.io/mazmorra-sombria/';

interface FakeCache {
  added: string[];
}

function load(version = 'index-AbC123.js') {
  const handlers = new Map<string, (event: unknown) => void>();
  const stores = new Map<string, FakeCache>();
  const deleted: string[] = [];
  let skipped = false;
  const caches = {
    open: async (name: string) => {
      const cache = stores.get(name) ?? { added: [] };
      stores.set(name, cache);
      return { addAll: async (urls: string[]) => void cache.added.push(...urls), put: async () => {}, match: async () => undefined };
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => {
      deleted.push(name);
      return stores.delete(name);
    },
    match: async () => undefined,
  };
  const builtHtml =
    '<script type="module" crossorigin src="./assets/index-AbC123.js"></script><link rel="modulepreload" crossorigin href="./assets/vendor-x9.js"><link rel="stylesheet" crossorigin href="./assets/index-Q1.css"><link rel="manifest" href="./manifest.webmanifest" />';
  const sandbox: Record<string, unknown> = {
    URL,
    Set,
    Promise,
    Response,
    caches,
    fetch: async (url: string) => ({ ok: true, text: async () => builtHtml, url }),
    self: {
      location: { href: `${SCOPE}sw.js?v=${encodeURIComponent(version)}` },
      registration: { scope: SCOPE },
      addEventListener: (type: string, handler: (event: unknown) => void) => handlers.set(type, handler),
      skipWaiting: () => {
        skipped = true;
        return Promise.resolve();
      },
      clients: { claim: async () => {} },
    },
  };
  runInNewContext(SOURCE, sandbox);
  const run = async (type: string, data?: unknown) => {
    let waited: Promise<unknown> = Promise.resolve();
    handlers.get(type)!({ data, waitUntil: (p: Promise<unknown>) => (waited = p) });
    await waited;
  };
  return { sandbox: sandbox as Record<string, (...args: unknown[]) => unknown>, handlers, stores, deleted, run, skipped: () => skipped };
}

describe('service worker', () => {
  it('names its caches after the build version in its URL', () => {
    const { sandbox } = load('index-AbC123.js');
    expect(sandbox.SHELL_CACHE).toBe('mazmorra-shell-index-AbC123.js');
    expect(sandbox.RUNTIME_CACHE).toBe('mazmorra-runtime-index-AbC123.js');
  });

  it('builds the precache list from the built page: hashed JS/CSS, page, manifest, icons and font, all relative', () => {
    const { sandbox } = load();
    const list = sandbox.shellUrls!(
      '<script type="module" crossorigin src="./assets/index-AbC123.js"></script><link rel="stylesheet" href="./assets/index-Q1.css"><link rel="modulepreload" href="./assets/chunk-9.js"><a href="https://example.com/x.js">',
    ) as string[];
    expect(list).toEqual(expect.arrayContaining(['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'fonts/PixelifySans.ttf', 'assets/index-AbC123.js', 'assets/index-Q1.css', 'assets/chunk-9.js']));
    expect(list.some((url) => url.startsWith('/') || url.includes('//'))).toBe(false);
  });

  it('precaches the shell on install, and waits for the player before taking over', async () => {
    const { run, stores, skipped } = load();
    await run('install');
    expect(stores.get('mazmorra-shell-index-AbC123.js')?.added).toEqual(expect.arrayContaining(['assets/index-AbC123.js', 'assets/vendor-x9.js', 'assets/index-Q1.css', 'index.html']));
    expect(skipped()).toBe(false);
  });

  it('takes over only when the page asks (the "Actualizar" toast)', async () => {
    const { run, skipped } = load();
    await run('message', { type: 'SKIP_WAITING' });
    expect(skipped()).toBe(true);
  });

  it('drops the caches of older versions on activate and keeps other sites’ caches', async () => {
    const { run, stores, deleted } = load('v2');
    stores.set('mazmorra-shell-v1', { added: [] });
    stores.set('mazmorra-runtime-v1', { added: [] });
    stores.set('mazmorra-shell-v2', { added: [] });
    stores.set('someone-else', { added: [] });
    await run('activate');
    expect(deleted.sort()).toEqual(['mazmorra-runtime-v1', 'mazmorra-shell-v1']);
  });

  it('serves same-origin game files cache-first, pages network-first, and leaves everything else to the network', () => {
    const { sandbox } = load();
    const strategy = (url: string, mode = 'cors', method = 'GET', range = false) => sandbox.strategyFor!({ url, mode, method, range }, SCOPE);
    expect(strategy(`${SCOPE}sprites/0778/Walk-Anim.png`)).toBe('cache-first');
    expect(strategy(`${SCOPE}tiles/town/ground.png`)).toBe('cache-first');
    expect(strategy(`${SCOPE}music/lonely-village.ogg`)).toBe('cache-first');
    expect(strategy(`${SCOPE}assets/index-AbC123.js`)).toBe('cache-first');
    expect(strategy(`${SCOPE}?seed=3`, 'navigate')).toBe('navigate');
    // Online play and anything cross-origin, non-GET, ranged or outside the scope is never touched.
    expect(strategy('wss://tracker.example.com/announce')).toBe('network');
    expect(strategy('https://cdn.example.com/sprites/a.png')).toBe('network');
    expect(strategy(`${SCOPE}sprites/a.png`, 'cors', 'POST')).toBe('network');
    expect(strategy(`${SCOPE}music/a.ogg`, 'no-cors', 'GET', true)).toBe('network');
    expect(strategy('https://user.github.io/other-repo/sprites/a.png')).toBe('network');
  });
});
