import type { KeyValueStore } from '../adapters/storage';
import { chaptersCleared, type StoryProgress } from '../core/story';
import { CHALLENGES, SENDA_ROADS } from '../data/dungeons';
import { simaStoryBossOf, type SimaStoryBoss } from '../data/sima-story';
import type { RoomId } from '../data/rooms';
import { storyKeys, type ChapterNumber } from '../data/story-quests';
import { readRecords } from '../town/records';
import { beatenBosses } from '../town/shrine-records';
import { loadSave } from './save';

/**
 * What the player's memory does to the Sima (docs/sima-redesign.md: «lo
 * mecánico sale de la semilla; lo narrativo sale de tu memoria»), pure:
 * names, epithets and log lines, never which boss stands where. A guardian
 * not yet beaten is a faceless guardian; a Senda boss of a Senda not yet
 * closed is somebody's shadow, or a wound that is not yours. The fight is the
 * same either way, and every peer of a shared run reads its own memory.
 */
export interface SimaMemory {
  /** Guardians and mid-bosses beaten on this device (town/shrine-records.ts `beatenBosses`). */
  beaten: ReadonlySet<string>;
  /** Senda chapters closed (the save's `story`). */
  sendas: StoryProgress | undefined;
}

/** This device's memory: its records and its save. */
export function readSimaMemory(store: KeyValueStore): SimaMemory {
  return { beaten: beatenBosses(readRecords(store)), sendas: loadSave(store).story };
}

/** Pseudo species whose names stand for what the player does not know (`species.<id>` in the i18n). */
export const FACELESS = 'sima-faceless';
export const SOMEONE = 'sima-someone';
export const NOT_YOURS = 'sima-not-yours';

/** How the player sees one boss of the Sima: the name it goes by (a species id or a pseudo one), its subtitle and its log line. */
export interface SimaFoeLook {
  /** `species.<shown>` is its name. */
  shown: string;
  /** Drawn as a silhouette (the player does not know its face). */
  silhouette: boolean;
  /** The name card's subtitle key (`{floor}` filled in by the caller), or its epithet as text. */
  subtitleKey: string;
  /** Recognised: the line said in the log («Es Dusknoir...»), as a key; null otherwise. */
  logKey: string | null;
  /** A Senda boss: its line (the log line names it). */
  line?: string;
  /** A recognised Senda boss: its epithet key (story.<line>.<chapter>.boss.<floor>.title). */
  epithetKey?: string;
}

/** A guardian echo: its name once beaten, else a faceless guardian (same fight). */
export function guardianEchoLook(species: string, memory: SimaMemory): SimaFoeLook {
  return memory.beaten.has(species)
    ? { shown: species, silhouette: false, subtitleKey: 'endless.echo', logKey: null }
    : { shown: FACELESS, silhouette: true, subtitleKey: 'endless.echo.faceless', logKey: null };
}

/** Where a shadow walks in its Senda: the chapter of its road and its floor there (3 or 6). */
export function shadowPlace(boss: SimaStoryBoss): { chapter: ChapterNumber; floor: number } | null {
  for (const d of [...CHALLENGES, ...SENDA_ROADS]) {
    const index = d.plan.findIndex((p) => p.kind === 'room' && p.room === boss.room);
    if (index < 0) continue;
    const suffix = /-(\d)$/.exec(d.id);
    return { chapter: (suffix ? Number(suffix[1]) : 1) as ChapterNumber, floor: index + 1 };
  }
  return null;
}

/** The wound's floor in a Senda (its last). */
const WOUND_FLOOR = 7;

/**
 * A Senda boss in the Sima: recognised once its chapter is closed (a wound,
 * once any chapter of its line is: it is in all three), with its name, its
 * epithet and a line in the log; otherwise nameless and in silhouette.
 */
export function storyFoeLook(boss: SimaStoryBoss, memory: SimaMemory): SimaFoeLook {
  const cleared = chaptersCleared(memory.sendas, boss.line);
  if (boss.wound) {
    if (cleared < 1) return { shown: NOT_YOURS, silhouette: true, subtitleKey: 'sima.wound.nameless', logKey: 'sima.wound.log.nameless' };
    const chapter = Math.min(3, cleared) as ChapterNumber;
    return { shown: boss.species, silhouette: false, subtitleKey: 'sima.wound.known', logKey: 'sima.wound.log.known', line: boss.line, epithetKey: storyKeys.bossTitle(boss.line, chapter, WOUND_FLOOR) };
  }
  const place = shadowPlace(boss);
  if (!place || cleared < place.chapter) return { shown: SOMEONE, silhouette: true, subtitleKey: 'sima.stray.nameless', logKey: 'sima.stray.log.nameless' };
  return { shown: boss.species, silhouette: false, subtitleKey: 'sima.stray.known', logKey: 'sima.stray.log.known', line: boss.line, epithetKey: storyKeys.bossTitle(boss.line, place.chapter, place.floor) };
}

/** The look of the boss of a Sima room (a guardian echo, a wound or a lost shadow), for this memory; null for the Eclipse Echo and the heralds. */
export function simaFoeLook(room: RoomId, species: string, memory: SimaMemory, guardians: readonly string[]): SimaFoeLook | null {
  const story = simaStoryBossOf(room);
  if (story) return storyFoeLook(story, memory);
  return guardians.includes(species) ? guardianEchoLook(species, memory) : null;
}

/** Fills a look's text: its name, its name card subtitle and its log line, through `tr`. */
export function lookText(look: SimaFoeLook, floor: number, tr: (key: string) => string): { name: string; subtitle: string; log: string | null } {
  const name = tr(`species.${look.shown}`);
  const epithet = look.epithetKey ? tr(look.epithetKey) : '';
  const line = look.line ? tr(`species.${look.line}`) : '';
  const fill = (s: string) => s.replaceAll('{floor}', String(floor)).replaceAll('{name}', name).replaceAll('{epithet}', epithet).replaceAll('{line}', line);
  return { name, subtitle: fill(tr(look.subtitleKey)), log: look.logKey ? fill(tr(look.logKey)) : null };
}
