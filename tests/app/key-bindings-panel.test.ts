import { afterEach, describe, expect, it } from 'vitest';
import { BIND_ACTIONS, DEFAULT_BINDINGS, rebind } from '../../src/adapters/bindings';
import { setLanguage, t } from '../../src/i18n';
import { bindingRows, rebindFeedback } from '../../src/app/key-bindings-panel';

afterEach(() => setLanguage('es'));

describe('Settings > Keyboard and mouse (issue #62)', () => {
  it('lists every rebindable action with its two inputs, the menu\'s Esc fixed', () => {
    const rows = bindingRows(DEFAULT_BINDINGS);
    expect(rows.map((r) => r.action)).toEqual([...BIND_ACTIONS]);
    const fast = rows.find((r) => r.action === 'fast')!;
    expect(fast.label).toBe(t('bind.action.fast'));
    expect(fast.slots.map((s) => s.label)).toEqual(['Q', t('bind.mouse.0')]);
    expect(rows.find((r) => r.action === 'roll')!.slots[1]).toEqual({ input: null, label: t('bind.none'), fixed: false });
    expect(rows.find((r) => r.action === 'menu')!.slots.map((s) => s.fixed)).toEqual([true, false]);
  });

  it('every action has a name in Spanish and English', () => {
    for (const language of ['es', 'en'] as const) {
      setLanguage(language);
      for (const row of bindingRows(DEFAULT_BINDINGS)) expect(row.label, `${language} ${row.action}`).not.toMatch(/^bind\./);
    }
  });

  it('tells the player what happened: bound, swapped (and with what), cleared, or refused and why', () => {
    const ok = rebind(DEFAULT_BINDINGS, 'roll', 0, 'KeyC');
    expect(rebindFeedback(ok, 'roll', 'KeyC')).toBe('Rodar: ahora C.');
    const swap = rebind(DEFAULT_BINDINGS, 'roll', 0, 'KeyQ');
    expect(rebindFeedback(swap, 'roll', 'KeyQ')).toBe('Q era de «Movimiento rápido»: se han intercambiado, «Movimiento rápido» pasa a Espacio.');
    const cleared = rebind(DEFAULT_BINDINGS, 'fast', 0, 'Tab');
    expect(rebindFeedback(cleared, 'fast', 'Tab')).toBe(`Tab era de «${t('bind.action.map')}»: «${t('bind.action.map')}» se queda sin esa tecla.`);
    expect(rebindFeedback(rebind(DEFAULT_BINDINGS, 'roll', 0, 'F11'), 'roll', 'F11')).toBe(t('bind.refused.reserved').replace('{key}', 'F11'));
    expect(rebindFeedback(rebind(DEFAULT_BINDINGS, 'interact', 0, 'Mouse0'), 'interact', 'Mouse0')).toBe(t('bind.refused.mouse'));
  });
});
