import { describe, expect, it } from 'vitest';
import { createAssetLoader, type LoaderDeps } from '../../src/adapters/asset-loader';

/** A fake image: loadImage is scripted per URL; every start is logged in order. */
function harness(options: { maxActive?: number; failures?: Record<string, number> } = {}) {
  const started: string[] = [];
  const pending = new Map<string, { resolve: (v: object) => void; reject: (e: Error) => void }>();
  const failures = { ...(options.failures ?? {}) };
  const failed: string[] = [];
  const deps: LoaderDeps<object> = {
    base: 'sprites/',
    maxActive: options.maxActive ?? 8,
    lowActive: 1,
    loadImage: (url) => {
      started.push(url);
      if ((failures[url] ?? 0) > 0) {
        failures[url]! -= 1;
        return Promise.reject(new Error('404'));
      }
      return new Promise<object>((resolve, reject) => pending.set(url, { resolve, reject }));
    },
    placeholder: (url) => ({ placeholder: url }),
    sleep: () => Promise.resolve(),
    onFailure: (url) => failed.push(url),
  };
  const loader = createAssetLoader(deps);
  const finish = (url: string) => pending.get(url)!.resolve({ image: url });
  const settle = () => new Promise((r) => setTimeout(r, 0));
  return { loader, started, finish, failed, settle };
}

describe('asset loader', () => {
  it('dedupes: the same sheet requested twice loads once and both get the same image', async () => {
    const h = harness();
    const a = h.loader.sheet('0778/0000/Idle-Anim.png');
    const b = h.loader.sheet('0778/0000/Idle-Anim.png');
    await h.settle();
    h.finish('sprites/0778/0000/Idle-Anim.png');
    expect(await a).toBe(await b);
    expect(h.started).toEqual(['sprites/0778/0000/Idle-Anim.png']);
  });

  it('caches: a loaded sheet is served at once, without another load', async () => {
    const h = harness();
    const first = h.loader.sheet('a/b.png');
    await h.settle();
    h.finish('sprites/a/b.png');
    const image = await first;
    expect(h.loader.get('a/b.png')).toBe(image);
    expect(h.loader.state('a/b.png')).toBe('loaded');
    expect(await h.loader.sheet('a/b.png')).toBe(image);
    expect(h.started).toHaveLength(1);
  });

  it('prioritises: with one slot, a high request starts before queued low ones', async () => {
    const h = harness({ maxActive: 1 });
    void h.loader.sheet('l1.png', { priority: 'low' });
    void h.loader.sheet('l2.png', { priority: 'low' });
    void h.loader.sheet('l3.png', { priority: 'low' });
    void h.loader.sheet('hi.png', { priority: 'high' });
    await h.settle();
    h.finish('sprites/l1.png');
    await h.settle();
    expect(h.started.slice(0, 2)).toEqual(['sprites/l1.png', 'sprites/hi.png']);
  });

  it('promotes a queued low request when the same sheet is asked for with high priority', async () => {
    const h = harness({ maxActive: 1 });
    void h.loader.sheet('busy.png', { priority: 'high' });
    void h.loader.sheet('l1.png', { priority: 'low' });
    void h.loader.sheet('l2.png', { priority: 'low' });
    void h.loader.sheet('l2.png', { priority: 'high' });
    await h.settle();
    h.finish('sprites/busy.png');
    await h.settle();
    expect(h.started).toEqual(['sprites/busy.png', 'sprites/l2.png']);
  });

  it('background (low) loads leave room for the high ones: never more than the low limit at once', async () => {
    const h = harness({ maxActive: 8 });
    for (let i = 0; i < 5; i++) void h.loader.sheet(`l${i}.png`, { priority: 'low' });
    await h.settle();
    expect(h.started).toHaveLength(1);
    void h.loader.sheet('hi.png', { priority: 'high' });
    await h.settle();
    expect(h.started).toContain('sprites/hi.png');
  });

  it('retries once, then falls back to a placeholder and reports the failure once', async () => {
    const h = harness({ failures: { 'sprites/gone.png': 2 } });
    const image = (await h.loader.sheet('gone.png')) as unknown;
    expect(image).toEqual({ placeholder: 'sprites/gone.png' });
    expect(h.started.filter((u) => u === 'sprites/gone.png')).toHaveLength(2);
    expect(h.failed).toEqual(['sprites/gone.png']);
    expect(h.loader.state('gone.png')).toBe('failed');
    expect(h.loader.get('gone.png')).toEqual({ placeholder: 'sprites/gone.png' });
    await h.loader.sheet('gone.png');
    expect(h.started.filter((u) => u === 'sprites/gone.png')).toHaveLength(2);
  });

  it('a second try that works is not a failure', async () => {
    const h = harness({ failures: { 'sprites/flaky.png': 1 } });
    const pending = h.loader.sheet('flaky.png');
    await h.settle();
    h.finish('sprites/flaky.png');
    expect(await pending).toEqual({ image: 'sprites/flaky.png' });
    expect(h.failed).toEqual([]);
  });

  it('get() on a sheet nobody asked for is empty, pending, and starts a low-priority load', async () => {
    const h = harness();
    expect(h.loader.get('late.png')).toBeUndefined();
    expect(h.loader.state('late.png')).toBe('pending');
    await h.settle();
    expect(h.started).toEqual(['sprites/late.png']);
    expect(h.loader.get('late.png')).toBeUndefined();
    expect(h.started).toHaveLength(1);
  });

  it('preload reports real progress and resolves when everything settled, failures included', async () => {
    const h = harness({ failures: { 'sprites/bad.png': 2 } });
    const progress: string[] = [];
    const done = h.loader.preload(['a.png', 'b.png', 'bad.png'], { onProgress: (d, t) => progress.push(`${d}/${t}`) });
    await h.settle();
    h.finish('sprites/a.png');
    h.finish('sprites/b.png');
    await done;
    expect(progress[progress.length - 1]).toBe('3/3');
    expect(progress[0]).not.toBe('0/3');
    expect(progress.length).toBeGreaterThanOrEqual(3);
  });

  it('serves any image URL through the same cache (portraits, tiles)', async () => {
    const h = harness();
    const a = h.loader.image('portraits/0778.png');
    const b = h.loader.image('portraits/0778.png');
    await h.settle();
    h.finish('portraits/0778.png');
    expect(await a).toBe(await b);
    expect(h.started).toEqual(['portraits/0778.png']);
  });
});
