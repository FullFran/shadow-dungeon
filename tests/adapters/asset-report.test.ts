import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { subscribeErrors } from '../../src/adapters/net-error';

/** A stand-in for the browser image: the shared loader hands back whatever `image` resolves to. */
const fake = vi.hoisted(() => ({ failedUrls: new Set<string>() }));

vi.mock('../../src/adapters/assets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/adapters/assets')>();
  return {
    ...actual,
    image: vi.fn(async (url: string) => ({ url }) as unknown as import('../../src/adapters/assets').SheetImage),
    imageState: (url: string) => (fake.failedUrls.has(url) ? 'failed' : 'loaded'),
  };
});

const { reportAssetFailure, resetAssetReports } = await import('../../src/adapters/assets');
const { loadTownImages } = await import('../../src/town/scene');

describe('asset failures reach the error model once per session', () => {
  const seen: string[] = [];
  let off = (): void => undefined;

  beforeEach(() => {
    seen.length = 0;
    fake.failedUrls.clear();
    resetAssetReports();
    off = subscribeErrors((e, scope) => seen.push(`${scope}:${e.kind}`));
  });
  afterEach(() => off());

  it('reportAssetFailure tells the error model the first time and stays quiet afterwards, whichever the scope', () => {
    reportAssetFailure('sprite');
    reportAssetFailure('sprite');
    reportAssetFailure('tile');
    expect(seen).toEqual(['sprite:asset']);
  });

  it('the town tile loader reports a failed tile as an asset error (scope tile), once however many fail', async () => {
    const base = `${import.meta.env.BASE_URL}tiles/town/`;
    const images = await loadTownImages();
    expect(images.size).toBeGreaterThan(3);
    expect(seen).toEqual([]);
    const files = [...images.keys()];
    fake.failedUrls.add(base + files[0]!);
    fake.failedUrls.add(base + files[1]!);
    await loadTownImages();
    expect(seen).toEqual(['tile:asset']);
  });

  it('a town whose tiles all load reports nothing', async () => {
    await loadTownImages();
    expect(seen).toEqual([]);
  });
});
