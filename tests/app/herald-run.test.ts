import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { heraldCardName, heraldHere, heraldIntro } from '../../src/app/herald-run';
import { updateCapture } from '../../src/core/cards';
import { coinBreakdown, emptyTally, tallyStep } from '../../src/core/coins';
import { startRun } from '../../src/core/run';
import type { GameEvent, WorldState } from '../../src/core/state';
import { CAPTURE } from '../../src/data/cards';
import { setLanguage } from '../../src/i18n';
import { BESTIARY_KEY, bestiaryLines, hasMet, parseBestiary, readBestiary, recordHerald } from '../../src/town/bestiary';

const floor22 = (): WorldState => startRun(5, {}, 22, 'eclipse-chasm').world;
/** The floor's herald in `mode` on `stance` (`attack`: the outcome a declaration carries). */
const withStance = (w: WorldState, stance: string, mode: 'approach' | 'transform' = 'approach', attack = 'herald0', alive = true): WorldState => ({
  ...w,
  player: { ...w.player, hp: 50, maxHp: 100 },
  enemies: w.enemies.map((e) => (e.herald ? { ...e, alive, boss: { ...e.boss!, stance: stance as never }, ai: { ...e.ai, mode, attack } } : e)),
});

/** Feeds one step to the shared capture judge (core/cards.ts), returning the state and the step's events. */
function judge(w: WorldState, events: GameEvent[] = []): { world: WorldState; events: GameEvent[] } {
  const out = [...events];
  return { world: updateCapture(w, out), events: out };
}

const captured = (events: readonly GameEvent[]) => events.filter((e) => e.type === 'cardCaptured');

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

describe('herald captures share the guardians\' rule (core/cards.ts updateCapture)', () => {
  it('a card broken without a hit is captured (coins and the heal), one with a hit or timed out is not', { timeout: 30_000 }, () => {
    const w = floor22();
    // The herald plays card 0; the next declaration says how it ended.
    let r = judge(withStance(w, 'herald0'));
    expect(r.world.capture?.card).toBe('herald0');
    r = judge(withStance(r.world, 'herald1', 'transform', 'broken'));
    expect(captured(r.events)).toHaveLength(1);
    expect(r.world.player.hp).toBe(50 + Math.round(100 * CAPTURE.healShare));
    // A hit during the card: no capture.
    r = judge(withStance(w, 'herald0'));
    r = judge(r.world, [{ type: 'playerHurt', damage: 3 }] as GameEvent[]);
    r = judge(withStance(r.world, 'herald1', 'transform', 'broken'));
    expect(captured(r.events)).toHaveLength(0);
    // A timeout (the awakening carries it too): no capture.
    r = judge(withStance(w, 'herald1'));
    r = judge(withStance(r.world, 'awaken', 'transform', 'timeout'));
    expect(captured(r.events)).toHaveLength(0);
    // The herald falls during its last card: captured; faded out on its timer: not.
    r = judge(withStance(w, 'herald2x'));
    expect(captured(judge(withStance(r.world, 'herald2x', 'approach', 'herald2x', false)).events)).toHaveLength(1);
    r = judge(withStance(w, 'herald2x'));
    const fade: GameEvent[] = [{ type: 'spellCardEnd', enemyId: heraldHere(w)!.enemy.id, card: 'herald2x', outcome: 'timeout' }];
    expect(captured(judge(withStance(r.world, 'herald2x', 'approach', 'herald2x', false), fade).events)).toHaveLength(0);
  });

  it('captures go to the run\'s pay with the guardian line, one reward for every card boss', () => {
    const ev = (n: number): GameEvent[] => Array.from({ length: n }, () => ({ type: 'cardCaptured', enemyId: 'h', card: 'herald0', heal: 0 }) as GameEvent);
    const tally = tallyStep(emptyTally(), { credited: [] }, { credited: [], depth: 22, events: ev(2) }, 0);
    expect(tally.captures).toBe(2);
    expect(coinBreakdown(tally, null).guardian).toBe(2 * CAPTURE.coins);
    expect(coinBreakdown(emptyTally(), null).guardian).toBe(0);
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
