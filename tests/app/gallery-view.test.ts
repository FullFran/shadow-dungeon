import { describe, expect, it } from 'vitest';
import { galleryCards, galleryProgress, galleryRows, gridMove, groupTint } from '../../src/app/gallery-view';
import { galleryGroups, GALLERY_SIMA_SCENES, type GallerySeen } from '../../src/app/lore-gallery';
import { CHAPTERS } from '../../src/data/story-quests';
import { catalog, LANGUAGES } from '../../src/i18n';
import { GALLERY_ICONS } from '../../src/ui/icons/gallery-icons';

/**
 * The gallery in the picker pattern (odd/tasks/account-drawer-and-menus.md T3): a card per group, a sheet of
 * its scenes, an honest progress bar. Every test iterates the data (`galleryGroups`), so a new Senda or
 * scene without a card, icon or row fails here instead of passing silently.
 */
const tr = (key: string) => catalog('es')[key] ?? key;
const NONE: GallerySeen = { prologue: false, sima: new Set(), guardian: () => false, story: undefined };
const ALL: GallerySeen = { prologue: true, sima: new Set(GALLERY_SIMA_SCENES), guardian: () => true, story: undefined, storyScene: () => true };

describe('the gallery view model', () => {
  it('renders a card for every gallery group, in order, with its icon and tint', () => {
    const groups = galleryGroups();
    const cards = galleryCards(groups, NONE, tr);
    expect(cards.map((c) => c.id)).toEqual(groups.map((g) => g.id));
    for (const [i, card] of cards.entries()) {
      expect(card.title, card.id).toBe(groups[i]!.title(tr));
      expect(card.total, card.id).toBe(groups[i]!.entries.length);
      expect(GALLERY_ICONS[card.id], `icon ${card.id}`).toBeDefined();
      expect(groupTint(card.id), `tint ${card.id}`).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('seals a group nothing of which was seen, with a hint that names no scene', () => {
    const groups = galleryGroups();
    for (const card of galleryCards(groups, NONE, tr)) {
      expect(card.locked, card.id).toBe(true);
      expect(card.seen, card.id).toBe(0);
      expect(card.hint, card.id).toBeTruthy();
      const group = groups.find((g) => g.id === card.id)!;
      // The hint is never a scene's own label.
      for (const entry of group.entries) expect(card.hint, `${card.id} ${entry.id}`).not.toBe(entry.label(tr));
    }
  });

  it('opens a group as soon as one scene is seen and drops its hint', () => {
    const groups = galleryGroups();
    const some: GallerySeen = { ...NONE, prologue: true };
    const [prologue, ...rest] = galleryCards(groups, some, tr);
    expect(prologue!.locked).toBe(false);
    expect(prologue!.seen).toBe(1);
    expect(prologue!.hint).toBeNull();
    for (const card of rest) expect(card.locked, card.id).toBe(true);
  });

  it('counts seen against the total, and only real seen scenes move the progress bar', () => {
    const groups = galleryGroups();
    const total = groups.reduce((n, g) => n + g.entries.length, 0);
    expect(galleryProgress(groups, NONE)).toEqual({ seen: 0, total, fraction: 0 });
    expect(galleryProgress(groups, ALL)).toEqual({ seen: total, total, fraction: 1 });
    expect(galleryProgress(groups, { ...NONE, prologue: true }).seen).toBe(1);
    for (const card of galleryCards(groups, ALL, tr)) expect(card.seen, card.id).toBe(card.total);
  });

  it('lists a row for every scene of every group, hiding the names of unseen ones', () => {
    for (const group of galleryGroups()) {
      const hidden = galleryRows(group, NONE, tr);
      const open = galleryRows(group, ALL, tr);
      const ids = (rows: typeof open) => rows.flatMap((r) => r.scenes.map((s) => s.entry.id));
      expect(ids(open), group.id).toEqual(group.entries.map((e) => e.id));
      expect(ids(hidden), group.id).toEqual(group.entries.map((e) => e.id));
      for (const row of hidden) {
        expect(row.title, `${group.id} ${row.id}`).toBe(tr('gallery.locked'));
        for (const scene of row.scenes) expect(scene.unlocked, scene.entry.id).toBe(false);
      }
      for (const row of open) {
        expect(row.title, `${group.id} ${row.id}`).not.toBe(tr('gallery.locked'));
        for (const scene of row.scenes) expect(scene.unlocked, scene.entry.id).toBe(true);
      }
    }
  });

  it('folds a Senda chapter into one row with its opening and closing', () => {
    const senda = galleryGroups().find((g) => g.id === 'senda-cubone')!;
    const rows = galleryRows(senda, ALL, tr);
    expect(rows).toHaveLength(CHAPTERS.length);
    for (const row of rows) expect(row.scenes.map((s) => s.label)).toEqual([tr('gallery.story.before'), tr('gallery.story.after')]);
  });

  it('shows a row title only for the scene seen, per chapter', () => {
    const senda = galleryGroups().find((g) => g.id === 'senda-cubone')!;
    const first: GallerySeen = { ...NONE, storyScene: (_l, chapter, phase) => chapter === 1 && phase === 'before' };
    const rows = galleryRows(senda, first, tr);
    expect(rows[0]!.scenes.map((s) => s.unlocked)).toEqual([true, false]);
    expect(rows[0]!.title).not.toBe(tr('gallery.locked'));
    expect(rows[1]!.title).toBe(tr('gallery.locked'));
  });

  it('has every label in both languages', () => {
    const keys = ['gallery.title', 'gallery.progress', 'gallery.hint.prologue', 'gallery.hint.sima', 'gallery.hint.senda', 'gallery.hint.guardians', 'gallery.sealed', 'gallery.play', 'gallery.pick', 'gallery.hint.keys'];
    for (const language of LANGUAGES) for (const key of keys) expect(catalog(language)[key], `${language} ${key}`).toBeTruthy();
  });
});

describe('moving across the card grid', () => {
  it('steps by one along a row and by a row across it, stopping at the edges', () => {
    expect(gridMove(0, 10, 4, 'right')).toBe(1);
    expect(gridMove(0, 10, 4, 'left')).toBe(0);
    expect(gridMove(1, 10, 4, 'down')).toBe(5);
    expect(gridMove(5, 10, 4, 'up')).toBe(1);
    expect(gridMove(1, 10, 4, 'up')).toBe(1);
    expect(gridMove(3, 10, 4, 'right')).toBe(3);
  });

  it('lands on the last card when the row below is short', () => {
    expect(gridMove(7, 10, 4, 'down')).toBe(9);
    expect(gridMove(9, 10, 4, 'down')).toBe(9);
    expect(gridMove(9, 10, 4, 'right')).toBe(9);
  });
});
