import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { playerAnim, playerSprite } from '../../src/adapters/sprite-anim';
import { revealText, stallInfo } from '../../src/app/gacha';
import { EMPTY_SAVE, loadSave, wearShinyAt, writeSave } from '../../src/app/save';
import { createWorld } from '../../src/core/world';
import { vec } from '../../src/core/vec';
import { GACHA } from '../../src/data/gacha';
import { PLAYABLE_SPECIES, SPECIES } from '../../src/data/species';
import { SPRITE_KEYS, SPRITES } from '../../src/data/sprites';
import { setLanguage } from '../../src/i18n';
import { playerSprite as walkerSprite } from '../../src/town/scene';

/** Shiny skins on screen (odd/tasks/shiny-echo.md): every playable species draws its shiny sheet when it wears the skin. */
describe('shiny presentation', () => {
  it('every playable species (and its spent form) draws a shiny sheet with every animation it plays', () => {
    for (const species of PLAYABLE_SPECIES) {
      for (const disguiseBroken of [false, true]) {
        const key = playerSprite({ species, disguiseBroken, shiny: true });
        const plain = playerSprite({ species, disguiseBroken });
        expect(key, species).toBe(`${plain}/0001`);
        expect(SPRITES.sprites[key], key).toBeDefined();
      }
      const player = { ...createWorld({ seed: 1, arena: { width: 400, height: 300 }, playerPos: vec(50, 50), species, shiny: true }).player };
      const choice = playerAnim(player, { timeMs: 100, sinceHurtMs: Infinity, moving: true });
      expect(SPRITES.sprites[choice.sprite]?.anims[choice.anim], `${species} ${choice.anim}`).toBeDefined();
    }
  });

  it('the town draws a walker shiny, and an unknown species as plain Mimikyu', () => {
    expect(walkerSprite('zorua', true)).toBe(`${SPRITE_KEYS.zorua}/0001`);
    expect(walkerSprite('zorua')).toBe(SPRITE_KEYS.zorua);
    expect(walkerSprite('toString')).toBe(SPRITE_KEYS.mimikyu);
    for (const species of PLAYABLE_SPECIES) expect(SPRITES.sprites[walkerSprite(SPECIES[species].sprite, true)], species).toBeDefined();
  });

  it('the gacha reveal says ¡Shiny! and the stall shows the shiny pity', () => {
    setLanguage('es');
    expect(revealText({ species: 'abra', rarity: 'rare', duplicate: false, refund: 0, shiny: true })).toMatch(/^¡Shiny! ¡Abra!/);
    expect(revealText({ species: 'abra', rarity: 'rare', duplicate: false, refund: 0, shiny: false })).not.toContain('Shiny');
    expect(stallInfo({ ...EMPTY_SAVE, shinyPity: 30 }).shiny).toEqual({ percent: 2.5, pityLeft: GACHA.shinyPity - 30 });
  });

  it('a skin is put on and off in the save only once unlocked', () => {
    const store = memoryStore();
    expect(wearShinyAt(store, 'zorua', true).shinyWorn).toBeUndefined();
    writeSave(store, { ...EMPTY_SAVE, shinies: ['zorua'], shinyWorn: ['zorua'] });
    expect(wearShinyAt(store, 'zoroark', false).shinyWorn).toBeUndefined();
    expect(wearShinyAt(store, 'zorua', true).shinyWorn).toEqual(['zorua']);
    expect(loadSave(store).shinies).toEqual(['zorua']);
  });
});
