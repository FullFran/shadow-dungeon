import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { catalog, LANGUAGES } from '../../src/i18n';
import { KEYBOARD_ONLY_KEY_HINTS, namesKeyboardKey, ORPHAN, wordingKey, wordingOfDevice } from '../../src/ui/device-wording';

describe('wordingKey', () => {
  it('keeps the keyboard key and puts the pad or touch suffix on its stem', () => {
    expect(wordingKey('shop.hint', 'keys')).toBe('shop.hint');
    expect(wordingKey('shop.hint', 'pad')).toBe('shop.hint.pad');
    expect(wordingKey('shop.hint', 'touch')).toBe('shop.hint.touch');
    // A key that already ends in `.keys` is the keyboard wording of its stem (tutorial.continue.{keys,pad,touch}).
    expect(wordingKey('tutorial.continue.keys', 'keys')).toBe('tutorial.continue.keys');
    expect(wordingKey('tutorial.continue.keys', 'pad')).toBe('tutorial.continue.pad');
    expect(wordingKey('gallery.hint.keys', 'touch')).toBe('gallery.hint.touch');
  });

  it('maps the device used last to its wording', () => {
    expect(wordingOfDevice('keyboard')).toBe('keys');
    expect(wordingOfDevice('gamepad')).toBe('pad');
    expect(wordingOfDevice('touch')).toBe('touch');
  });
});

describe('namesKeyboardKey', () => {
  it('spots key names', () => {
    for (const text of ['Esc para quedarte', 'pulsa Enter para comprarla', 'Intro tira una', 'Flechas: moverte', 'Q / E: cambiar', 'Q E: hueco', '[Espacio] para rodar', '[WASD] o [flechas]', 'Tab: minimapa', 'elige con 1/2', '1-3: elegir', 'pulsa 1, 2 o 3', '◀ ▶ cambian', 'Flechas o W/S: elegir']) {
      expect(namesKeyboardKey(text), text).toBe(true);
    }
  });

  it('leaves words that only look like keys alone', () => {
    for (const text of ['Escúchame Entera', 'Bosque de Flechas', 'Signo Lluvia «Aguacero de Flechas del Ocaso»', '{from} → {to}', 'Compartir → Añadir', 'Entrar', 'Escribe tu contraseña', 'Una barra con las teclas o botones', 'Tabla']) {
      expect(namesKeyboardKey(text), text).toBe(false);
    }
  });
});

describe('every hint that names a keyboard key has a pad and a touch wording (issue #43)', () => {
  const es = catalog('es');
  const isCounterpart = (key: string): boolean => key.endsWith('.pad') || key.endsWith('.touch');
  const keyHints = Object.keys(es).filter((key) => !isCounterpart(key) && namesKeyboardKey(es[key] ?? ''));

  it('finds the key hints (the detector is not silently empty)', () => {
    expect(keyHints).toContain('shop.hint');
    expect(keyHints).toContain('leave.hint');
    expect(keyHints).toContain('town.beacon.room');
  });

  for (const language of LANGUAGES) {
    it(`"${language}" words each one for the pad and for touch`, () => {
      const strings = catalog(language);
      const missing = keyHints
        .filter((key) => !(key in KEYBOARD_ONLY_KEY_HINTS))
        .flatMap((key) => (['pad', 'touch'] as const).map((device) => wordingKey(key, device)))
        .filter((key) => !(key in strings));
      expect(missing).toEqual([]);
    });

    it(`"${language}" pad and touch wordings name no keyboard key`, () => {
      const strings = catalog(language);
      const leaking = keyHints
        .flatMap((key) => (['pad', 'touch'] as const).map((device) => wordingKey(key, device)))
        .filter((key) => key in strings && namesKeyboardKey(catalog('es')[key] ?? ''));
      expect(leaking).toEqual([]);
    });
  }

  it('allow-lists only real key hints, each with a reason', () => {
    for (const [key, reason] of Object.entries(KEYBOARD_ONLY_KEY_HINTS)) {
      expect(keyHints, key).toContain(key);
      expect(reason.length, key).toBeGreaterThan(20);
    }
  });
});

describe('the keyboard-only allow-list and the pad wording plumbing', () => {
  const root = join(__dirname, '../..');
  const sources = (dir: string): string[] =>
    readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? sources(join(dir, entry.name)) : entry.name.endsWith('.ts') ? [readFileSync(join(root, dir, entry.name), 'utf8')] : []));

  it('an entry allowed because no screen draws it is really drawn by none', () => {
    const code = sources('src').filter((text) => !text.includes('KEYBOARD_ONLY_KEY_HINTS'));
    const drawn = Object.entries(KEYBOARD_ONLY_KEY_HINTS)
      .filter(([, reason]) => reason.startsWith(ORPHAN))
      .map(([key]) => key)
      .filter((key) => code.some((text) => text.includes(`'${key}'`) || text.includes(`"${key}"`)));
    expect(drawn).toEqual([]);
  });

  it('the page keeps html.pad and the CSS shows the pad wording under it', () => {
    expect(readFileSync(join(root, 'src/app/main.ts'), 'utf8')).toMatch(/^installPadClass\(\);$/m);
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    expect(html).toContain('html.pad .dual-hint .on-pad { display: inline; }');
    // The pad rules come after the touch ones, so a pad wins over touch at equal specificity.
    expect(html.indexOf('html.pad .dual-hint .on-pad')).toBeGreaterThan(html.indexOf('html.touch .dual-hint .on-touch'));
  });
});
