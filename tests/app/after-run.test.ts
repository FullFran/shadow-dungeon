import { describe, expect, it } from 'vitest';
import { endActions, materialsEarned, returnPlace, townOf } from '../../src/app/after-run';
import { dungeonById } from '../../src/data/dungeons';
import { setLanguage, t } from '../../src/i18n';

describe('after a run', () => {
  it('a solo or local run offers a retry, then the way back to the town', () => {
    expect(endActions({ online: false })).toEqual(['retry', 'town']);
  });

  it('an online run (host or guest) only goes back to the town', () => {
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

  it("a room's run brings everyone back to the room's town; any other run comes back to the hub", () => {
    expect(townOf({ inRoom: true })).toBe('room');
    expect(townOf({ inRoom: false })).toBe('hub');
  });
});

describe('materials on the end screen', () => {
  const challenge = dungeonById('challenge-abra');
  const before = { materials: { abra: { normal: 2 } } };
  const after = { materials: { abra: { normal: 5 } } };

  it('names what a challenge clear paid: count, line and tier', () => {
    setLanguage('es');
    expect(materialsEarned(challenge, 'normal', before, after, t)).toBe('+3 Esencias de Abra (Normal)');
    setLanguage('en');
    expect(materialsEarned(challenge, 'normal', before, after, t)).toBe('+3 Abra Essence (Normal)');
  });

  it('says nothing when nothing was paid (Easy, a defeat, a peer without the line, a main dungeon)', () => {
    expect(materialsEarned(challenge, 'easy', before, before, t)).toBeNull();
    expect(materialsEarned(challenge, 'hard', before, before, t)).toBeNull();
    expect(materialsEarned(dungeonById('crypt'), 'normal', before, after, t)).toBeNull();
  });
});
