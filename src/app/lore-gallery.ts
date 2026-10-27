import { chaptersCleared, type StoryProgress } from '../core/story';
import type { ChallengeLine } from '../data/dungeons';
import { GUARDIAN_CINEMATICS, type CinematicPhase } from '../data/guardian-cinematics';
import { SIMA_SCENE_IDS, type SimaSceneId } from '../data/sima-scenes';
import type { SpeciesId } from '../data/species';
import { CHAPTERS, STORY_QUESTS, storyKeys, type ChapterNumber, type StoryQuest } from '../data/story-quests';
import type { StoryPhase } from './story';

/**
 * The lore gallery (owner, 2026-10-27: "una galería para volver a ver las
 * cinemáticas, para los amantes del lore"): every cinematic of the game,
 * grouped, built from the data that plays them (the prologue, the villagers'
 * pleas, the Sima's scenes, the guardians, every Senda's chapters), so a new
 * Senda or scene shows up here by itself. Only what this player has seen can
 * be played again; the rest is "???". Pure: no DOM, no storage.
 */
export type GalleryScene =
  | { kind: 'prologue' }
  | { kind: 'plea' }
  | { kind: 'sima'; id: SimaSceneId }
  | { kind: 'guardian'; species: SpeciesId; phase: CinematicPhase }
  | { kind: 'story'; line: ChallengeLine; chapter: ChapterNumber; phase: StoryPhase };

export interface GalleryEntry {
  id: string;
  scene: GalleryScene;
  /** Its row in the gallery, read through `tr` (an i18n lookup). */
  label(tr: (key: string) => string): string;
}

export interface GalleryGroup {
  id: string;
  title(tr: (key: string) => string): string;
  entries: readonly GalleryEntry[];
}

/** What this player has seen: the device's flags, and the save's Senda progress. */
export interface GallerySeen {
  prologue: boolean;
  /** The Sima's scene ids seen on this device, `plea` included. */
  sima: ReadonlySet<string>;
  guardian(species: SpeciesId, phase: CinematicPhase): boolean;
  story: StoryProgress | undefined;
}

const ROMAN: Record<ChapterNumber, string> = { 1: 'I', 2: 'II', 3: 'III' };
const PHASES: readonly StoryPhase[] = ['before', 'after'];
const GUARDIAN_PHASES: readonly CinematicPhase[] = ['pre', 'post'];

/** The Sima's scenes the gallery lists, the pleas first: all but the return's short form (the same tableaux as the whole return). */
export const GALLERY_SIMA_SCENES: readonly (SimaSceneId | 'plea')[] = ['plea', ...SIMA_SCENE_IDS.filter((id) => id !== 'return-short')];

/** The i18n key of a Sima scene's row (`plea` included). */
export const simaGalleryKey = (id: SimaSceneId | 'plea'): string => `gallery.sima.${id}`;

function sendaGroup(quest: StoryQuest): GalleryGroup {
  const { line } = quest;
  return {
    id: `senda-${line}`,
    title: (tr) => tr(storyKeys.title(line)),
    entries: CHAPTERS.flatMap((chapter) =>
      PHASES.map(
        (phase): GalleryEntry => ({
          id: `story-${line}-${chapter}-${phase}`,
          scene: { kind: 'story', line, chapter, phase },
          label: (tr) => `${ROMAN[chapter]} · ${tr(storyKeys.chapterTitle(line, chapter))} · ${tr(`gallery.story.${phase}`)}`,
        }),
      ),
    ),
  };
}

/** Every group in order: the prologue, the Sima, each Senda (whatever `quests` holds), then the guardians. */
export function galleryGroups(quests: Partial<Record<ChallengeLine, StoryQuest>> = STORY_QUESTS): GalleryGroup[] {
  const guardians = Object.keys(GUARDIAN_CINEMATICS) as SpeciesId[];
  return [
    { id: 'prologue', title: (tr) => tr('gallery.group.prologue'), entries: [{ id: 'prologue', scene: { kind: 'prologue' }, label: (tr) => tr('title.prologue') }] },
    {
      id: 'sima',
      title: (tr) => tr('gallery.group.sima'),
      entries: GALLERY_SIMA_SCENES.map(
        (id): GalleryEntry => ({ id: `sima-${id}`, scene: id === 'plea' ? { kind: 'plea' } : { kind: 'sima', id }, label: (tr) => tr(simaGalleryKey(id)) }),
      ),
    },
    ...Object.values(quests).flatMap((quest) => (quest ? [sendaGroup(quest)] : [])),
    {
      id: 'guardians',
      title: (tr) => tr('gallery.group.guardians'),
      entries: guardians.flatMap((species) =>
        GUARDIAN_PHASES.map((phase): GalleryEntry => ({ id: `guardian-${species}-${phase}`, scene: { kind: 'guardian', species, phase }, label: (tr) => `${tr(`species.${species}`)} · ${tr(`gallery.guardian.${phase}`)}` })),
      ),
    },
  ];
}

/**
 * Whether a scene can be played again: seen on this device (the prologue, the
 * pleas, the Sima's scenes, the guardians), or for a Senda's chapter, closed
 * in the save (both its opening and its closing were played on the way).
 */
export function galleryUnlocked(scene: GalleryScene, seen: GallerySeen): boolean {
  switch (scene.kind) {
    case 'prologue':
      return seen.prologue;
    case 'plea':
      return seen.sima.has('plea');
    case 'sima':
      return seen.sima.has(scene.id);
    case 'guardian':
      return seen.guardian(scene.species, scene.phase);
    case 'story':
      return chaptersCleared(seen.story, scene.line) >= scene.chapter;
  }
}

/** How many of a group's scenes are unlocked. */
export const groupSeen = (group: GalleryGroup, seen: GallerySeen): number => group.entries.filter((e) => galleryUnlocked(e.scene, seen)).length;
