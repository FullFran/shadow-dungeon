/**
 * Room codes for online play (docs/gdd.md §12): short enough to read out on
 * stream or type from a friend's message. The alphabet leaves out characters
 * that read alike (0/O, 1/I/L) and those the game font draws alike (Z/2, S/5,
 * B/8, G/6, Q/9, U/V), so a code read aloud or off the screen is typed right.
 */
export const ROOM_CODE_ALPHABET = 'ACDEFHJKMNPRTUWXY3479';
export const ROOM_CODE_LENGTH = 5;

/** A fresh code; `random` is uniform in [0, 1). */
export function generateRoomCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const index = Math.min(ROOM_CODE_ALPHABET.length - 1, Math.floor(random() * ROOM_CODE_ALPHABET.length));
    code += ROOM_CODE_ALPHABET[index];
  }
  return code;
}

/** A typed code in canonical form (upper case, no spaces or dashes), or null if it is not a valid code. */
export function normalizeRoomCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  if (code.length !== ROOM_CODE_LENGTH) return null;
  for (const ch of code) if (!ROOM_CODE_ALPHABET.includes(ch)) return null;
  return code;
}

/** `?room=CODE` in the page address, to prefill "Join". */
export function roomCodeFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get('room');
  return value === null ? null : normalizeRoomCode(value);
}
