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

/** Looks a key up in the current language, falling back to Spanish, then the key itself. */
export function t(key: MessageKey | (string & {})): string {
  return catalogs[current][key] ?? catalogs.es[key] ?? key;
}

export function catalog(language: Language): Readonly<Record<string, string>> {
  return catalogs[language];
}
