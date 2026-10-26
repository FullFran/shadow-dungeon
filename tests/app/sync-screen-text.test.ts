import { describe, expect, it } from 'vitest';
import { agoText, cardText, statusText } from '../../src/app/account-screen';
import { catalog, LANGUAGES } from '../../src/i18n';
import { BACKUP_REASONS } from '../../src/app/backups';
import { SYNC_STATUSES } from '../../src/app/cloud-sync';

const es = (key: string): string => catalog('es')[key] ?? key;

describe('sync texts', () => {
  it('says how long ago it synced', () => {
    expect(agoText(10_000, es)).toBe('hace unos segundos');
    expect(agoText(5 * 60_000, es)).toBe('hace 5 min');
    expect(agoText(3 * 3_600_000, es)).toBe('hace 3 h');
    expect(agoText(50 * 3_600_000, es)).toBe('hace 2 días');
  });

  it('the status line: synced, offline, conflict resolved', () => {
    expect(statusText({ status: 'synced', syncedAt: 0 }, 120_000, es)).toBe('Sincronizado hace 2 min.');
    expect(statusText({ status: 'offline', syncedAt: 0 }, 1, es)).toBe('Sin conexión: se subirá luego.');
    expect(statusText({ status: 'resolved', syncedAt: 0 }, 1, es)).toBe('Conflicto resuelto. Sincronizado hace unos segundos.');
    expect(statusText({ status: 'idle', syncedAt: null }, 1, es)).toBe('');
  });

  it('a card shows Pokémonedas, Pokémon, logros and the best records', () => {
    expect(cardText({ coins: 300, owned: 2, achievements: 5, bestFloor: 4, bestSima: 0, savedAt: null }, es)).toEqual(['300 Pokémonedas · 2 Pokémon', '5 logros · Récord: piso 4 · Sima: piso -']);
  });

  it('every status and backup reason has a line in each language, without em dashes', () => {
    const keys = [...SYNC_STATUSES.filter((s) => s !== 'idle').map((s) => `sync.status.${s}`), ...BACKUP_REASONS.map((r) => `sync.backup.reason.${r}`)];
    for (const language of LANGUAGES) {
      const lines = catalog(language);
      expect(keys.filter((key) => !lines[key])).toEqual([]);
      expect(Object.keys(lines).filter((k) => k.startsWith('sync.')).sort()).toEqual(Object.keys(catalog('es')).filter((k) => k.startsWith('sync.')).sort());
      expect(Object.entries(lines).filter(([key, text]) => key.startsWith('sync.') && text.includes('—'))).toEqual([]);
    }
  });
});
