import { describe, expect, it } from 'vitest';
import { galleryGroups, galleryUnlocked, GALLERY_SIMA_SCENES, groupSeen, simaGalleryKey, type GallerySeen } from '../../src/app/lore-gallery';
import { GUARDIAN_CINEMATICS } from '../../src/data/guardian-cinematics';
import { SIMA_SCENE_IDS } from '../../src/data/sima-scenes';
import { CHAPTERS, STORY_QUESTS } from '../../src/data/story-quests';
import { catalog, LANGUAGES } from '../../src/i18n';

/**
 * The lore gallery (odd/tasks/lore-gallery.md): every cinematic of the game,
 * built from the data that plays them, so a new Senda or scene is listed
 * without touching the gallery; only what was seen plays again.
 */
const NONE: GallerySeen = { prologue: false, sima: new Set(), guardian: () => false, story: undefined };
const SENDAS = ['cubone', 'litwick', 'zorua', 'abra', 'piplup', 'shinx', 'axew', 'mimikyu'] as const;

describe('the lore gallery', () => {
  it('opens with the prologue, then the Sima (the pleas first), every Senda and the guardians', () => {
    const groups = galleryGroups();
    expect(groups[0]!.id).toBe('prologue');
    expect(groups[0]!.entries.map((e) => e.scene)).toEqual([{ kind: 'prologue' }]);
    const sima = groups.find((g) => g.id === 'sima')!;
    expect(sima.entries[0]!.scene).toEqual({ kind: 'plea' });
    for (const id of SIMA_SCENE_IDS.filter((s) => s !== 'return-short')) expect(sima.entries.map((e) => e.scene), id).toContainEqual({ kind: 'sima', id });
    expect(sima.entries).toHaveLength(SIMA_SCENE_IDS.length);
  });

  it('every guardian cinematic, both phases', () => {
    const guardians = galleryGroups().find((g) => g.id === 'guardians')!;
    const species = Object.keys(GUARDIAN_CINEMATICS);
    expect(species.length).toBeGreaterThan(0);
    for (const s of species) for (const phase of ['pre', 'post']) expect(guardians.entries.map((e) => e.scene)).toContainEqual({ kind: 'guardian', species: s, phase });
  });

  it('every Senda of every line, by chapter, its opening and its closing', () => {
    const groups = galleryGroups();
    expect(Object.keys(STORY_QUESTS).sort()).toEqual([...SENDAS].sort());
    for (const line of Object.keys(STORY_QUESTS)) {
      const group = groups.find((g) => g.id === `senda-${line}`);
      expect(group, line).toBeDefined();
      expect(group!.entries.map((e) => e.scene)).toEqual(CHAPTERS.flatMap((chapter) => (['before', 'after'] as const).map((phase) => ({ kind: 'story', line, chapter, phase }))));
    }
  });

  it('a new Senda shows up by itself', () => {
    const groups = galleryGroups({ ...STORY_QUESTS, cubone: undefined, litwick: { ...STORY_QUESTS.cubone!, line: 'litwick' } });
    expect(groups.some((g) => g.id === 'senda-cubone')).toBe(false);
    expect(groups.filter((g) => g.id === 'senda-litwick')).toHaveLength(1);
    expect(galleryGroups()).toHaveLength(3 + Object.keys(STORY_QUESTS).length);
  });

  it('nothing seen: everything locked', () => {
    for (const g of galleryGroups()) {
      expect(groupSeen(g, NONE), g.id).toBe(0);
      for (const e of g.entries) expect(galleryUnlocked(e.scene, NONE), e.id).toBe(false);
    }
  });

  it('unlocks the prologue, the seen Sima scenes, the seen guardians and the closed chapters only', () => {
    const seen: GallerySeen = { prologue: true, sima: new Set(['plea', 'mouth']), guardian: (s, p) => s === 'aegislash' && p === 'pre', story: { cubone: 2 } };
    expect(galleryUnlocked({ kind: 'prologue' }, seen)).toBe(true);
    expect(galleryUnlocked({ kind: 'plea' }, seen)).toBe(true);
    expect(galleryUnlocked({ kind: 'sima', id: 'mouth' }, seen)).toBe(true);
    expect(galleryUnlocked({ kind: 'sima', id: 'lost' }, seen)).toBe(false);
    expect(galleryUnlocked({ kind: 'guardian', species: 'aegislash', phase: 'pre' }, seen)).toBe(true);
    expect(galleryUnlocked({ kind: 'guardian', species: 'aegislash', phase: 'post' }, seen)).toBe(false);
    expect(galleryUnlocked({ kind: 'story', line: 'cubone', chapter: 2, phase: 'after' }, seen)).toBe(true);
    expect(galleryUnlocked({ kind: 'story', line: 'cubone', chapter: 3, phase: 'before' }, seen)).toBe(false);
    expect(galleryUnlocked({ kind: 'story', line: 'zorua', chapter: 1, phase: 'before' }, seen)).toBe(false);
    expect(groupSeen(galleryGroups().find((g) => g.id === 'senda-cubone')!, seen)).toBe(4);
  });

  for (const language of LANGUAGES) {
    it(`"${language}" names every group and row, no em dash, no missing key`, () => {
      const strings = catalog(language);
      const missing: string[] = [];
      const tr = (key: string) => {
        const v = strings[key];
        if (!v) missing.push(key);
        return v ?? key;
      };
      const texts = galleryGroups().flatMap((g) => [g.title(tr), ...g.entries.map((e) => e.label(tr))]);
      for (const key of ['gallery.title', 'gallery.intro', 'gallery.locked', 'gallery.locked.about', 'gallery.play.about', 'gallery.group.about', 'gallery.plea.room', 'townMenu.gallery', 'townMenu.gallery.about']) tr(key);
      for (const id of GALLERY_SIMA_SCENES) tr(simaGalleryKey(id));
      expect(missing).toEqual([]);
      for (const text of texts) expect(text.includes('—'), text).toBe(false);
    });
  }
});
