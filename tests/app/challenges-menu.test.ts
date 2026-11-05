import { describe, expect, it } from 'vitest';
import { victoryLine } from '../../src/app/after-run';
import { challengeCard, challengeRows, chapterStates, hookText, rowEnabled, rowHint } from '../../src/app/challenges';
import { CHALLENGES, CRYPT } from '../../src/data/dungeons';
import { STARTER_SPECIES } from '../../src/data/species';
import { setLanguage, t } from '../../src/i18n';

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

describe('challenge cards', () => {
  const rowOf = (owned: string[], species: string, line: string) => challengeRows({ owned: owned as never }, species as never).find((r) => r.dungeon.challenge!.line === line)!;

  it('counts the chapters closed, 0 to 3', () => {
    const row = rowOf([], 'mimikyu', 'mimikyu');
    expect(challengeCard(row, false, undefined).closed).toBe(0);
    expect(challengeCard(row, false, { mimikyu: 2 }).closed).toBe(2);
    expect(challengeCard(row, false, { mimikyu: 3 }).closed).toBe(3);
  });

  it('locks a line the player lacks, with its reason; enterable otherwise', () => {
    setLanguage('es');
    const piplup = challengeCard(rowOf(['kadabra'], 'mimikyu', 'piplup'), false, undefined);
    expect(piplup).toMatchObject({ enabled: false, reason: 'Aún no tienes esta línea.' });
    expect(challengeCard(rowOf([], 'mimikyu', 'mimikyu'), true, undefined)).toMatchObject({ enabled: true, reason: null });
  });

  it('locks a line the picked species does not play only once the species is final, naming the form', () => {
    setLanguage('es');
    const abra = rowOf(['kadabra'], 'mimikyu', 'abra');
    expect(challengeCard(abra, true, undefined)).toMatchObject({ enabled: false, reason: 'Solo con una forma de su línea: Kadabra.' });
    expect(challengeCard(abra, false, undefined)).toMatchObject({ enabled: true, reason: null });
  });

  it('lists the three chapters as closed, open (the next one) or shut', () => {
    expect(chapterStates(undefined)).toEqual([{ chapter: 1, difficulty: 'normal', state: 'open' }, { chapter: 2, difficulty: 'hard', state: 'shut' }, { chapter: 3, difficulty: 'nightmare', state: 'shut' }]);
    expect(chapterStates(1).map((c) => c.state)).toEqual(['closed', 'open', 'shut']);
    expect(chapterStates(3).map((c) => c.state)).toEqual(['closed', 'closed', 'closed']);
  });
});

describe('the story hook', () => {
  it('is short for every Senda in both languages: at most 120 characters, whole sentence or an ellipsis', () => {
    for (const lang of ['es', 'en'] as const) {
      setLanguage(lang);
      for (const d of CHALLENGES) {
        const hook = hookText(d);
        expect(hook.length, `${lang} ${d.id}`).toBeGreaterThan(10);
        expect(hook.length, `${lang} ${d.id}`).toBeLessThanOrEqual(120);
        expect(/[.!?…]$/.test(hook), `${lang} ${d.id}: ${hook}`).toBe(true);
        expect(t(d.lore.loreKeys[0]!).startsWith(hook.replace(/…$/, '').trimEnd())).toBe(true);
      }
    }
  });
});
