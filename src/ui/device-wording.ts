import type { LastDevice } from '../adapters/last-device';

/**
 * Hints that name controls come in three wordings (issue #43): the keyboard one, a pad one and a touch one. The
 * keyboard wording is the base key; the others live next to it as `<stem>.pad` and `<stem>.touch`, where the stem
 * drops a trailing `.keys` (tutorial.continue.{keys,pad,touch}). Pure: screens pick a wording through
 * src/ui/device-hint.ts (all three drawn, CSS picks by `html.touch` / `html.pad`) or by the device used last.
 */
export type WordingDevice = 'keys' | 'pad' | 'touch';

export const WORDING_DEVICES: readonly WordingDevice[] = ['keys', 'pad', 'touch'];

/** The i18n key of `keysKey`'s wording for `device`. */
export function wordingKey(keysKey: string, device: WordingDevice): string {
  if (device === 'keys') return keysKey;
  const stem = keysKey.endsWith('.keys') ? keysKey.slice(0, -'.keys'.length) : keysKey;
  return `${stem}.${device}`;
}

export const wordingOfDevice = (device: LastDevice): WordingDevice => (device === 'gamepad' ? 'pad' : device === 'touch' ? 'touch' : 'keys');

/** A whole word: no letter right before or after (`Esc` is not the start of `Escúchame`). */
const word = (source: string): string => `(?<!\\p{L})(?:${source})(?!\\p{L})`;

/**
 * Key names as the Spanish catalog writes them (Spanish is the source; English mirrors it, and its verb "Enter"
 * would read as a key). Arrows count only as a control ("Flechas:", "o flechas", "[flechas]"), never as a name
 * ("Bosque de Flechas"); a lone → is a "from → to" arrow, not a key.
 */
const KEY_NAME = new RegExp(
  [
    word('Enter|Intro|Esc|Tab|Espacio|Mayús|Shift|WASD|W/S'),
    word('Q\\s*/?\\s*E'),
    '\\[[QE]\\]',
    '\\[?[Ff]lechas\\]?(?=\\s*:|\\s+mueven)|(?:\\bo\\s+|\\[)flechas',
    '(?<!\\d)1\\s*[/-]\\s*[23](?!\\d)|(?<!\\d)1, 2 o 3(?!\\d)',
    '[←↑↓◀▶]',
  ].join('|'),
  'u',
);

/** Whether a (Spanish) string names a keyboard key. */
export const namesKeyboardKey = (text: string): boolean => KEY_NAME.test(text);

export const ORPHAN = 'drawn by no screen (no t() call reads it); give it pad and touch wordings before drawing it again';

/**
 * Key hints that need no pad or touch wording: only ever shown where a keyboard is the input, or not shown at all.
 * Each entry says why (tests/ui/device-wording.test.ts fails on an entry without a reason or that names no key).
 */
export const KEYBOARD_ONLY_KEY_HINTS: Readonly<Record<string, string>> = {
  'title.hint': `${ORPHAN} (the title is the hub now: hub.hint)`,
  'prologue.skipHint': `${ORPHAN} (the cinematic skip control draws its own glyph per device: ui/cinematic-controls-model.ts)`,
  'settings.tabsHint': `${ORPHAN} (settings.hint carries the tab keys)`,
  'menu.controls.move': `${ORPHAN} (the old keyboard controls list; the controls window is the pad layout: app/gamepad-help.ts)`,
  'menu.controls.roll': `${ORPHAN} (the old keyboard controls list)`,
  'menu.controls.lock': `${ORPHAN} (the old keyboard controls list)`,
  'menu.controls.menu': `${ORPHAN} (the old keyboard controls list)`,
  'menu.controls.minimap': `${ORPHAN} (the old keyboard controls list)`,
  'evolve.shiny.text': `${ORPHAN} (the shiny row draws evolve.shiny.row)`,
  'news.hint': `${ORPHAN} (the news screen draws no key hint)`,
  'onb.reveal.hint': `${ORPHAN} (the reveal step draws buttons only)`,
  // The keyboard and mouse rebinding panel (app/key-bindings-panel.ts, issue #62) is about keys by nature: no touch or pad wording.
  'bind.key.Space': 'a key name shown in the keyboard rebinding panel (issue #62)',
  'bind.listening': 'the keyboard rebinding panel waiting for a key (issue #62)',
  'bind.refused.reserved': 'the keyboard rebinding panel refusing a reserved key (issue #62)',
  'bind.refused.fixed': 'the keyboard rebinding panel refusing a key that cannot move (issue #62)',
  'bind.note': 'the note at the top of the keyboard rebinding panel (issue #62)',
};
