/**
 * Player nicknames: typed in Settings or the online screen, sent in the
 * hello and drawn over every player. A nickname is untrusted text from any
 * peer: it is trimmed, whitespace runs become one space, control, format
 * (zero-width, bidi overrides) and unassigned/private characters go, and it
 * keeps at most NICKNAME_MAX characters. It is only ever drawn on a canvas
 * or set as textContent, so markup stays plain text. Empty means "use the
 * fallback": the localised word for player plus a short suffix from the
 * peer id, stable for that peer.
 */
export const NICKNAME_MAX = 16;

export function sanitizeNickname(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const clean = raw
    .slice(0, 256)
    .replace(/\s+/gu, ' ')
    .replace(/[\p{Cc}\p{Cf}\p{Cn}\p{Co}\p{Cs}]/gu, '')
    .trim();
  return [...clean].slice(0, NICKNAME_MAX).join('').trim();
}

const SUFFIX = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** "<base>-XYZ": three characters hashed from the peer id. */
export function fallbackNickname(base: string, peer: string): string {
  let h = 2166136261;
  for (const ch of peer) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  let suffix = '';
  for (let i = 0; i < 3; i++) {
    suffix += SUFFIX[h % SUFFIX.length];
    h = Math.floor(h / SUFFIX.length);
  }
  return `${base}-${suffix}`;
}

export const displayName = (name: unknown, base: string, peer: string): string => sanitizeNickname(name) || fallbackNickname(base, peer);
