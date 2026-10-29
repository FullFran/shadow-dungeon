import { describe, expect, it } from 'vitest';
import { PAUSE_ON_MENU, pauseEntries, simulationPaused } from '../../src/app/menu';

describe('Esc menu pause policy', () => {
  it('pauses the solo demo while the menu is open', () => {
    expect(PAUSE_ON_MENU).toBe(true);
    expect(simulationPaused(true)).toBe(true);
    expect(simulationPaused(false)).toBe(false);
  });

  it('a no-pause policy (future co-op) keeps the game running with the menu open', () => {
    expect(simulationPaused(true, false)).toBe(false);
    expect(simulationPaused(false, false)).toBe(false);
  });
});

describe('pause menu entries', () => {
  const base = { resume: () => undefined, restart: () => undefined, quit: () => undefined };
  it('keeps resume, restart, settings and quit as before when nothing else is offered', () => {
    expect(pauseEntries(base)).toEqual(['resume', 'restart', 'settings', 'quit']);
  });
  it('offers the bug report and the technical report before quit, only when given', () => {
    const report = () => ({ element: {} as HTMLElement, dispose: () => undefined });
    expect(pauseEntries({ ...base, openReport: report, copyReport: () => undefined })).toEqual(['resume', 'restart', 'settings', 'report', 'copyReport', 'quit']);
    expect(pauseEntries({ ...base, openReport: report })).toEqual(['resume', 'restart', 'settings', 'report', 'quit']);
  });
});
