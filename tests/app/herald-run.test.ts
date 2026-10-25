import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { heraldCardName, heraldHere, heraldIntro, newCaptureJudge, watchCapture } from '../../src/app/herald-run';
import { coinBreakdown, emptyTally, tallyCapture } from '../../src/core/coins';
import { startRun } from '../../src/core/run';
import type { GameEvent, WorldState } from '../../src/core/state';
import { CARD_RULES } from '../../src/data/cards';
import { setLanguage } from '../../src/i18n';
import { BESTIARY_KEY, bestiaryLines, hasMet, parseBestiary, readBestiary, recordHerald } from '../../src/town/bestiary';

const floor22 = (): WorldState => startRun(5, {}, 22, 'eclipse-chasm').world;
const withStance = (w: WorldState, stance: string, alive = true): WorldState => ({
  ...w,
  enemies: w.enemies.map((e) => (e.herald ? { ...e, alive, boss: { ...e.boss!, stance: stance as never } } : e)),
});

describe('herald texts', () => {
  it('names the herald and its cards in the player\'s language', { timeout: 30_000 }, () => {
    const w = floor22();
    const here = heraldHere(w)!;
    setLanguage('en');
    expect(heraldIntro(here.def)).toEqual({ name: here.def.name, subtitle: here.def.epithet.en, lore: here.def.epigraph.en });
    expect(heraldCardName(w, here.enemy.id, 'herald0')).toBe(here.def.cards[0]!.name.en);
    setLanguage('es');
    expect(heraldCardName(w, here.enemy.id, 'herald0')).toBe(here.def.cards[0]!.name.es);
    expect(heraldCardName(w, here.enemy.id, 'awaken')).toBeNull();
    expect(heraldCardName(w, 'nobody', 'herald0')).toBeNull();
  });
});

describe('capture judge on the game screen', () => {
  it('pays a card cleared without a hit, not one with a hit, from the card on screen (guests too)', { timeout: 30_000 }, () => {
    const w = floor22();
    let judge = newCaptureJudge();
    let r = watchCapture(judge, withStance(w, 'herald0'), [], 0);
    expect(r.news).toBeNull();
    r = watchCapture(r.tracker, withStance(w, 'herald1'), [], 5000);
    expect(r.news).toEqual({ outcome: 'captured', coins: CARD_RULES.captureCoins });
    const hurt: GameEvent[] = [{ type: 'playerHurt', damage: 3 }];
    r = watchCapture(r.tracker, withStance(w, 'herald1'), hurt, 6000);
    r = watchCapture(r.tracker, withStance(w, 'awaken'), [], 7000);
    expect(r.news).toEqual({ outcome: 'cleared', coins: 0 });
    judge = r.tracker;
    // The herald falls during its last card: judged too.
    r = watchCapture(judge, withStance(w, 'herald2x'), [], 8000);
    r = watchCapture(r.tracker, withStance(w, 'herald2x', false), [], 9000);
    expect(r.news).toEqual({ outcome: 'captured', coins: CARD_RULES.captureCoins });
  });

  it('captures go to the run\'s pay (with the guardian line)', () => {
    const tally = tallyCapture(tallyCapture(emptyTally(), 6), 6);
    expect(tally.captures).toBe(12);
    expect(coinBreakdown(tally, null).guardian).toBe(12);
    expect(coinBreakdown(emptyTally(), null).guardian).toBe(0);
    expect(tallyCapture(emptyTally(), 0)).toEqual(emptyTally());
  });
});

describe('bestiary (local)', () => {
  it('remembers each herald once, counts them on the notice board, and reads broken data as none', () => {
    const store = memoryStore();
    expect(bestiaryLines(store, (k) => k)).toEqual([]);
    expect(recordHerald(store, { seed: 7, name: 'Vaelthis' })).toBe(true);
    expect(recordHerald(store, { seed: 7, name: 'Vaelthis' })).toBe(false);
    expect(recordHerald(store, { seed: 9, name: 'Ormgor' })).toBe(true);
    expect(hasMet(store, 7)).toBe(true);
    expect(hasMet(store, 8)).toBe(false);
    expect(readBestiary(store)).toEqual([
      { seed: 7, name: 'Vaelthis' },
      { seed: 9, name: 'Ormgor' },
    ]);
    expect(bestiaryLines(store, (k) => (k === 'town.board.heralds' ? 'Heraldos: {count}' : k))).toEqual(['Heraldos: 2']);
    expect(parseBestiary('not json')).toEqual([]);
    expect(parseBestiary('{"seed":1}')).toEqual([]);
    expect(parseBestiary('[{"seed":1.5,"name":"x"},{"seed":2,"name":"ok"},{"seed":3}]')).toEqual([{ seed: 2, name: 'ok' }]);
    const broken = { get: () => { throw new Error('denied'); }, set: () => { throw new Error('denied'); } };
    expect(readBestiary(broken)).toEqual([]);
    expect(recordHerald(broken, { seed: 1, name: 'x' })).toBe(true);
    expect(BESTIARY_KEY).toMatch(/^mazmorra-sombria\./);
  });
});
