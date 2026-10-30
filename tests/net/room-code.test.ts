import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
    expect(normalizeRoomCode(' ac-d ef ')).toBe('ACDEF');
    expect(normalizeRoomCode('acde')).toBeNull();
    expect(normalizeRoomCode('acdefh')).toBeNull();
    expect(normalizeRoomCode('AC0EF')).toBeNull();
    expect(normalizeRoomCode('')).toBeNull();
  });

  it('come prefilled from ?room= in the page address', () => {
    expect(roomCodeFromSearch('?room=xk7pa')).toBe('XK7PA');
    expect(roomCodeFromSearch('?seed=3&room=bad')).toBeNull();
    expect(roomCodeFromSearch('')).toBeNull();
  });
});

describe('codes read in the game font', () => {
  // Pixelify Sans draws these almost alike (checked on screen, 2026-10-30): a code must never need telling them apart.
  it('leaves out the characters that look alike', () => {
    for (const lookalike of ['Z', '2', 'S', '5', 'B', '8', 'G', '6', 'Q', 'V']) expect(ROOM_CODE_ALPHABET).not.toContain(lookalike);
  });
  it('a code with a lookalike character is refused, so a wrong read never joins another room', () => {
    expect(normalizeRoomCode('ACZEF')).toBeNull();
    expect(normalizeRoomCode('AC2EF')).toBeNull();
  });
  it('still gives plenty of codes for rooms on public relays', () => {
    expect(ROOM_CODE_ALPHABET.length ** ROOM_CODE_LENGTH).toBeGreaterThan(3_000_000);
  });
  it('every code is shown in the readable font, wherever a player reads or types one', () => {
    const read = (path: string) => readFileSync(join(__dirname, '../..', path), 'utf8');
    expect(read('index.html')).toMatch(/\.room-code, \.town-room-code, \.report-ref, \.tickets-ref, \.code-input \{ font-family: var\(--md-code-font\)/);
    expect(read('src/town/scene.ts')).toContain("className: 'town-room-code'");
    expect(read('src/app/main.ts')).toMatch(/code\.className = [^;]*code-input|className: '[^']*code-input/);
  });
});
