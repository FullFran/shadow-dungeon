import { describe, expect, it } from 'vitest';
import { endActions, returnPlace } from '../../src/app/after-run';

describe('after a run', () => {
  it('a solo or local run offers a retry, then the way back to the town', () => {
    expect(endActions({ online: false })).toEqual(['retry', 'town']);
  });

  it('an online run (host or guest) only goes back to the town: the room is gone', () => {
    expect(endActions({ online: true })).toEqual(['town']);
  });

  it('a finished run, a quit from the menu and a host leaving mid-run all lead to the town', () => {
    expect(returnPlace('end')).toBe('town');
    expect(returnPlace('quit')).toBe('town');
    expect(returnPlace('hostLeft')).toBe('town');
  });

  it('leaving a lobby before any run still goes back to the title', () => {
    expect(returnPlace('lobby')).toBe('title');
  });
});
