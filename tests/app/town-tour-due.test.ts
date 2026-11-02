import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { townTourDue } from '../../src/app/adventure-route';
import { CRYPT, TUTORIAL } from '../../src/data/dungeons';
import { unlockedDungeons } from '../../src/core/dungeon-select';

/**
 * When the welcome tour plays (odd/tasks/tutorial-dungeon.md S10): the
 * first time the town opens after the Sunken Way, alone, once per device;
 * never for a player who already had the town before (a Crypt clear or
 * anything only the town gives), never in a room.
 */
const fresh = { inRoom: false, startWindow: false, seen: false, cleared: new Set([TUTORIAL.id]), traces: {} };

describe('townTourDue', () => {
  it('plays on the first solo town after a fresh tutorial clear', () => {
    expect(townTourDue(fresh)).toBe(true);
  });

  it('never again once seen on this device', () => {
    expect(townTourDue({ ...fresh, seen: true })).toBe(false);
  });

  it('never in a room, nor under a development start window', () => {
    expect(townTourDue({ ...fresh, inRoom: true })).toBe(false);
    expect(townTourDue({ ...fresh, startWindow: true })).toBe(false);
  });

  it('never before the tutorial is cleared', () => {
    expect(townTourDue({ ...fresh, cleared: new Set() })).toBe(false);
  });

  it('never for a legacy player who already had the town (a Crypt clear or town traces)', () => {
    expect(townTourDue({ ...fresh, cleared: new Set([CRYPT.id]) })).toBe(false);
    expect(townTourDue({ ...fresh, cleared: new Set([TUTORIAL.id, CRYPT.id]) })).toBe(false);
    expect(townTourDue({ ...fresh, traces: { owned: ['cubone'] } })).toBe(false);
    expect(townTourDue({ ...fresh, traces: { upgrades: { vitality: 1 } } })).toBe(false);
    expect(townTourDue({ ...fresh, traces: { learned: { mimikyu: ['shadow-sneak'] } } })).toBe(false);
    expect(townTourDue({ ...fresh, traces: { story: { cubone: 1 } } })).toBe(false);
  });

  it('a development query forces it (alone only)', () => {
    expect(townTourDue({ ...fresh, seen: true, cleared: new Set(), forced: true })).toBe(true);
    expect(townTourDue({ ...fresh, inRoom: true, forced: true })).toBe(false);
  });

  it('the waystone window it ends on lists the Crypt first for a fresh tutorial clear', () => {
    expect(unlockedDungeons(fresh.cleared)[0]!.id).toBe(CRYPT.id);
  });

  it('only the solo town hands the tour over; a room town never plays it', () => {
    const main = readFileSync(join(__dirname, '../../src/app/main.ts'), 'utf8');
    const scene = readFileSync(join(__dirname, '../../src/town/scene.ts'), 'utf8');
    const solo = main.slice(main.indexOf('function townScreen('), main.indexOf('function tutorView('));
    const room = main.slice(main.indexOf('function townLobby('));
    expect(solo).toContain('townTour,');
    expect(room.slice(0, room.indexOf('\n}\n'))).not.toContain('townTour');
    expect(scene).toContain('if (!lobby && options.townTour?.due()) beginTour();');
  });
});
