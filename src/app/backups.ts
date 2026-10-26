import type { KeyValueStore } from '../adapters/storage';
import { decodeCloud, encodeCloud, type CloudData } from './cloud-payload';
import { isEmptyProfile, profileText, type Profile } from './profile';

/**
 * Local profile backups (docs/gdd.md, Cuentas): before cloud sync replaces a
 * profile (here or in the cloud), the replaced one is kept in a ring of the
 * last BACKUP_LIMIT, newest first, so it can be undone or restored from the
 * account screen, and saved to or read from a JSON file. An empty profile is
 * never kept (nothing to lose), nor one equal to the newest backup.
 */
export const BACKUPS_KEY = 'mazmorra-sombria.backups';
export const BACKUP_LIMIT = 3;
export const EXPORT_KIND = 'mazmorra-sombria.profile';

/** Why a profile was replaced (the backup list names it). */
export const BACKUP_REASONS = ['pull', 'download', 'choice', 'cloud', 'other-account', 'discard', 'restore', 'import', 'wipe'] as const;
export type BackupReason = (typeof BACKUP_REASONS)[number];

export interface Backup {
  id: string;
  /** When it was taken (ms since epoch). */
  at: number;
  reason: BackupReason;
  /** The profile, as a cloud payload (same encoding, same parsing). */
  data: CloudData;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const ID = /^[a-z0-9-]{1,40}$/;

export function parseBackups(raw: string | null): Backup[] {
  let data: unknown = null;
  try {
    data = JSON.parse(raw ?? 'null');
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return data
    .flatMap((entry): Backup[] => {
      if (!isRecord(entry) || typeof entry.id !== 'string' || !ID.test(entry.id) || !Number.isSafeInteger(entry.at) || !BACKUP_REASONS.includes(entry.reason as BackupReason)) return [];
      const { profile, meta } = decodeCloud(entry.data);
      return [{ id: entry.id, at: entry.at as number, reason: entry.reason as BackupReason, data: encodeCloud(profile, meta ?? { savedAt: entry.at as number }) }];
    })
    .slice(0, BACKUP_LIMIT);
}

export function readBackups(store: KeyValueStore): Backup[] {
  try {
    return parseBackups(store.get(BACKUPS_KEY));
  } catch {
    return [];
  }
}

export const backupProfile = (backup: Backup): Profile => decodeCloud(backup.data).profile;

/** Pure: the ring with one more backup in front (null when there is nothing worth keeping). */
export function ringWith(ring: readonly Backup[], profile: Profile, reason: BackupReason, now: number): Backup[] | null {
  if (isEmptyProfile(profile)) return null;
  const newest = ring[0];
  if (newest && profileText(backupProfile(newest)) === profileText(profile)) return null;
  const id = `b${now.toString(36)}-${(ring.length + 1).toString(36)}${Math.floor(Math.random() * 36 ** 3).toString(36)}`;
  return [{ id, at: now, reason, data: encodeCloud(profile, { savedAt: now }) }, ...ring].slice(0, BACKUP_LIMIT);
}

/**
 * Keeps `profile` as the newest backup and returns its id (the newest
 * backup's when it is already kept; null when empty or not stored). When the
 * store is full, older backups are dropped until it fits.
 */
export function addBackup(store: KeyValueStore, profile: Profile, reason: BackupReason, now: number): string | null {
  const ring = readBackups(store);
  const next = ringWith(ring, profile, reason, now);
  if (!next) return isEmptyProfile(profile) ? null : (ring[0]?.id ?? null);
  for (let keep = next.length; keep > 0; keep--) {
    try {
      store.set(BACKUPS_KEY, JSON.stringify(next.slice(0, keep)));
      return next[0]!.id;
    } catch {
      // Quota: try with fewer.
    }
  }
  return null;
}

export const findBackup = (store: KeyValueStore, id: string): Backup | null => readBackups(store).find((b) => b.id === id) ?? null;

export function clearBackups(store: KeyValueStore): void {
  try {
    store.set(BACKUPS_KEY, '[]');
  } catch {
    // Not persisted.
  }
}

/** The text of a "Descargar copia" file. */
export const exportText = (profile: Profile, now: number): string => JSON.stringify({ kind: EXPORT_KIND, v: 1, exportedAt: now, data: encodeCloud(profile, { savedAt: now }) });

/** Reads a "Importar copia" file: a profile export, or a bare cloud payload; null when it is neither or holds nothing. */
export function parseImport(text: string): Profile | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw)) return null;
  const data = raw.kind === EXPORT_KIND ? raw.data : raw;
  if (!isRecord(data) || typeof data.version !== 'number') return null;
  const { profile } = decodeCloud(data);
  return isEmptyProfile(profile) ? null : profile;
}
