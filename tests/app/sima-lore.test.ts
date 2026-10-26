import { describe, expect, it } from 'vitest';
import { FACELESS, guardianEchoLook, lookText, NOT_YOURS, shadowPlace, simaFoeLook, SOMEONE, storyFoeLook, type SimaMemory } from '../../src/app/sima-lore';
import { dailySeed } from '../../src/core/endless';
import { floorPlanOf, startRun } from '../../src/core/run';
import { ECLIPSE } from '../../src/data/dungeons';
import { ENDLESS } from '../../src/data/endless';
import { ROOMS } from '../../src/data/rooms';
import { SIMA_SHADOWS, SIMA_WOUNDS } from '../../src/data/sima-story';
import { LANGUAGES, setLanguage, t } from '../../src/i18n';

/**
 * «Lo mecánico sale de la semilla; lo narrativo sale de tu memoria»
 * (docs/sima-redesign.md): a player who has closed no Senda and beaten no
 * guardian, and one who has closed them all, meet the same bosses on the
 * same floors of the same seed (the daily challenge stays fair); only the
 * names and lines differ.
 */
const GUARDIANS = ENDLESS.echoes.map((e) => ROOMS[e.room].spawns[0]!.species);
const NEW: SimaMemory = { beaten: new Set(), sendas: undefined };
const ALL: SimaMemory = { beaten: new Set(GUARDIANS), sendas: { mimikyu: 3, cubone: 3, litwick: 3, zorua: 3, abra: 3, piplup: 3, shinx: 3, axew: 3 } };

describe('the Sima as the player remembers it', () => {
  it('a guardian not yet beaten is a faceless guardian; beaten, it has its name', () => {
    expect(guardianEchoLook('aegislash', NEW)).toMatchObject({ shown: FACELESS, silhouette: true });
    expect(guardianEchoLook('aegislash', ALL)).toMatchObject({ shown: 'aegislash', silhouette: false });
  });

  it('every Senda shadow walks a road (its chapter and floor), and is nameless until that chapter is closed', () => {
    for (const b of SIMA_SHADOWS) {
      const place = shadowPlace(b)!;
      expect(place, b.species).not.toBeNull();
      expect([3, 6]).toContain(place.floor);
      expect(storyFoeLook(b, NEW)).toMatchObject({ shown: SOMEONE, silhouette: true });
      expect(storyFoeLook(b, { beaten: new Set(), sendas: { [b.line]: place.chapter - 1 } }).shown).toBe(SOMEONE);
      expect(storyFoeLook(b, { beaten: new Set(), sendas: { [b.line]: place.chapter } })).toMatchObject({ shown: b.species, silhouette: false });
    }
  });

  it('every wound is «a wound that is not yours» until a chapter of its Senda is closed', () => {
    for (const b of SIMA_WOUNDS) {
      expect(storyFoeLook(b, NEW)).toMatchObject({ shown: NOT_YOURS, silhouette: true });
      expect(storyFoeLook(b, { beaten: new Set(), sendas: { [b.line]: 1 } })).toMatchObject({ shown: b.species, silhouette: false });
    }
  });

  it('every look reads as text in both languages, nothing left unfilled', () => {
    for (const language of LANGUAGES) {
      setLanguage(language);
      for (const memory of [NEW, ALL]) {
        const looks = [...SIMA_SHADOWS, ...SIMA_WOUNDS].map((b) => storyFoeLook(b, memory)).concat(GUARDIANS.map((g) => guardianEchoLook(g, memory)));
        for (const look of looks) {
          const text = lookText(look, 35, t);
          for (const s of [text.name, text.subtitle, text.log ?? '']) {
            expect(s).not.toMatch(/[{}]/);
            expect(s).not.toMatch(/^(species|sima|story|endless)\./);
          }
        }
      }
    }
    setLanguage('es');
  });

  it('fairness: the same seed gives the same floors and bosses whatever the memory; only the names change', () => {
    for (const seed of [1, 4242, dailySeed('2026-10-26')]) {
      let named = 0;
      for (let floor = 1; floor <= 60; floor++) {
        // The run never sees the memory: two players load the same world.
        const a = startRun(seed, {}, floor, ECLIPSE.id);
        const b = startRun(seed, {}, floor, ECLIPSE.id);
        expect(JSON.stringify(b.world)).toBe(JSON.stringify(a.world));
        expect(floorPlanOf(b.run)).toEqual(floorPlanOf(a.run));
        const plan = floorPlanOf(a.run);
        const boss = a.world.enemies.find((e) => e.boss);
        if (plan.kind !== 'room' || !boss) continue;
        const fresh = simaFoeLook(plan.room, boss.species, NEW, GUARDIANS);
        const veteran = simaFoeLook(plan.room, boss.species, ALL, GUARDIANS);
        if (!fresh || !veteran) continue;
        // Same boss, different names.
        expect(veteran.shown).toBe(boss.species);
        expect(fresh.shown).not.toBe(boss.species);
        named++;
      }
      expect(named).toBeGreaterThan(4);
    }
  });
});
