import { afterEach, describe, expect, it } from 'vitest';
import { CHALLENGES } from '../../src/data/dungeons';
import { ROOMS } from '../../src/data/rooms';
import { proveWounds, WOUNDS } from './wound-prove';

// Back-to-back synchronous proofs never let the worker read its RPC replies ("Timeout calling onTaskUpdate" once a file runs past 60 s): yield a macrotask after each.
afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

/** Every Senda's wound (tests/sim/wound-prove.ts), each tier proven at the end of the road it walks. */
describe('the wounds are listed', () => {
  it('every Senda with a wound is listed (Mimikyu and the starters at least), in its arena', () => {
    expect(WOUNDS.map((w) => w.species)).toEqual(expect.arrayContaining(['mimikyu-wound', 'cubone-wound', 'litwick-wound', 'zorua-wound']));
    for (const w of WOUNDS) expect(ROOMS[w.room].spawns[0]!.species).toBe(w.species);
    expect(WOUNDS.length).toBeLessThanOrEqual(CHALLENGES.length);
  });
});

proveWounds(WOUNDS.map((w) => w.line));
