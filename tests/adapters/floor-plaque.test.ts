import { describe, expect, it } from 'vitest';
import { bossPlaque, cardPlaque, introPlaque } from '../../src/adapters/floor-plaque';
import { CAVES, CRYPT, ECLIPSE } from '../../src/data/dungeons';
import { SIMA_BANDS } from '../../src/data/sima';
import { setLanguage } from '../../src/i18n';
import { dungeonPlace, shrinePlace, simaBandPlace } from '../../src/ui/location-plaque-model';

setLanguage('es');

const card = { dungeon: 'Cripta del Rey Espada', floor: 6, kind: 'normal' as const, escape: null, shownAtMs: 0, place: dungeonPlace(CRYPT) };

describe('floor plaques', () => {
  it('a plain floor names the dungeon and the floor, with its lore as the note', () => {
    const plaque = cardPlaque({ ...card, lore: 'El aire tiembla.' }, 'easy');
    expect(plaque).toMatchObject({ icon: 'crypt', variant: 'stone', name: 'Cripta del Rey Espada', subtitle: 'Planta 6', note: 'El aire tiembla.' });
  });

  it('shows the tier only when it is not the default one', () => {
    expect(cardPlaque(card, 'hard').subtitle).toBe('Planta 6 · Difícil');
  });

  it('an urgent floor puts its warning first in the note', () => {
    const plaque = cardPlaque({ ...card, place: dungeonPlace(CAVES), kind: 'flood', lore: 'Agua.' }, 'easy');
    expect(plaque.note).toBe('¡El agua sube! · Agua.');
  });

  it('a floor of the Sima wears the eclipse look', () => {
    expect(cardPlaque({ ...card, place: dungeonPlace(ECLIPSE) }, 'easy').variant).toBe('sima');
  });

  it('the title of a place (floor 1, a Sima stratum) carries its subtitle after the floor', () => {
    const band = SIMA_BANDS[1]!;
    const plaque = introPlaque({ name: 'Estrato II', subtitle: 'Raíces', shownAtMs: 0, place: simaBandPlace(band), lore: 'Humedad.' }, 11, 'easy');
    expect(plaque).toMatchObject({ icon: 'forest', variant: 'sima', name: 'Estrato II', subtitle: 'Planta 11 · Raíces', note: 'Humedad.' });
  });

  it('a boss is the blood plaque with its epithet, and the shrine keeps its own picture', () => {
    expect(bossPlaque({ name: 'Aegislash', subtitle: 'La Espada Fantasma', shownAtMs: 0 }, 4, false)).toMatchObject({ icon: 'boss', variant: 'boss', name: 'Aegislash', subtitle: 'La Espada Fantasma', note: 'Planta 4' });
    expect(bossPlaque({ name: 'Aegislash', subtitle: '', shownAtMs: 0 }, 4, true)).toMatchObject({ icon: shrinePlace().icon, variant: 'boss', subtitle: 'Guardián' });
  });
});
