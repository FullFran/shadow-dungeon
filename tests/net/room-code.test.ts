import { describe, expect, it } from 'vitest';
import { generateRoomCode, normalizeRoomCode, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, roomCodeFromSearch } from '../../src/net/room-code';

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('room codes', () => {
  it('are short and leave out characters that read alike (0/O, 1/I/L)', () => {
    expect(ROOM_CODE_LENGTH).toBe(5);
    for (const ambiguous of ['0', 'O', '1', 'I', 'L']) expect(ROOM_CODE_ALPHABET).not.toContain(ambiguous);
    const random = seeded(3);
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode(random);
      expect(code).toHaveLength(5);
      for (const ch of code) expect(ROOM_CODE_ALPHABET).toContain(ch);
    }
  });

  it('use both ends of the alphabet', () => {
    const first = ROOM_CODE_ALPHABET[0]!;
    const last = ROOM_CODE_ALPHABET.at(-1)!;
    expect(generateRoomCode(() => 0)).toBe(first.repeat(5));
    expect(generateRoomCode(() => 0.999999)).toBe(last.repeat(5));
  });

  it('accept typed codes in any case, with spaces or dashes, and reject anything else', () => {
    expect(normalizeRoomCode(' ab-c de ')).toBe('ABCDE');
    expect(normalizeRoomCode('abcd')).toBeNull();
    expect(normalizeRoomCode('abcdef')).toBeNull();
    expect(normalizeRoomCode('AB0DE')).toBeNull();
    expect(normalizeRoomCode('')).toBeNull();
  });

  it('come prefilled from ?room= in the page address', () => {
    expect(roomCodeFromSearch('?room=xk7pq')).toBe('XK7PQ');
    expect(roomCodeFromSearch('?seed=3&room=bad')).toBeNull();
    expect(roomCodeFromSearch('')).toBeNull();
  });
});
