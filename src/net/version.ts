import { DUNGEONS, CHALLENGES } from '../data/dungeons';
import { ITEMS } from '../data/items';
import { MOVES } from '../data/moves';
import { ROOMS } from '../data/rooms';
import { SPECIES } from '../data/species';

/**
 * What two peers must share to play together: the wire protocol's version
 * (bumped by hand on any incompatible change) and a hash of the content ids
 * that travel on the wire (species, moves, items, dungeons, rooms). A peer
 * of another deploy that added a species or a dungeon hashes differently,
 * so the host turns it away instead of desyncing (docs/gdd.md §12).
 */
export const PROTOCOL_VERSION = 3;

/** FNV-1a (32-bit) of `text`, as 8 hex digits. */
export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return hash.toString(16).padStart(8, '0');
}

const ids = (record: object): string => Object.keys(record).sort().join(',');

/** The hash of this build's wire content ids (stable within one deploy). */
export const CONTENT_HASH = fnv1a([ids(SPECIES), ids(MOVES), ids(ITEMS), ids(ROOMS), [...DUNGEONS, ...CHALLENGES].map((d) => d.id).sort().join(',')].join('|'));

/** True when a peer's announced version and content hash are this build's (absent: an older peer). */
export const sameVersion = (v: unknown, c: unknown): boolean => v === PROTOCOL_VERSION && c === CONTENT_HASH;
