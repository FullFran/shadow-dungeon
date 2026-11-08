import { describe, expect, it } from 'vitest';
import { resolveAnimSheet } from '../../src/adapters/anim-sheet';
import { sheetKey } from '../../src/adapters/asset-keys';
import { SPRITES } from '../../src/data/sprites';

// Owner 2026-11-08: "al empezar a andar por un segundo ... se ven como un cuadrado rosa". A Walk sheet still on its way
// must never draw a placeholder: the creature keeps its Idle sheet until Walk is here.
const sprite = Object.keys(SPRITES.sprites).find((k) => {
  const anims = SPRITES.sprites[k]!.anims;
  return anims.Walk && anims.Idle && anims.Walk.file !== anims.Idle.file;
})!;
const anims = SPRITES.sprites[sprite]!.anims;
const walkKey = sheetKey(sprite, anims.Walk!.file);
const idleKey = sheetKey(sprite, anims.Idle!.file);
const img = (name: string) => ({ name }) as unknown as HTMLCanvasElement;

function store(loaded: Record<string, HTMLCanvasElement>, pending: string[] = []) {
  return { get: (k: string) => loaded[k], pending: (k: string) => pending.includes(k) };
}

describe('resolveAnimSheet', () => {
  it('returns the asked animation when its sheet is here', () => {
    const walk = img('walk');
    const got = resolveAnimSheet(store({ [walkKey]: walk, [idleKey]: img('idle') }), sprite, 'Walk');
    expect(got.kind).toBe('sheet');
    if (got.kind === 'sheet') {
      expect(got.image).toBe(walk);
      expect(got.anim).toBe('Walk');
    }
  });

  it('falls back to the Idle sheet while Walk is still loading', () => {
    const idle = img('idle');
    const got = resolveAnimSheet(store({ [idleKey]: idle }, [walkKey]), sprite, 'Walk');
    expect(got.kind).toBe('sheet');
    if (got.kind === 'sheet') {
      expect(got.image).toBe(idle);
      expect(got.anim).toBe('Idle');
      expect(got.meta).toBe(anims.Idle);
    }
  });

  it('draws nothing (not a placeholder) while neither sheet is here but one is loading', () => {
    expect(resolveAnimSheet(store({}, [walkKey, idleKey]), sprite, 'Walk').kind).toBe('loading');
  });

  it('reports missing only when no sheet is loaded or loading', () => {
    expect(resolveAnimSheet(store({}), sprite, 'Walk').kind).toBe('missing');
    expect(resolveAnimSheet(store({}), 'no/such', 'Walk').kind).toBe('missing');
  });

  it('a plain Map store (tests, tools) never reports loading', () => {
    expect(resolveAnimSheet(new Map(), sprite, 'Walk').kind).toBe('missing');
  });
});

describe('hubWarmKeys', () => {
  it("warms the partner's Walk sheet for every playable species", async () => {
    const { hubWarmKeys } = await import('../../src/adapters/sprite-sets');
    const { PLAYABLE_SPECIES, SPECIES } = await import('../../src/data/species');
    const { SPRITE_KEYS } = await import('../../src/data/sprites');
    for (const species of PLAYABLE_SPECIES) {
      const base = SPRITE_KEYS[SPECIES[species].sprite];
      expect(hubWarmKeys(species, false, false), species).toEqual([sheetKey(base, SPRITES.sprites[base]!.anims.Walk!.file)]);
    }
  });
});
