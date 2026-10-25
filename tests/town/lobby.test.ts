import { describe, expect, it } from 'vitest';
import { canTravel, entranceAction, PRESENCE_MS, presenceDue } from '../../src/town/lobby';

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
});
