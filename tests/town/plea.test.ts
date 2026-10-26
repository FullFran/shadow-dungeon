import { describe, expect, it } from 'vitest';
import { PLEA_STAGE, pleaKeys, SIMA_PLEA } from '../../src/data/sima-plea';
import { SPRITE_KEYS } from '../../src/data/sprites';
import { TOWN } from '../../src/data/town';
import { WORLD } from '../../src/data/world';
import { TILE, wallAt } from '../../src/core/tiles';
import { buildTownGrid } from '../../src/town/map';
import { pleaActor, pleaCrowd, pleaSpoken, startPlea, stepPlea } from '../../src/town/plea';
import { catalog, LANGUAGES, setLanguage, t } from '../../src/i18n';

/**
 * The villagers' pleas before the first descent (data/sima-plea.ts): each
 * villager walks up, speaks, steps aside, and the next comes; every line
 * exists in both languages, each plea asks please, and the stage stands on
 * open ground of the crater.
 */
const run = (ms: number, state = startPlea(TILE)) => {
  let s = state;
  for (let i = 0; i < ms / 50; i++) s = stepPlea(s, 50, TILE);
  return s;
};

describe('the villagers\' pleas', () => {
  it('one by one: walk up, speak, step aside; then the next; done after the last', () => {
    let s = run(20_000);
    expect(s.phase).toBe('talk');
    expect(pleaActor(s)!.id).toBe(SIMA_PLEA[0]!.id);
    // It waits while it speaks.
    expect(run(5000, s)).toEqual(s);
    for (let i = 0; i < SIMA_PLEA.length; i++) {
      expect(s.phase).toBe('talk');
      expect(pleaActor(s)!.id).toBe(SIMA_PLEA[i]!.id);
      expect(pleaCrowd(s, TILE)).toHaveLength(i);
      s = run(20_000, pleaSpoken(s));
    }
    expect(s.phase).toBe('done');
    expect(pleaActor(s)).toBeNull();
    expect(pleaCrowd(s, TILE)).toHaveLength(SIMA_PLEA.length);
  });

  it('every villager is one the player knows (a town NPC\'s sheet and name) and Phantump speaks last', () => {
    const npcSpecies = new Set([...TOWN.npcs, ...Object.values(WORLD).flatMap((m) => m.npcs)].map((n) => n.species));
    for (const actor of SIMA_PLEA) {
      expect(npcSpecies.has(actor.species), actor.id).toBe(true);
      expect(SPRITE_KEYS[actor.species]).toBeTruthy();
      expect(catalog('es')[actor.nameKey]).toBeTruthy();
    }
    expect(SIMA_PLEA.at(-1)!.species).toBe('phantump');
    expect(PLEA_STAGE.crowd.length).toBeGreaterThanOrEqual(SIMA_PLEA.length);
  });

  it('every line in both languages; each villager asks please; they call you one of the Sima Walkers', () => {
    for (const language of LANGUAGES) {
      setLanguage(language);
      for (const actor of SIMA_PLEA) {
        const lines = pleaKeys(actor).map((key) => {
          expect(catalog(language)[key], key).toBeTruthy();
          return t(key);
        });
        if (actor.id !== 'oracle') expect(lines.join(' ').toLowerCase(), actor.id).toMatch(language === 'es' ? /por favor/ : /please/);
        for (const line of lines) expect(line).not.toContain('—');
      }
    }
    setLanguage('es');
    expect(t('sima.plea.storyteller.1')).toContain('Caminante de la Sima');
  });

  it('stands on open ground of the crater', () => {
    const map = WORLD[PLEA_STAGE.map];
    const grid = buildTownGrid(map);
    for (const p of [PLEA_STAGE.player, PLEA_STAGE.speak, ...PLEA_STAGE.crowd]) expect(wallAt(grid, { x: p.x * TILE, y: p.y * TILE }), JSON.stringify(p)).toBe(false);
  });
});
