import type { KeyValueStore } from '../adapters/storage';
import { BESTIARY_KEY, parseBestiary, type BestiaryEntry } from '../town/bestiary';
import { compareScores, LEADERBOARD_KEY, parseBoard, type ScoreEntry } from '../town/leaderboard';
import { EMPTY_RECORDS, parseRecords, RECORDS_KEY, type Records } from '../town/records';
import { EMPTY_SHRINE, parseShrine, SHRINE_KEY, type ShrineRecords } from '../town/shrine-records';
import { EMPTY_SAVE, migrate, parseSave, sanitize, SAVE_KEY, type SaveData } from './save';

/**
 * The player's profile (docs/gdd.md, Cuentas): everything that is progress
 * and travels with the account. The save facade plus the run records, the
 * shrine records, the Sima leaderboard and the bestiary. Settings, the
 * prologue and cinematic "seen" flags and the install banner stay per device.
 */
export interface Profile {
  save: SaveData;
  records: Records;
  shrine: ShrineRecords;
  board: ScoreEntry[];
  bestiary: BestiaryEntry[];
}

/** Every local key that holds profile data (multi-tab sync and the wiring test iterate it). */
export const PROFILE_KEYS = [SAVE_KEY, RECORDS_KEY, SHRINE_KEY, LEADERBOARD_KEY, BESTIARY_KEY] as const;

export const EMPTY_PROFILE: Profile = { save: EMPTY_SAVE, records: EMPTY_RECORDS, shrine: EMPTY_SHRINE, board: [], bestiary: [] };

const safeGet = (store: KeyValueStore, key: string): string | null => {
  try {
    return store.get(key);
  } catch {
    return null;
  }
};

/** Reads the profile from the store; broken parts read as empty, a failing store never throws. */
export function readProfile(store: KeyValueStore): Profile {
  return {
    save: parseSave(safeGet(store, SAVE_KEY)),
    records: parseRecords(safeGet(store, RECORDS_KEY)),
    shrine: parseShrine(safeGet(store, SHRINE_KEY)),
    board: parseBoard(safeGet(store, LEADERBOARD_KEY)),
    bestiary: parseBestiary(safeGet(store, BESTIARY_KEY)),
  };
}

/** Normalizes any profile-like value through each store's parser (hostile parts read as empty). */
export function cleanProfile(raw: { save?: unknown; records?: unknown; shrine?: unknown; board?: unknown; bestiary?: unknown }): Profile {
  const text = (value: unknown) => (value === undefined ? null : JSON.stringify(value));
  return {
    save: sanitize(migrate(raw.save)),
    records: parseRecords(text(raw.records)),
    shrine: parseShrine(text(raw.shrine)),
    board: parseBoard(text(raw.board)),
    bestiary: parseBestiary(text(raw.bestiary) ?? '[]'),
  };
}

/** Writes every part of the profile; a failing store only costs the writes. */
export function writeProfile(store: KeyValueStore, profile: Profile): void {
  const clean = cleanProfile(profile);
  const parts: [string, unknown][] = [
    [SAVE_KEY, clean.save],
    [RECORDS_KEY, clean.records],
    [SHRINE_KEY, clean.shrine],
    [LEADERBOARD_KEY, clean.board],
    [BESTIARY_KEY, clean.bestiary],
  ];
  for (const [key, value] of parts) {
    try {
      store.set(key, JSON.stringify(value));
    } catch {
      // Not persisted.
    }
  }
}

/** Canonical text of a profile (same progress, same text). */
export const profileText = (profile: Profile): string => JSON.stringify(cleanProfile(profile));

/**
 * A short stable hash of a profile (cyrb53, 53 bits, plus the text length):
 * what the device remembers of the last synced profile, to tell whether
 * local progress changed since then.
 */
export const profileHash = (profile: Profile): string => hashText(profileText(profile));

/** cyrb53 of any text, with its length: short, stable, not cryptographic. */
export function hashText(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return `${hash.toString(36)}:${text.length.toString(36)}`;
}

const EMPTY_TEXT = profileText(EMPTY_PROFILE);
export const isEmptyProfile = (profile: Profile): boolean => profileText(profile) === EMPTY_TEXT;
export const sameProfile = (a: Profile, b: Profile): boolean => profileText(a) === profileText(b);

export interface ProfileSummary {
  coins: number;
  /** Gacha and evolved Pokémon owned. */
  owned: number;
  achievements: number;
  /** Deepest floor reached in any dungeon (0 = none). */
  bestFloor: number;
  /** Best Sima score floor (0 = none). */
  bestSima: number;
  /** When this profile was last saved (ms), when known. */
  savedAt: number | null;
}

/** What the notices and cards show of a profile. */
export function profileSummary(profile: Profile, savedAt: number | null = null): ProfileSummary {
  const floors = Object.values(profile.records.dungeons).map((d) => d.bestFloor);
  const sima = [...profile.board].sort(compareScores)[0]?.floor ?? 0;
  return {
    coins: profile.save.coins,
    owned: profile.save.owned?.length ?? 0,
    achievements: Object.keys(profile.save.achievements ?? {}).length,
    bestFloor: floors.length > 0 ? Math.max(...floors) : 0,
    bestSima: sima,
    savedAt,
  };
}
