import { describe, expect, it } from 'vitest';
import { buildHint, rankedName, stepFilter, tutorRows } from '../../src/app/tutor';
import { MOVES } from '../../src/data/moves';
import { originalKit } from '../../src/data/species';
import { SPRITE_KEYS, SPRITES } from '../../src/data/sprites';
import { TUTOR_OFFER } from '../../src/data/tutor';
import { REFUGIO } from '../../src/data/world';
import { setLanguage } from '../../src/i18n';

describe('move tutor window rows', () => {
  setLanguage('es');

  it('lists the moves on sale, then the Mejoras of the original kit', () => {
    const rows = tutorRows({ coins: 0 }, 'zorua');
    expect(rows.filter((r) => r.kind === 'move').map((r) => r.move)).toEqual([...TUTOR_OFFER.zorua]);
    expect(rows.filter((r) => r.kind === 'rank').map((r) => r.move)).toEqual(originalKit('zorua'));
    expect(rows.every((r) => !r.affordable)).toBe(true);
  });

  it('the slot filter keeps one slot kind and wraps around', () => {
    const rows = tutorRows({ coins: 0 }, 'cubone', 'boost');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => MOVES[r.move].slot === 'boost')).toBe(true);
    expect(stepFilter('all', -1)).toBe('area');
    expect(stepFilter('area', 1)).toBe('all');
  });

  it('a learned move has no price; a ranked one shows its "+"', () => {
    const rows = tutorRows({ coins: 9999, learned: { cubone: ['knock-off'] }, ranks: { cubone: { 'bone-club': 2 } } }, 'cubone');
    expect(rows.find((r) => r.move === 'knock-off')!.cost).toBeNull();
    expect(rows.find((r) => r.kind === 'rank' && r.move === 'bone-club')!.cost).toBeNull();
    expect(rankedName('bone-club', 2)).toBe('Hueso Palo ++');
  });

  it('shows the recommended build in Spanish move names', () => {
    expect(buildHint('mimikyu')).toBe('Recomendado (competitivo): Sombra Vil · Carantoña · Danza Espada · Golpe Fantasma');
  });
});

describe('Smeargle in the Refugio', () => {
  it('stands in the hub with its own sheets and opens the tutor', () => {
    const tutor = REFUGIO.npcs.find((n) => n.role === 'tutor');
    expect(tutor?.species).toBe('smeargle');
    expect(tutor?.opens).toBe('tutor');
    expect(SPRITES.sprites[SPRITE_KEYS.smeargle]?.anims.Idle).toBeDefined();
  });

  it('stays clear of the altar, the signal pillar and the other NPCs', () => {
    const tutor = REFUGIO.npcs.find((n) => n.role === 'tutor')!;
    const points = [REFUGIO.shrine, REFUGIO.beacon, REFUGIO.waystone, REFUGIO.board, ...REFUGIO.npcs.filter((n) => n !== tutor)].filter((p) => p !== undefined);
    for (const p of points) expect(Math.hypot(p!.x - tutor.x, p!.y - tutor.y)).toBeGreaterThan(3);
    for (const prop of REFUGIO.props) expect(prop.x === tutor.x && prop.y === tutor.y).toBe(false);
  });
});
