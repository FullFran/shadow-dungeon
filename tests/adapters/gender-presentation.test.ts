import { describe, expect, it } from 'vitest';
import { playerAnim, playerSprite } from '../../src/adapters/sprite-anim';
import { genderRow, type LineGender } from '../../src/app/loadout';
import { FEMALE_ART, hasFemaleArt } from '../../src/core/gender';
import { createWorld } from '../../src/core/world';
import { vec } from '../../src/core/vec';
import { PLAYABLE_SPECIES, SPECIES } from '../../src/data/species';
import { femaleKey, lookKey, SPRITE_KEYS, SPRITES } from '../../src/data/sprites';
import { setLanguage, t } from '../../src/i18n';
import { playerSprite as walkerSprite } from '../../src/town/scene';

/** Gender on screen (odd/tasks/pokemon-gender.md): the sheet follows it where there is female art, nowhere else. */
describe('the sheet of a look', () => {
  it('every playable species: male, female, shiny and shiny female', () => {
    for (const species of PLAYABLE_SPECIES) {
      const base = SPRITE_KEYS[SPECIES[species].sprite];
      const art = hasFemaleArt(species);
      expect(playerSprite({ species, disguiseBroken: false }), species).toBe(base);
      expect(playerSprite({ species, disguiseBroken: false, shiny: true }), species).toBe(`${base}/0001`);
      expect(playerSprite({ species, disguiseBroken: false, female: true }), species).toBe(art ? `${base}/0000/0002` : base);
      expect(playerSprite({ species, disguiseBroken: false, shiny: true, female: true }), species).toBe(art ? `${base}/0001/0002` : `${base}/0001`);
    }
  });

  it('a spent Mimikyu ignores the flag too', () => {
    expect(playerSprite({ species: 'mimikyu', disguiseBroken: true, female: true })).toBe(SPRITE_KEYS.mimikyuBusted);
  });

  it('every playable species draws every animation it plays with the flag on', () => {
    for (const species of PLAYABLE_SPECIES) {
      for (const shiny of [false, true]) {
        const player = createWorld({ seed: 1, arena: { width: 400, height: 300 }, playerPos: vec(50, 50), species, shiny, female: true }).player;
        const choice = playerAnim(player, { timeMs: 100, sinceHurtMs: Infinity, moving: true });
        expect(SPRITES.sprites[choice.sprite]?.anims[choice.anim], `${species} ${choice.anim}`).toBeDefined();
      }
    }
  });

  it('an evolved form draws its own female sheet', () => {
    expect(playerSprite({ species: 'luxray', disguiseBroken: false, female: true })).toBe(femaleKey(SPRITE_KEYS.luxray));
  });

  it('falls back to the sheets that exist', () => {
    expect(lookKey(SPRITE_KEYS.zorua, false, true)).toBe(SPRITE_KEYS.zorua);
    expect(lookKey(SPRITE_KEYS.zorua, true, true)).toBe(`${SPRITE_KEYS.zorua}/0001`);
  });

  it('the town draws a walker by its look; an unknown species as plain Mimikyu', () => {
    expect(walkerSprite('shinx', false, true)).toBe(femaleKey(SPRITE_KEYS.shinx));
    expect(walkerSprite('shinx', true, true)).toBe(femaleKey(SPRITE_KEYS.shinx, true));
    expect(walkerSprite('shinx', true)).toBe(`${SPRITE_KEYS.shinx}/0001`);
    expect(walkerSprite('shinx')).toBe(SPRITE_KEYS.shinx);
    expect(walkerSprite('zorua', false, true)).toBe(SPRITE_KEYS.zorua);
    expect(walkerSprite('toString', false, true)).toBe(SPRITE_KEYS.mimikyu);
  });
});

describe('the gender row', () => {
  const picker = (): LineGender & { picks: boolean[] } => {
    const picks: boolean[] = [];
    let now = false;
    return { picks, female: () => now, set: (_species, next) => { now = next; picks.push(next); } };
  };

  it('appears only for a species with female art', () => {
    for (const species of PLAYABLE_SPECIES) expect(genderRow(species, picker(), () => {}) !== null, species).toBe(FEMALE_ART.includes(species));
  });

  it('reads Macho or Hembra, and a confirm or ◀ ▶ flips it, saved and redrawn', () => {
    setLanguage('es');
    const pick = picker();
    let redraws = 0;
    const row = genderRow('shinx', pick, () => redraws++)!;
    expect(row.label).toBe('Género');
    expect(row.value).toBe('Macho');
    row.onConfirm!();
    expect(pick.picks).toEqual([true]);
    expect(genderRow('shinx', pick, () => {})!.value).toBe('Hembra');
    row.onAdjust!(1);
    row.onAdjust!(-1);
    expect(pick.picks).toEqual([true, false, true]);
    expect(redraws).toBe(3);
  });

  it('is written in both languages', () => {
    setLanguage('en');
    expect([t('loadout.gender'), t('loadout.gender.male'), t('loadout.gender.female')]).toEqual(['Gender', 'Male', 'Female']);
    setLanguage('es');
    expect([t('loadout.gender'), t('loadout.gender.male'), t('loadout.gender.female')]).toEqual(['Género', 'Macho', 'Hembra']);
  });
});
