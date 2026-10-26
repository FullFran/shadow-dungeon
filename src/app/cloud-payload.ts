import { cleanProfile, EMPTY_PROFILE, type Profile } from './profile';
import { sanitize, migrate, type SaveData } from './save';

/**
 * The cloud payload (docs/gdd.md, Cuentas): one profile in the backend's
 * `saves.data` JSON. The server (server/internal/rules `ValidateSave`)
 * requires an object of at most 64 KB with a top-level `version` equal to
 * the record's version and whole `coins`, and allows any other key. So the
 * save stays flat at the top level (a client from before profiles still
 * reads it: `sanitize` drops unknown keys) and the rest of the profile rides
 * in `profile`:
 *
 *   { ...save, profile: { v: 1, records, shrine, board, bestiary, meta: { savedAt, device? } } }
 */
export const PAYLOAD_VERSION = 1;
/** Headroom under the server's 64 KB cap. */
export const MAX_PAYLOAD_BYTES = 60_000;

export interface CloudMeta {
  /** When the device that wrote it saved this profile (ms since epoch). */
  savedAt: number;
  /** A short label of that device, when known. */
  device?: string;
}

export type CloudData = SaveData & {
  profile?: { v: number; records: unknown; shrine: unknown; board: unknown; bestiary: unknown; meta: CloudMeta };
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const bytes = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).length;

/** The payload for a profile; when it would pass `maxBytes` the oldest heralds go first, then the leaderboard's lowest scores. */
export function encodeCloud(profile: Profile, meta: CloudMeta, maxBytes = MAX_PAYLOAD_BYTES): CloudData {
  const clean = cleanProfile(profile);
  const build = (p: Profile): CloudData => ({
    ...p.save,
    profile: { v: PAYLOAD_VERSION, records: p.records, shrine: p.shrine, board: p.board, bestiary: p.bestiary, meta: cleanMeta(meta) ?? { savedAt: 0 } },
  });
  let current = clean;
  let data = build(current);
  while (bytes(data) > maxBytes && current.bestiary.length > 0) {
    current = { ...current, bestiary: current.bestiary.slice(Math.ceil(current.bestiary.length / 2)) };
    data = build(current);
  }
  while (bytes(data) > maxBytes && current.board.length > 0) {
    current = { ...current, board: current.board.slice(0, -1) };
    data = build(current);
  }
  return data;
}

function cleanMeta(raw: unknown): CloudMeta | null {
  if (!isRecord(raw) || typeof raw.savedAt !== 'number' || !Number.isSafeInteger(raw.savedAt) || raw.savedAt < 0) return null;
  const device = typeof raw.device === 'string' && raw.device.trim() ? raw.device.trim().slice(0, 40) : null;
  return { savedAt: raw.savedAt, ...(device ? { device } : {}) };
}

/**
 * Reads any cloud data as a profile: the save through migrate + sanitize,
 * each other part through its store's parser. A payload from before profiles
 * (a bare save) reads with empty records; anything hostile reads as empty.
 */
export function decodeCloud(raw: unknown): { profile: Profile; meta: CloudMeta | null } {
  if (!isRecord(raw)) return { profile: EMPTY_PROFILE, meta: null };
  const save = sanitize(migrate(raw));
  const extra = isRecord(raw.profile) ? raw.profile : null;
  if (!extra) return { profile: { ...EMPTY_PROFILE, save }, meta: null };
  return {
    profile: cleanProfile({ save, records: extra.records, shrine: extra.shrine, board: extra.board, bestiary: extra.bestiary }),
    meta: cleanMeta(extra.meta),
  };
}
