import { describe, expect, it } from 'vitest';
import { advanceDialog, DIALOG_CPS, openDialog, shownText, tickDialog } from '../../src/town/dialog';
import { wrapText } from '../../src/town/render';

const msPerChar = 1000 / DIALOG_CPS;

describe('dialog typewriter', () => {
  it('starts empty and reveals one character per 1/CPS seconds', () => {
    const d = openDialog(['Hola', 'Adiós']);
    expect(shownText(d)).toBe('');
    expect(shownText(tickDialog(d, msPerChar * 2))).toBe('Ho');
    expect(shownText(tickDialog(d, msPerChar * 2 - 0.01))).toBe('H');
  });

  it('never reveals past the end of the line', () => {
    expect(shownText(tickDialog(openDialog(['Hola']), 10_000))).toBe('Hola');
  });

  it('is time-split independent', () => {
    let d = openDialog(['Una línea algo más larga']);
    for (let i = 0; i < 10; i++) d = tickDialog(d, 16);
    expect(shownText(d)).toBe(shownText(tickDialog(openDialog(['Una línea algo más larga']), 160)));
  });

  it('first confirm finishes the line, the next one moves on, the last one closes', () => {
    const d = openDialog(['Hola', 'Adiós']);
    const finished = advanceDialog(d)!;
    expect(shownText(finished)).toBe('Hola');
    const second = advanceDialog(finished)!;
    expect(second.index).toBe(1);
    expect(shownText(second)).toBe('');
    expect(advanceDialog(tickDialog(second, 10_000))).toBeNull();
  });
});

describe('dialog box wrapping', () => {
  const measure = (s: string) => s.length * 5;

  it('breaks between words to fit the width', () => {
    expect(wrapText('uno dos tres cuatro', 40, measure)).toEqual(['uno dos', 'tres', 'cuatro']);
  });

  it('keeps a word longer than the width on its own line', () => {
    expect(wrapText('a supercalifragilistico b', 30, measure)).toEqual(['a', 'supercalifragilistico', 'b']);
  });
});
