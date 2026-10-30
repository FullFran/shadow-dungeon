import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GAMEPAD_HELP, buttonName } from '../../src/app/gamepad-help';
import { PAD, padKeys, padFrame, padMemory } from '../../src/adapters/gamepad';
import { catalog, LANGUAGES } from '../../src/i18n';

const pressed = (button: number) => ({ axes: [0, 0, 0, 0], pressed: new Set([button]) });

describe('the controller help', () => {
  it('names each button for both pads, by position', () => {
    expect(buttonName('a', 'xbox')).toBe('A');
    expect(buttonName('a', 'playstation')).toBe('✕');
    expect(buttonName('x', 'playstation')).toBe('□');
    expect(buttonName('y', 'playstation')).toBe('△');
    expect(buttonName('lb', 'playstation')).toBe('L1');
    expect(buttonName('start', 'playstation')).toBe('Options');
  });
  it('says what the buttons really do in combat', () => {
    const row = (action: string) => GAMEPAD_HELP.combat.find((r) => r.action === action)!.buttons[0]!;
    const frame = (action: string) => padFrame(pressed(PAD[row(action) as keyof typeof PAD]), padMemory(null)).frame;
    expect(frame('roll').roll).toBe(true);
    expect(frame('fast').fast).toBe(true);
    expect(frame('heavy').heavy).toBe(true);
    expect(frame('boost').boost).toBe(true);
    expect(frame('area').area).toBe(true);
    expect(frame('lock').lockHeld).toBe(true);
  });
  it('says what the buttons really do in menus', () => {
    const row = (action: string) => GAMEPAD_HELP.menus.find((r) => r.action === action)!.buttons[0]!;
    expect([...padKeys(pressed(PAD[row('confirm') as keyof typeof PAD]))]).toEqual(['Enter']);
    expect([...padKeys(pressed(PAD[row('back') as keyof typeof PAD]))]).toEqual(['Escape']);
  });
  it('has every line in every language, without em dashes', () => {
    const keys = ['title.controls', 'options.about.controls', 'controls.combat', 'controls.menus', 'controls.note', ...[...GAMEPAD_HELP.combat, ...GAMEPAD_HELP.menus].map((r) => `controls.${r.action}`)];
    for (const language of LANGUAGES) {
      for (const key of keys) {
        expect(catalog(language)[key as never], `${language} ${key}`).toBeTruthy();
        expect(catalog(language)[key as never], key).not.toContain('—');
      }
    }
  });
  it('is one step away: Options on the title and the town menu, and the connect notice says where', () => {
    const main = readFileSync(join(__dirname, '../../src/app/main.ts'), 'utf8');
    expect(main).toContain("{ label: t('title.controls'), about: t('options.about.controls'), onConfirm: () => controlsScreen(root, () => optionsScreen(root, 'controls')) }");
    for (const language of LANGUAGES) expect(catalog(language)['gamepad.connected' as never]).toContain(catalog(language)['title.controls' as never]);
  });
});
