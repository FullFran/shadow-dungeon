import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toastGate, type ShowToast } from '../../src/app/achievements';

/**
 * Achievement toasts never sit over a cinematic: while one plays (the
 * prologue, the cinematics after a run) toasts wait, and a toast already up
 * is taken down and shown again after. They come out with the results.
 */
function fakeToast(log: string[], name: string): ShowToast {
  return (closed) => {
    log.push(`show ${name}`);
    let gone = false;
    return () => {
      if (gone) return;
      gone = true;
      log.push(`hide ${name}`);
      closed();
    };
  };
}

describe('the achievement toast gate', () => {
  it('shows at once when nothing holds it', () => {
    const log: string[] = [];
    const gate = toastGate();
    gate.show(fakeToast(log, 'a'));
    expect(log).toEqual(['show a']);
  });

  it('queues while held and shows everything, in order, once the last hold is released', () => {
    const log: string[] = [];
    const gate = toastGate();
    gate.hold();
    gate.hold();
    gate.show(fakeToast(log, 'a'));
    gate.show(fakeToast(log, 'b'));
    gate.release();
    expect(log).toEqual([]);
    gate.release();
    expect(log).toEqual(['show a', 'show b']);
    // An extra release never goes negative: the next hold still holds.
    gate.release();
    gate.hold();
    gate.show(fakeToast(log, 'c'));
    expect(log).toEqual(['show a', 'show b', 'hide a', 'hide b']);
  });

  it('a toast already up when a hold starts is taken down and shown again after', () => {
    const log: string[] = [];
    const gate = toastGate();
    gate.show(fakeToast(log, 'boot'));
    gate.hold();
    expect(log).toEqual(['show boot', 'hide boot']);
    gate.release();
    expect(log).toEqual(['show boot', 'hide boot', 'show boot']);
  });

  it('a toast that closed by itself is not shown again', () => {
    const log: string[] = [];
    const gate = toastGate();
    let close: () => void = () => undefined;
    gate.show((closed) => {
      log.push('show a');
      close = () => {
        log.push('hide a');
        closed();
      };
      return close;
    });
    close();
    gate.hold();
    gate.release();
    expect(log).toEqual(['show a', 'hide a']);
  });

  it('the prologue and the end of a run hold the toasts; the results release them', () => {
    const main = readFileSync(join(__dirname, '../../src/app/main.ts'), 'utf8');
    const prologue = main.slice(main.indexOf('function prologue('), main.indexOf('function guardianCinematic('));
    expect(prologue).toContain('holdToasts();');
    expect(prologue).toContain('onClose: releaseToasts,');
    const end = main.slice(main.indexOf('onEnd: (result, summary) => {'), main.indexOf('/** Where the town opens'));
    expect(end.indexOf('holdToasts();')).toBeGreaterThan(-1);
    expect(end.indexOf('holdToasts();')).toBeLessThan(end.indexOf('achievementToast(progress.unlocked);'));
    expect(end).toMatch(/const results = \(\) => \{\s*resultScreen\([^;]*;\s*releaseToasts\(\);/);
  });
});
