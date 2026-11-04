import { describe, expect, it } from 'vitest';
import { partnerPlate } from '../../src/app/partner-plate';
import { SPECIES } from '../../src/data/species';

/** The partner's nameplate on the hub altar (owner, 2026-11-04). */
describe('partner plate model', () => {
  it('carries the name key, the types and one passive line', () => {
    const p = partnerPlate('haxorus', null);
    expect(p.nameKey).toBe('species.haxorus');
    expect(p.types).toEqual(SPECIES.haxorus.types);
    expect(p.passiveKey).toBe(SPECIES.haxorus.passive ? `passive.${SPECIES.haxorus.passive}` : null);
    expect(p.bond).toBeNull();
  });

  it('shows the bond level only when a Senda chapter is closed', () => {
    expect(partnerPlate('mimikyu', 0).bond).toBeNull();
    expect(partnerPlate('mimikyu', 2).bond).toBe(2);
  });
});
