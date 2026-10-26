import { describe, expect, it } from 'vitest';
import { CHALLENGES } from '../../src/data/dungeons';
import { ROOMS } from '../../src/data/rooms';
import { proveWounds, WOUNDS } from './wound-prove';

/** Every Senda's wound is in a shard (tests/sim/wound-prove.ts); this one proves the pilot's and the starters'. */
const GACHA = ['abra', 'piplup', 'shinx', 'axew'] as const;

describe('the wounds are listed', () => {
  it('every Senda with a wound is listed (Mimikyu and the gacha lines at least), in its arena', () => {
    expect(WOUNDS.map((w) => w.species)).toEqual(expect.arrayContaining(['mimikyu-wound', 'abra-wound', 'piplup-wound', 'shinx-wound', 'axew-wound']));
    for (const w of WOUNDS) expect(ROOMS[w.room].spawns[0]!.species).toBe(w.species);
    expect(WOUNDS.length).toBeLessThanOrEqual(CHALLENGES.length);
  });
});

proveWounds(WOUNDS.map((w) => w.line).filter((line) => !(GACHA as readonly string[]).includes(line)));
