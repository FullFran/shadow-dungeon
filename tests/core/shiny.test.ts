import { describe, expect, it } from 'vitest';
import { challengeShiny, hasShiny, SHINY_CHALLENGE_TIER, SHINY_LINES, shinyChallenges, unlockShiny, wearShiny, wearsShiny } from '../../src/core/shiny';
import type { Collection } from '../../src/core/collection';
import { lineOf } from '../../src/core/evolution';
import { startRun } from '../../src/core/run';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { ACHIEVEMENTS } from '../../src/data/achievements';
import { DIFFICULTIES } from '../../src/data/difficulty';
import { CHALLENGES } from '../../src/data/dungeons';
import { GACHA_POOL } from '../../src/data/gacha';
import { PLAYABLE_SPECIES } from '../../src/data/species';
import { input } from './helpers';

/** Shiny skins (odd/tasks/shiny-echo.md): per line, cosmetic only, from the gacha or a starter line's Nightmare challenge. */
const empty: Collection = { coins: 0 };
const inGacha = (line: string) => GACHA_POOL.some((p) => lineOf(p.species) === line);

describe('shiny lines', () => {
  it('every playable species belongs to a line with a skin, and every line has its achievement', () => {
    for (const species of PLAYABLE_SPECIES) expect(SHINY_LINES, species).toContain(lineOf(species));
    for (const line of SHINY_LINES) expect(ACHIEVEMENTS.some((a) => a.family === 'shiny' && a.rule.kind === 'shiny' && a.rule.line === line), line).toBe(true);
  });

  it('every line can get its skin: a gacha line from a pull, any other from its own challenge', () => {
    const viaChallenge: readonly string[] = shinyChallenges().map((d) => d.challenge!.line);
    for (const line of SHINY_LINES) expect(inGacha(line) || viaChallenge.includes(line), line).toBe(true);
    for (const line of viaChallenge) expect(inGacha(line), line).toBe(false);
  });

  it('a skin covers every form of its line, so evolving keeps it', () => {
    for (const species of PLAYABLE_SPECIES) {
      const c = unlockShiny(empty, species);
      for (const other of PLAYABLE_SPECIES) expect(hasShiny(c, other), `${species} ${other}`).toBe(lineOf(other) === lineOf(species));
      expect(wearsShiny(c, species)).toBe(true);
    }
  });

  it('can be taken off and put back on, only once unlocked', () => {
    expect(wearShiny(empty, 'zorua', true)).toBe(empty);
    const on = unlockShiny(empty, 'zoroark');
    expect(on.shinies).toEqual(['zorua']);
    const off = wearShiny(on, 'zorua', false);
    expect(wearsShiny(off, 'zoroark')).toBe(false);
    expect(hasShiny(off, 'zoroark')).toBe(true);
    expect(wearsShiny(wearShiny(off, 'zoroark', true), 'zorua')).toBe(true);
    expect(unlockShiny(on, 'zorua')).toBe(on);
  });
});

describe('the Nightmare challenge unlocks a starter line skin', () => {
  it('on every challenge: only its victory on Pesadilla, and only for the lines outside the gacha', () => {
    for (const dungeon of CHALLENGES) {
      const line = dungeon.challenge!.line;
      for (const tier of DIFFICULTIES) {
        for (const victory of [true, false]) {
          const after = challengeShiny(empty, dungeon, victory, tier);
          const expected = victory && tier === SHINY_CHALLENGE_TIER && !inGacha(line);
          expect(hasShiny(after, line), `${dungeon.id} ${tier} ${victory}`).toBe(expected);
        }
      }
    }
  });
});

describe('a skin is cosmetic', () => {
  it('for every playable species, a run with it on plays the same as with it off', () => {
    for (const species of PLAYABLE_SPECIES) {
      const play = (shiny: boolean) => {
        let { world } = startRun(7, { species, shiny });
        for (let tick = 0; tick < 120; tick++) world = step(world, input({ move: vec(Math.cos(tick / 15), Math.sin(tick / 20)), slots: [tick % 30 < 2, tick % 50 === 10], aim: vec(200, 200) }), FIXED_DT_MS);
        return world;
      };
      const on = play(true);
      const off = play(false);
      expect(on.player.shiny, species).toBe(true);
      const { shiny: _drop, ...plain } = on.player;
      expect({ ...on, player: plain }, species).toEqual(off);
    }
  });
});
