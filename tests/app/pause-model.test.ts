import { describe, expect, it } from 'vitest';
import type { HeldItem } from '../../src/adapters/hud';
import { CHALLENGES, DUNGEONS } from '../../src/data/dungeons';
import { DIFFICULTIES } from '../../src/data/difficulty';
import { PLAYER_SLOT_LAYOUT } from '../../src/data/slots';
import { PLAYABLE_SPECIES } from '../../src/data/species';
import { catalog, LANGUAGES } from '../../src/i18n';
import { pauseEntries, type MenuActions, type PauseEntry } from '../../src/app/menu';
import { formatRunTime, pauseActions, pauseSummary, type PauseRunInfo } from '../../src/app/pause-model';
import { PAUSE_ICONS } from '../../src/ui/icons/pause-icons';

const noop = () => undefined;
const base: MenuActions = { resume: noop, restart: noop, quit: noop };
const full: MenuActions = { ...base, openReport: () => ({ element: {} as HTMLElement, dispose: noop }), copyReport: noop };
/** The rows of the list menu that came before the relic redesign (src/app/menu.ts before 2026-11-04), in order: nothing may be lost. */
const BEFORE: PauseEntry[] = ['resume', 'restart', 'settings', 'report', 'copyReport', 'quit'];

describe('pause fullscreen action', () => {
  const fs = (active: boolean): MenuActions => ({ ...full, toggleFullscreen: noop, isFullscreen: () => active });

  it('appears after the settings when the app offers it, and stays out of the way otherwise', () => {
    expect(pauseEntries(fs(false))).toEqual(['resume', 'restart', 'settings', 'fullscreen', 'report', 'copyReport', 'quit']);
    expect(pauseEntries(full)).not.toContain('fullscreen');
  });

  it('reflects the current state in its label and hint, in every language', () => {
    for (const language of LANGUAGES) {
      const tr = (key: string) => catalog(language)[key] ?? '';
      const off = pauseActions(fs(false), tr).find((a) => a.id === 'fullscreen')!;
      const on = pauseActions(fs(true), tr).find((a) => a.id === 'fullscreen')!;
      expect(off.label, language).toBe(tr('hint.fullscreen.enter'));
      expect(on.label, language).toBe(tr('hint.fullscreen.exit'));
      expect(off.hint, language).toBeTruthy();
      expect(on.hint, language).toBeTruthy();
      expect(off.confirm).toBeNull();
      expect(off.danger).toBe(false);
    }
    expect(PAUSE_ICONS.fullscreen).toBeDefined();
  });

  it('keeps one primary action and at most seven rows with it', () => {
    const list = pauseActions(fs(false));
    expect(list.length).toBeLessThanOrEqual(7);
    expect(list.filter((a) => a.primary).map((a) => a.id)).toEqual(['resume']);
    expect(list.at(-1)!.id).toBe('quit');
  });
});

describe('pause actions', () => {
  it('keeps every action of the old list, in the same order', () => {
    expect(pauseActions(full).map((a) => a.id)).toEqual(BEFORE);
    expect(pauseActions(base).map((a) => a.id)).toEqual(['resume', 'restart', 'settings', 'quit']);
    expect(pauseActions(full).map((a) => a.id)).toEqual(pauseEntries(full));
  });

  it('has at most seven actions (Hick), Continuar first and the only primary, quit last', () => {
    const list = pauseActions(full);
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThanOrEqual(7);
    expect(list[0]!.id).toBe('resume');
    expect(list.filter((a) => a.primary).map((a) => a.id)).toEqual(['resume']);
    expect(list.at(-1)!.id).toBe('quit');
  });

  it('asks before the actions that lose progress, and only those', () => {
    const list = pauseActions(full);
    expect(list.filter((a) => a.confirm).map((a) => a.id)).toEqual(['restart', 'quit']);
    expect(list.find((a) => a.id === 'quit')!.danger).toBe(true);
    for (const a of list.filter((x) => x.confirm)) {
      for (const language of LANGUAGES) {
        for (const key of [a.confirm!.titleKey, a.confirm!.bodyKey, a.confirm!.confirmKey]) expect(catalog(language)[key], `${language} ${key}`).toBeTruthy();
      }
    }
  });

  it('dims restart with no uses left and drops its confirmation, as the old row did', () => {
    const restart = pauseActions({ ...base, restartsLeft: 0 }).find((a) => a.id === 'restart')!;
    expect(restart.disabled).toBe(true);
    expect(restart.confirm).toBeNull();
    expect(pauseActions({ ...base, restartsLeft: 2 }).find((a) => a.id === 'restart')!.label).toContain('(2)');
    expect(pauseActions({ ...base, restartsLeft: null }).find((a) => a.id === 'restart')!.disabled).toBe(false);
  });

  it('gives every action an icon, a label and a hint in every language', () => {
    for (const id of BEFORE) expect(PAUSE_ICONS[id], id).toBeDefined();
    for (const language of LANGUAGES) {
      const tr = (key: string) => catalog(language)[key] ?? '';
      for (const a of pauseActions(full, tr)) {
        expect(a.label, `${language} ${a.id}`).toBeTruthy();
        expect(a.hint, `${language} ${a.id} hint`).toBeTruthy();
      }
    }
  });
});

const info = (over: Partial<PauseRunInfo> = {}): PauseRunInfo => ({
  species: 'mimikyu',
  dungeon: 'crypt',
  floor: 3,
  difficulty: 'normal',
  elapsedMs: 754_000,
  coins: 42,
  loadout: ['ember', null, null, null],
  coop: false,
  ...over,
});

describe('run time', () => {
  it('reads minutes and seconds, hours when there are some', () => {
    expect(formatRunTime(0)).toBe('0:00');
    expect(formatRunTime(754_000)).toBe('12:34');
    expect(formatRunTime(3_725_000)).toBe('1:02:05');
    expect(formatRunTime(-5)).toBe('0:00');
  });
});

describe('pause summary', () => {
  it('shows only what the run already has', () => {
    const held: HeldItem[] = [{ id: 'leftovers', name: 'Restos', description: 'x', count: 2 }];
    const s = pauseSummary(info(), held);
    expect(s.dungeonName).toBeTruthy();
    expect(s.floorLine).toContain('3');
    expect(s.time).toBe('12:34');
    expect(s.coins).toBe(42);
    expect(s.items).toEqual(held);
    expect(s.moves.map((m) => m.slot)).toEqual([...PLAYER_SLOT_LAYOUT]);
    expect(s.moves[0]!.id).toBe('ember');
    expect(s.moves[1]!.id).toBeNull();
  });

  it('covers solo and co-op: the co-op flag travels with the summary', () => {
    expect(pauseSummary(info({ coop: false }), []).coop).toBe(false);
    expect(pauseSummary(info({ coop: true }), []).coop).toBe(true);
  });

  it('is built for every playable species, in every language', () => {
    for (const language of LANGUAGES) {
      const tr = (key: string) => catalog(language)[key] ?? '';
      for (const species of PLAYABLE_SPECIES) {
        const s = pauseSummary(info({ species }), [], tr);
        expect(s.speciesName, `${language} ${species}`).toBeTruthy();
        expect(s.species).toBe(species);
      }
    }
  });

  it('names every dungeon, every challenge and every difficulty', () => {
    for (const language of LANGUAGES) {
      const tr = (key: string) => catalog(language)[key] ?? '';
      for (const d of [...DUNGEONS, ...CHALLENGES]) expect(pauseSummary(info({ dungeon: d.id }), [], tr).dungeonName, `${language} ${d.id}`).toBeTruthy();
      for (const difficulty of DIFFICULTIES) expect(pauseSummary(info({ difficulty }), [], tr).difficultyName, `${language} ${difficulty}`).toBeTruthy();
    }
  });
});
