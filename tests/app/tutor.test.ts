import { describe, expect, it } from 'vitest';
import { buildHint, rankEffectText, rankedName, rankStars, stepFilter, tierName, tutorRows } from '../../src/app/tutor';
import { RANK_EFFECTS } from '../../src/data/rank-effects';
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

  it('every known move has a Mejora row; a learned tutor move joins the kit there', () => {
    const rows = tutorRows({ coins: 0, learned: { zorua: ['knock-off'] } }, 'zorua');
    expect(rows.filter((r) => r.kind === 'rank').map((r) => r.move)).toEqual([...originalKit('zorua'), 'knock-off']);
  });

  it('a move row shows its tier badge, its locked dungeon and both rank effects; a Mejora row previews the next rank', () => {
    const rows = tutorRows({ coins: 9999 }, 'mimikyu');
    const thunder = rows.find((r) => r.kind === 'move' && r.move === 'thunder')!;
    expect(thunder.tier).toBe('master');
    expect(tierName('master')).toBe('Maestro');
    expect(thunder.locked).toBe('Bosque Brumoso');
    expect(thunder.affordable).toBe(false);
    expect(thunder.effect).toContain('+1:');
    expect(thunder.effect).toContain('+2:');
    const open = tutorRows({ coins: 9999, cleared: ['misty-forest'] }, 'mimikyu').find((r) => r.kind === 'move' && r.move === 'thunder')!;
    expect(open.locked).toBeNull();
    expect(open.affordable).toBe(true);
    const claw = rows.find((r) => r.kind === 'rank' && r.move === 'shadow-claw')!;
    expect(claw.effect).toContain(rankEffectText(RANK_EFFECTS['shadow-claw'][0]));
    expect(claw.effect.startsWith('Siguiente')).toBe(true);
    expect(rankEffectText(RANK_EFFECTS['shadow-claw'][1])).toBe('deja una marca que estalla a los 1,2 s (35 % del golpe)');
  });

  it('every rank effect of every move has a text in both languages', () => {
    for (const lang of ['es', 'en'] as const) {
      setLanguage(lang);
      for (const [id, ranks] of Object.entries(RANK_EFFECTS)) for (const e of ranks) expect(rankEffectText(e), `${lang} ${id}`).not.toMatch(/\{|rank\.|undefined|NaN/);
    }
    setLanguage('es');
  });

  it('rank stars: filled per rank, empty for the rest', () => {
    expect(rankStars(0)).toBe('☆☆');
    expect(rankStars(1)).toBe('★☆');
    expect(rankStars(2)).toBe('★★');
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
