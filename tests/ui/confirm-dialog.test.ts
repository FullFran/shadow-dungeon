import { describe, expect, it } from 'vitest';
import { confirmModel } from '../../src/ui/confirm-dialog';

/** The shared confirmation (owner, 2026-11-03: "haz confirmación para evolucionar y para aprender movimientos"). */
describe('confirm dialog model', () => {
  it('starts on Cancel, the safe choice', () => {
    expect(confirmModel().focus).toBe('cancel');
  });
  it('arrows move between Cancel and Confirm, Enter resolves the focused one, Esc always cancels', () => {
    let m = confirmModel();
    m = m.key('ArrowRight');
    expect(m.focus).toBe('confirm');
    expect(m.key('Enter').result).toBe('confirm');
    expect(m.key('ArrowLeft').focus).toBe('cancel');
    expect(m.key('Escape').result).toBe('cancel');
    expect(confirmModel().key('Enter').result).toBe('cancel');
  });
});
