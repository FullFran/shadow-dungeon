import { beforeEach, describe, expect, it } from 'vitest';
import { cryptRoster, matchup, moveInfoLines, moveShape } from '../../src/app/move-info';
import { MOVES } from '../../src/data/moves';
import { setLanguage } from '../../src/i18n';

describe('move shape', () => {
  it('names the hit shape of each move', () => {
    expect(moveShape(MOVES['night-daze'])).toEqual({ shape: 'ring' });
    expect(moveShape(MOVES['stomping-tantrum'])).toEqual({ shape: 'ring' });
    expect(moveShape(MOVES['shadow-claw'])).toEqual({ shape: 'arc-short' });
    expect(moveShape(MOVES['play-rough'])).toEqual({ shape: 'arc-wide' });
    expect(moveShape(MOVES['fury-swipes'])).toEqual({ shape: 'arc-short', hits: 5 });
    expect(moveShape(MOVES['bone-rush'])).toEqual({ shape: 'dash', hits: 3 });
    expect(moveShape(MOVES.ember)).toEqual({ shape: 'projectile-fast' });
    expect(moveShape(MOVES.inferno)).toEqual({ shape: 'projectile-slow' });
    expect(moveShape(MOVES.bonemerang)).toEqual({ shape: 'boomerang' });
  });
});

describe('matchup against the Crypt', () => {
  it('lists the Crypt enemies, boss included', () => {
    expect(cryptRoster()).toEqual(['poochyena', 'gastly', 'aegislash']);
  });

  it('splits the roster into effective and not very effective targets', () => {
    expect(matchup('normal')).toEqual({ strong: [], weak: ['gastly', 'aegislash'] });
    expect(matchup('dark')).toEqual({ strong: ['gastly', 'aegislash'], weak: ['poochyena'] });
    expect(matchup('fire')).toEqual({ strong: ['aegislash'], weak: [] });
    expect(matchup('ground')).toEqual({ strong: ['gastly', 'aegislash'], weak: [] });
  });
});

describe('move card lines', () => {
  beforeEach(() => setLanguage('es'));

  it('shows the stamina cost, the shape and the matchup', () => {
    const [stats, hint] = moveInfoLines('fury-swipes');
    expect(stats).toContain('Sin coste');
    expect(stats).toContain('arco corto');
    expect(stats).toContain('×5');
    expect(hint).toContain('Poco eficaz contra Gastly, Aegislash');
    const [heavy] = moveInfoLines('night-daze');
    expect(heavy).toContain('Estamina 30');
    expect(heavy).toContain('anillo 360°');
  });

  it('names only the side that applies', () => {
    expect(moveInfoLines('ember')[1]).toBe('Eficaz contra Aegislash');
  });

  it('speaks English too', () => {
    setLanguage('en');
    expect(moveInfoLines('fury-swipes')[0]).toContain('short arc');
    expect(moveInfoLines('fury-swipes')[1]).toBe('Not very effective against Gastly, Aegislash');
  });
});
