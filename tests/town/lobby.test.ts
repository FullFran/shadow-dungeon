import { describe, expect, it } from 'vitest';
import { canTravel, entranceAction, enterRows, PRESENCE_MS, presenceDue } from '../../src/town/lobby';

describe('town lobby rules', () => {
  it('sends presence about ten times a second', () => {
    expect(PRESENCE_MS).toBe(100);
    expect(presenceDue(null, 0)).toBe(true);
    expect(presenceDue(1000, 1099)).toBe(false);
    expect(presenceDue(1000, 1100)).toBe(true);
  });

  it('lets the host (or a solo player) take an open dungeon, and tells a guest only the host can', () => {
    expect(entranceAction('open', null)).toBe('enter');
    expect(entranceAction('open', { isHost: true })).toBe('enter');
    expect(entranceAction('open', { isHost: false })).toBe('host-only');
  });

  it('keeps sealed and missing dungeons shut for everyone', () => {
    expect(entranceAction('locked', { isHost: true })).toBe('locked');
    expect(entranceAction('missing', { isHost: false })).toBe('missing');
  });

  it('opens the waystone quick travel to the host and solo players only', () => {
    expect(canTravel(null)).toBe(true);
    expect(canTravel({ isHost: true })).toBe(true);
    expect(canTravel({ isHost: false })).toBe(false);
  });

  it("gives the host one Enter row per variant (the Sima's daily or free run), everyone else the plain one", () => {
    const departed: [string, string | undefined][] = [];
    const depart = (dungeon: string, variant?: string) => void departed.push([dungeon, variant]);
    const variants = (dungeon: string) => (dungeon === 'eclipse-chasm' ? [{ label: 'Reto diario', value: 'daily' }, { label: 'Libre', value: 'free' }] : null);
    const host = enterRows('eclipse-chasm', 'Entrar', { isHost: true, variants }, depart);
    expect(host.map((r) => r.label)).toEqual(['Entrar · Reto diario', 'Entrar · Libre']);
    host[1]!.onConfirm();
    expect(departed).toEqual([['eclipse-chasm', 'free']]);
    // No choice to make: one row, no variant.
    const crypt = enterRows('crypt-of-the-sword-king', 'Entrar', { isHost: true, variants }, depart);
    expect(crypt.map((r) => r.label)).toEqual(['Entrar']);
    crypt[0]!.onConfirm();
    expect(departed.at(-1)).toEqual(['crypt-of-the-sword-king', undefined]);
    // Solo (no lobby) and a guest never get the host's rows.
    expect(enterRows('eclipse-chasm', 'Entrar', null, depart).map((r) => r.label)).toEqual(['Entrar']);
    expect(enterRows('eclipse-chasm', 'Entrar', { isHost: false, variants }, depart).map((r) => r.label)).toEqual(['Entrar']);
  });
});
