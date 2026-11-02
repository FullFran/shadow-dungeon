import { describe, expect, it } from 'vitest';
import { pausesOnLeave } from '../../src/app/pause-on-leave';

// Ticket SD-LJJ7QL: "me ha sacado de la pagina" mid-boss (F1 opened the browser's help); she came back to a defeat.
describe('leaving the page pauses a solo run', () => {
  const live = { shared: false, ended: false, menuOpen: false };

  it('pauses a solo run that is still going', () => {
    expect(pausesOnLeave(live)).toBe(true);
  });

  it('never in a shared run (it cannot stop), after the end, or with the menu already open', () => {
    expect(pausesOnLeave({ ...live, shared: true })).toBe(false);
    expect(pausesOnLeave({ ...live, ended: true })).toBe(false);
    expect(pausesOnLeave({ ...live, menuOpen: true })).toBe(false);
  });
});
