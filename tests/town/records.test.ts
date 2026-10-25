import { describe, expect, it } from 'vitest';
import { parseRecords, RECORDS_KEY } from '../../src/town/records';

describe('notice board records', () => {
  it('reads best floor and runs', () => {
    expect(parseRecords('{"bestFloor":4,"runs":12}')).toEqual({ bestFloor: 4, runs: 12 });
  });

  it('treats missing, broken or hostile values as unknown', () => {
    expect(parseRecords(null)).toEqual({ bestFloor: null, runs: null });
    expect(parseRecords('not json')).toEqual({ bestFloor: null, runs: null });
    expect(parseRecords('[1,2]')).toEqual({ bestFloor: null, runs: null });
    expect(parseRecords('{"bestFloor":"<b>9</b>","runs":-3}')).toEqual({ bestFloor: null, runs: null });
    expect(parseRecords('{"bestFloor":2.5,"runs":1e309}')).toEqual({ bestFloor: null, runs: null });
  });

  it('uses the game storage namespace', () => {
    expect(RECORDS_KEY.startsWith('mazmorra-sombria.')).toBe(true);
  });
});
