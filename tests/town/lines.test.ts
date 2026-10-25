import { describe, expect, it } from 'vitest';
import { TOWN } from '../../src/data/town';
import { catalog, LANGUAGES } from '../../src/i18n';
import { npcLines } from '../../src/town/dialog';

const npc = (role: string) => TOWN.npcs.find((n) => n.role === role)!;

describe('town NPC lines', () => {
  it('the storyteller tells one of three or four lines per talk, in turn', () => {
    const story = npc('storyteller');
    expect(story.rotate).toBe(true);
    expect(story.lines.length).toBeGreaterThanOrEqual(3);
    expect(story.lines.length).toBeLessThanOrEqual(4);
    const told = Array.from({ length: story.lines.length + 1 }, (_, talks) => npcLines(story, talks));
    expect(told.every((lines) => lines.length === 1)).toBe(true);
    expect(told.slice(0, story.lines.length).map((lines) => lines[0])).toEqual([...story.lines]);
    expect(told.at(-1)).toEqual([story.lines[0]]);
  });

  it('the gacha stall and the shop give their flavour, then "coming soon", every time', () => {
    for (const role of ['gacha', 'shop']) {
      expect(npcLines(npc(role), 0)).toEqual(npcLines(npc(role), 5));
      expect(npcLines(npc(role), 0).at(-1)).toBe('town.soon');
    }
  });

  it('keeps the lore: never names the final threat nor puts it under the crypt', () => {
    for (const language of LANGUAGES) {
      const text = TOWN.npcs.flatMap((n) => n.lines).map((key) => catalog(language)[key] ?? '').join(' ');
      expect(text).not.toMatch(/necrozma/i);
      expect(text).not.toMatch(/duerme|sleeps/i);
    }
  });
});
