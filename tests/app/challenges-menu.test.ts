import { describe, expect, it } from 'vitest';
import { victoryLine } from '../../src/app/after-run';
import { challengeRows, rowEnabled, rowHint } from '../../src/app/challenges';
import { CHALLENGES, CRYPT } from '../../src/data/dungeons';
import { STARTER_SPECIES } from '../../src/data/species';
import { setLanguage } from '../../src/i18n';

/** The challenges menu (odd/tasks/roster-parity.md): one list for every line's trial, three entry points. */
describe('challenges menu rows', () => {
  it('lists every challenge in order, with the form the player has, whether it is open and whether the species fits', () => {
    const rows = challengeRows({ owned: ['kadabra', 'zoroark'] }, 'zoroark');
    expect(rows.map((r) => r.dungeon)).toEqual(CHALLENGES);
    const by = (line: string) => rows.find((r) => r.dungeon.challenge!.line === line)!;
    expect(by('abra')).toMatchObject({ form: 'kadabra', open: true, fits: false });
    expect(by('piplup')).toMatchObject({ form: 'piplup', open: false, fits: false });
    expect(by('zorua')).toMatchObject({ form: 'zoroark', open: true, fits: true });
    // The starters' trials are always open.
    for (const s of STARTER_SPECIES) expect(by(s).open, s).toBe(true);
  });

  it('greys out a line the player lacks, and (once the species is final) a line it does not play', () => {
    const rows = challengeRows({ owned: ['kadabra'] }, 'mimikyu');
    const abra = rows.find((r) => r.dungeon.challenge!.line === 'abra')!;
    const mimikyu = rows.find((r) => r.dungeon.challenge!.line === 'mimikyu')!;
    const piplup = rows.find((r) => r.dungeon.challenge!.line === 'piplup')!;
    expect([rowEnabled(abra, false), rowEnabled(abra, true)]).toEqual([true, false]);
    expect([rowEnabled(mimikyu, false), rowEnabled(mimikyu, true)]).toEqual([true, true]);
    expect([rowEnabled(piplup, false), rowEnabled(piplup, true)]).toEqual([false, false]);
    setLanguage('es');
    expect(rowHint(abra)).toBe('Juega con Kadabra.');
    expect(rowHint(mimikyu)).toBe('Puedes entrar con tu Pokémon.');
    expect(rowHint(piplup)).toBe('Aún no tienes esta línea.');
  });
});

describe('a challenge victory', () => {
  it('closes with its trial\'s own line; other ends and dungeons have none', () => {
    for (const d of CHALLENGES) expect(victoryLine(d, 'victory')).toBe(`challenge.${d.challenge!.line}.victory`);
    expect(victoryLine(CHALLENGES[0]!, 'defeat')).toBeNull();
    expect(victoryLine(CRYPT, 'victory')).toBeNull();
  });
});
