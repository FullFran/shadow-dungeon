import { describe, expect, it } from 'vitest';
import { CHALLENGES } from '../../src/data/dungeons';
import { PLAYABLE_SPECIES } from '../../src/data/species';
import { SPRITE_KEYS } from '../../src/data/sprites';
import { WORLD } from '../../src/data/world';
import { catalog, LANGUAGES } from '../../src/i18n';
import { npcLines } from '../../src/town/dialog';
import { npcView, RECOGNISED_AT, REVEALED_AT, residentOf } from '../../src/town/residents';

/**
 * The Sendas are the residents' wounds (docs/lore/lore.md §4, owner
 * 2026-10-27): every Senda line has one neighbour in the world, who says one
 * thing before its Senda and something else once it recognises you
 * (a chapter closed in the save's `story`).
 */
const LINES = CHALLENGES.map((d) => d.challenge!.line);
const NPCS = Object.values(WORLD).flatMap((map) => map.npcs.map((npc) => ({ map: map.id, npc })));

describe('Senda residents', () => {
  it('gives every Senda line exactly one resident in the world', () => {
    expect(LINES).toHaveLength(8);
    for (const line of LINES) expect(NPCS.filter(({ npc }) => npc.resident?.line === line).length, line).toBe(1);
  });

  it('gives each resident different lines before and after it recognises you, in Spanish and English', () => {
    for (const line of LINES) {
      const { npc } = residentOf(line)!;
      const before = npcView(npc, undefined);
      const after = npcView(npc, { [line]: RECOGNISED_AT });
      expect(before.lines.length, line).toBeGreaterThanOrEqual(1);
      expect(after.lines.length, line).toBeGreaterThanOrEqual(1);
      expect(after.lines.some((key) => !before.lines.includes(key)), `${line}: a new line once recognised`).toBe(true);
      const keys = [...before.lines, ...after.lines, ...npcView(npc, { [line]: REVEALED_AT }).lines, before.nameKey, after.nameKey];
      for (const language of LANGUAGES) for (const key of keys) expect(catalog(language)[key], `${language} ${key}`).toBeTruthy();
    }
  });

  it('keeps the lines before a chapter is closed, whatever other lines have closed', () => {
    for (const line of LINES) {
      const { npc } = residentOf(line)!;
      const others = Object.fromEntries(LINES.filter((l) => l !== line).map((l) => [l, 3]));
      expect(npcView(npc, others)).toEqual(npcView(npc, undefined));
    }
  });

  it('draws every resident with a sprite the game ships', () => {
    for (const { npc } of NPCS) {
      expect(Object.hasOwn(SPRITE_KEYS, npc.species), npc.id).toBe(true);
      if (npc.resident?.disguise) expect(Object.hasOwn(SPRITE_KEYS, npc.resident.disguise.species), npc.id).toBe(true);
    }
  });

  it('places the five new residents where the owner put them', () => {
    expect(residentOf('abra')!.map).toBe('refugio');
    expect(residentOf('zorua')!.map).toBe('lago');
    expect(residentOf('axew')!.map).toBe('refugio');
    expect(residentOf('piplup')!.map).toBe('lago');
    expect(residentOf('shinx')!.map).toBe('crater');
    expect(residentOf('cubone')!.npc.id).toBe('fisher');
    expect(residentOf('litwick')!.npc.id).toBe('keeper');
    expect(residentOf('mimikyu')!.npc.id).toBe('gacha');
  });

  it('puts Piplup on the pier beside the Cubone fisher', () => {
    const piplup = residentOf('piplup')!.npc;
    const fisher = WORLD.lago.npcs.find((n) => n.id === 'fisher')!;
    expect(Math.abs(piplup.x - fisher.x) + Math.abs(piplup.y - fisher.y)).toBe(1);
  });

  it('never stacks two NPCs on one tile', () => {
    for (const map of Object.values(WORLD)) {
      const tiles = map.npcs.map((n) => `${n.x},${n.y}`);
      expect(new Set(tiles).size, map.id).toBe(tiles.length);
    }
  });

  it('disguises Zorua as a small Pokémon outside the playable lines until its Senda is done, then shows the Zoroark it ends as', () => {
    const { npc } = residentOf('zorua')!;
    const disguise = npc.resident!.disguise!;
    expect(npc.species).toBe('zoroark');
    expect(PLAYABLE_SPECIES).not.toContain(disguise.species);
    expect(['mimikyu', 'zorua', 'litwick', 'cubone']).not.toContain(disguise.species);
    for (const done of [0, 1, 2]) {
      const view = npcView(npc, done ? { zorua: done } : undefined);
      expect(view.species, `chapters ${done}`).toBe(disguise.species);
      expect(view.nameKey).toBe(disguise.nameKey);
    }
    const revealed = npcView(npc, { zorua: REVEALED_AT });
    expect(revealed.species).toBe('zoroark');
    expect(revealed.nameKey).toBe(`town.name.${npc.role}`);
    expect(revealed.lines).not.toEqual(npcView(npc, { zorua: RECOGNISED_AT }).lines);
    // Its own name never shows while it hides.
    for (const language of LANGUAGES) expect(catalog(language)[disguise.nameKey]).not.toMatch(/zor(ua|oark)/i);
  });

  it('shows everyone else as itself, named by its role', () => {
    for (const { npc } of NPCS.filter(({ npc }) => !npc.resident?.disguise)) {
      const view = npcView(npc, undefined);
      expect(view.species).toBe(npc.species);
      expect(view.nameKey).toBe(`town.name.${npc.role}`);
      expect(view.lines).toEqual(npc.lines);
    }
  });

  it('recognises from the first closed chapter and talks through npcLines like any NPC', () => {
    expect(RECOGNISED_AT).toBe(1);
    expect(REVEALED_AT).toBe(3);
    const { npc } = residentOf('abra')!;
    const view = npcView(npc, { abra: 2 });
    expect(npcLines(view, 0).length).toBeGreaterThanOrEqual(1);
  });
});
