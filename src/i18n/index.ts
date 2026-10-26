import es from './es.json';
import en from './en.json';

/**
 * Tiny key-value i18n. Spanish is the source language: every key must exist
 * in `es`, and other languages are checked against it by a test.
 */
export type Language = 'es' | 'en';
export type MessageKey = keyof typeof es;

const catalogs: Record<Language, Record<string, string>> = { es, en };

export const LANGUAGES: readonly Language[] = ['es', 'en'];

let current: Language = 'es';

/** English if the browser language starts with "en", otherwise Spanish. */
export function detectLanguage(browserLanguage: string | undefined): Language {
  return browserLanguage?.toLowerCase().startsWith('en') ? 'en' : 'es';
}

export function setLanguage(language: Language): void {
  current = language;
}

export function getLanguage(): Language {
  return current;
}

const lookup = (key: string): string => catalogs[current][key] ?? catalogs.es[key] ?? key;

/**
 * Looks a key up in the current language, falling back to Spanish, then the
 * key itself. `{called}` and `{calledOne}` in any string become the name the
 * villagers give the reborn (`lore.reborn.name`, `lore.reborn.one`;
 * docs/sima-redesign.md), so the name lives in one place.
 */
export function t(key: MessageKey | (string & {})): string {
  const text = lookup(key);
  return text.includes('{called') ? text.replaceAll('{calledOne}', lookup('lore.reborn.one')).replaceAll('{called}', lookup('lore.reborn.name')) : text;
}

export function catalog(language: Language): Readonly<Record<string, string>> {
  return catalogs[language];
}
