import { describe, expect, it } from 'vitest';
import { SPRITES } from '../../src/data/sprites';
import { BACKDROP_CAST } from '../../src/ui/eclipse';

/** The Pokémon living in the menu backdrop (odd/tasks/title-hub.md T5): every one must have its idle sheet. */
describe('eclipse backdrop cast', () => {
  it('has a few Pokémon, each with an idle animation and a place on the canvas', () => {
    expect(BACKDROP_CAST.length).toBeGreaterThanOrEqual(4);
    for (const member of BACKDROP_CAST) {
      expect(SPRITES.sprites[member.sprite]?.anims.Idle, member.sprite).toBeDefined();
      expect(member.x, member.sprite).toBeGreaterThan(0);
      expect(member.x, member.sprite).toBeLessThan(1);
      expect(member.y, member.sprite).toBeGreaterThan(0);
      expect(member.y, member.sprite).toBeLessThan(1);
    }
  });
});
