import { describe, expect, it } from 'vitest';
import { displayName, fallbackNickname, isPublicNickname, NICKNAME_MAX, sanitizeNickname } from '../../src/net/nickname';

describe('nicknames', () => {
  it('trims, collapses spaces and keeps at most 16 characters', () => {
    expect(sanitizeNickname('  Fran  ')).toBe('Fran');
    expect(sanitizeNickname('Gran   Maestro\tPokémon')).toBe('Gran Maestro Pok');
    expect([...sanitizeNickname('ñ'.repeat(40))]).toHaveLength(NICKNAME_MAX);
    // Astral characters count as one each and are never cut in half.
    expect(sanitizeNickname('👻'.repeat(20))).toBe('👻'.repeat(16));
  });

  it('removes control, format and bidi-override characters', () => {
    expect(sanitizeNickname('a\u0000b\u0007c\u001b[31m')).toBe('abc[31m');
    expect(sanitizeNickname('evil‮eman')).toBe('evileman');
    expect(sanitizeNickname('zero​width')).toBe('zerowidth');
    expect(sanitizeNickname('line\nbreak')).toBe('line break');
  });

  it('keeps markup as plain text (names are drawn on canvas or set as textContent, never parsed)', () => {
    expect(sanitizeNickname('<b>hi</b>')).toBe('<b>hi</b>');
  });

  it('reads anything that is not a string as empty', () => {
    expect(sanitizeNickname(undefined)).toBe('');
    expect(sanitizeNickname(42)).toBe('');
    expect(sanitizeNickname({ toString: () => 'x' })).toBe('');
    expect(sanitizeNickname('   ')).toBe('');
  });

  it('falls back to "<base>-XYZ" with a suffix stable for a peer id', () => {
    const a = fallbackNickname('Jugador', 'peer-a');
    expect(a).toMatch(/^Jugador-[A-Z0-9]{3}$/);
    expect(fallbackNickname('Jugador', 'peer-a')).toBe(a);
    expect(fallbackNickname('Player', 'peer-a').slice(-3)).toBe(a.slice(-3));
    expect(fallbackNickname('Jugador', 'peer-b')).not.toBe(a);
  });

  it('shows the sanitised name, or the fallback when it is empty', () => {
    expect(displayName(' Ana ', 'Jugador', 'p')).toBe('Ana');
    expect(displayName('\u0000', 'Jugador', 'p')).toBe(fallbackNickname('Jugador', 'p'));
    expect(displayName(undefined, 'Player', 'p')).toBe(fallbackNickname('Player', 'p'));
  });
});

describe('public nickname (the server profile rule)', () => {
  it('is a non-empty nickname that sanitising leaves as it is', () => {
    expect(isPublicNickname('Fran')).toBe(true);
    expect(isPublicNickname('Gran Maestro')).toBe(true);
    for (const bad of ['', '   ', ' Fran', 'Fran ', 'a  b', 'x\u200by', 'a'.repeat(NICKNAME_MAX + 1), 7]) expect(isPublicNickname(bad), String(bad)).toBe(false);
  });
});
