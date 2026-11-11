import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS, fillBindings, rebind, setActiveBindings, townActionOf, type BindAction, type Bindings } from '../../src/adapters/bindings';
import { catalog, setLanguage, t } from '../../src/i18n';
import { hintsFor, interactGlyphs, type HintContext } from '../../src/ui/play-hints-model';
import { moveSlotModel } from '../../src/ui/combat-hud-model';
import { TUTORIAL_HINTS, signText } from '../../src/app/tutorial';
import type { PlayerState } from '../../src/core/state';

/**
 * Issue #62: every key hint that names a key follows the player's bindings, and with the defaults says what it
 * said before.
 */
const bound = (...changes: [BindAction, 0 | 1, string][]): Bindings => {
  let table: Bindings = DEFAULT_BINDINGS;
  for (const [action, slot, input] of changes) {
    const result = rebind(table, action, slot, input);
    if (result.kind === 'refused') throw new Error(`${action} refused`);
    table = result.bindings;
  }
  return table;
};

const ctx: HintContext = { device: 'keyboard', place: 'run', minimap: true, spectating: false, padStyle: 'xbox' };
const player = { species: 'mimikyu', loadout: ['shadow-claw', 'play-rough', 'swords-dance', 'earthquake'], items: [], level: 1, cooldowns: {}, stamina: 100, moveRanks: {} } as unknown as PlayerState;

afterEach(() => {
  setActiveBindings(DEFAULT_BINDINGS);
  setLanguage('es');
});

describe('hints follow the bindings', () => {
  it('the hint bar shows the rebound keys', () => {
    setActiveBindings(bound(['roll', 0, 'KeyC'], ['up', 0, 'KeyI'], ['fast', 0, 'KeyJ'], ['lock', 0, 'KeyL'], ['map', 0, 'KeyN']));
    const glyphs = (id: string) => hintsFor(ctx).find((h) => h.id === id)!.glyphs.map((g) => g.label);
    expect(glyphs('roll')).toEqual(['C']);
    expect(glyphs('move')).toEqual(['I', 'A', 'S', 'D']);
    expect(glyphs('attack')).toEqual(['J', 'E', 'R', 'F']);
    expect(glyphs('lock')).toEqual(['L']);
    expect(glyphs('map')).toEqual(['N']);
    expect(hintsFor({ ...ctx, place: 'town' }).find((h) => h.id === 'wheel')!.glyphs.map((g) => g.label)).toEqual(['N']);
  });

  it('the move slots show the rebound key, and a mouse button by its short name', () => {
    setActiveBindings(bound(['fast', 0, 'KeyJ'], ['heavy', 0, 'Mouse4'], ['heavy', 1, 'KeyK']));
    const labels = [0, 1].map((i) => moveSlotModel(player, i, 'keyboard', 'xbox').key?.label);
    expect(labels).toEqual(['J', t('bind.mouse.4.short')]);
  });

  it('the tutorial signs name the bound keys; with the defaults they read as before', () => {
    expect(signText('move', 'keys')).toBe('[WASD] o [flechas] para moverte. [Espacio] para rodar: mientras ruedas eres invulnerable.');
    expect(signText('roll', 'keys')).toBe('Te han golpeado. Rueda con [Espacio] justo antes del golpe para atravesarlo.');
    expect(signText('lock', 'keys')).toBe('[Shift] o [Clic central] fija al enemigo más cercano; la [rueda] cambia de objetivo.');
    setActiveBindings(bound(['roll', 0, 'KeyC'], ['heavy', 0, 'KeyK'], ['heavy', 1, 'Mouse4']));
    expect(signText('roll', 'keys')).toContain('[C]');
    expect(signText('charge', 'keys')).toBe(`Mantén [K] o [${t('bind.mouse.4')}] para cargar el movimiento fuerte y suéltalo para lanzarlo.`);
    // The pad and touch wording never changes.
    expect(signText('roll', 'pad')).toBe(t('tutorial.roll.pad'));
  });

  it('no keyboard sign or the spectate button keeps a placeholder, in Spanish and English', () => {
    for (const language of ['es', 'en'] as const) {
      setLanguage(language);
      for (const hint of TUTORIAL_HINTS) expect(signText(hint, 'keys'), `${language} ${hint}`).not.toMatch(/\{/);
      expect(fillBindings(t('spectate.nextKey'))).not.toMatch(/\{/);
    }
  });

  it('the spectate button names the bound key', () => {
    expect(fillBindings(t('spectate.nextKey'))).toBe('Cambiar (Q)');
    setActiveBindings(bound(['spectate', 0, 'KeyV']));
    expect(fillBindings(t('spectate.nextKey'))).toBe('Cambiar (V)');
  });

  it('every input label has a Spanish and an English name where one is needed', () => {
    for (const key of ['bind.or', 'bind.arrows', 'bind.key.Space', ...[0, 1, 2, 3, 4].flatMap((b) => [`bind.mouse.${b}`, `bind.mouse.${b}.short`])]) {
      expect(catalog('es')[key], key).toBeTruthy();
      expect(catalog('en')[key], key).toBeTruthy();
    }
  });
});

describe('the town follows the bindings', () => {
  it('with the defaults: WASD and arrows walk, Shift runs, E, Enter and Space talk, Tab opens the wheel, Esc the menu', () => {
    const of = (code: string) => townActionOf(code);
    expect(['KeyW', 'ArrowUp', 'KeyA', 'ArrowRight'].map(of)).toEqual(['up', 'up', 'left', 'right']);
    expect(['ShiftLeft', 'ShiftRight'].map(of)).toEqual(['run', 'run']);
    expect(['KeyE', 'Enter', 'NumpadEnter', 'Space'].map(of)).toEqual(['interact', 'interact', 'interact', 'interact']);
    expect(of('Tab')).toBe('map');
    expect(of('Escape')).toBe('menu');
    expect(of('KeyQ')).toBe(null);
  });

  it('rebound keys walk, run and talk; the pad\'s synthetic arrows still walk', () => {
    setActiveBindings(bound(['up', 1, 'KeyI'], ['run', 0, 'KeyC'], ['interact', 0, 'KeyG']));
    expect(townActionOf('KeyI')).toBe('up');
    expect(townActionOf('ArrowUp')).toBe(null);
    expect(townActionOf('ArrowUp', undefined, false)).toBe('up');
    expect(townActionOf('KeyC')).toBe('run');
    expect(townActionOf('ShiftLeft')).toBe(null);
    expect(townActionOf('KeyG')).toBe('interact');
    expect(townActionOf('Enter')).toBe('interact');
  });

  it('a confirm key bound to a town action does that action instead of talking', () => {
    setActiveBindings(bound(['run', 0, 'Space']));
    expect(townActionOf('Space')).toBe('run');
  });

  it('the talk prompt shows the bound interact key', () => {
    expect(interactGlyphs('keyboard', 'xbox').map((g) => g.label)).toEqual(['E']);
    setActiveBindings(bound(['interact', 0, 'KeyG']));
    expect(interactGlyphs('keyboard', 'xbox').map((g) => g.label)).toEqual(['G']);
  });
});
