import { describe, expect, it } from 'vitest';
import type { CardFightDef } from '../../src/data/cards';
import type { Difficulty } from '../../src/data/difficulty';
import { ENEMY_BEHAVIOUR } from '../../src/data/enemies';
import type { RoomId } from '../../src/data/rooms';
import type { SpeciesId } from '../../src/data/species';
import { bossBar } from '../../src/core/boss';
import { atCard, cardFloorShare, fightOf, isDeclaring, spellOf } from '../../src/core/cards';
import { loadRoom } from '../../src/core/rooms';
import type { EnemyState, GameEvent, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { behaviourFor } from '../../src/core/tricks';
import { vec } from '../../src/core/vec';
import { createWorld } from '../../src/core/world';
import { catalog, LANGUAGES } from '../../src/i18n';
import { IDLE } from './helpers';

/**
 * The six bosses that had their own card cycles, as hosted spell cards on
 * Normal and harder (data/hosted-cards.ts, core/cards.ts
 * `updateHostedCardFight`): the same shape per tier as the guardians, moves
 * the boss's own engine already knows, and the framework's segment, timer,
 * declaration, capture and end on top of the unchanged patterns.
 */

export const HOSTED: readonly { species: SpeciesId; room: RoomId; guardian: boolean }[] = [
  { species: 'sableye', room: 'vault', guardian: false },
  { species: 'trevenant', room: 'hollow', guardian: false },
  { species: 'lanturn', room: 'grotto', guardian: false },
  { species: 'dhelmise', room: 'wreck', guardian: true },
  { species: 'salazzle', room: 'den', guardian: false },
  { species: 'nihilego', room: 'rift', guardian: true },
];
const CARD_TIERS: readonly Difficulty[] = ['normal', 'hard', 'nightmare'];
const fight = (species: SpeciesId, d: Difficulty): CardFightDef | undefined => fightOf(behaviourFor(species, d));

/** The moves a boss's own engine knows by name. */
function knownMoves(species: SpeciesId): string[] {
  const def = ENEMY_BEHAVIOUR[species]!;
  const names = 'cardNames' in def ? Object.keys(def.cardNames) : [];
  return 'patterns' in def ? [...names, ...Object.keys(def.patterns)] : names;
}

function arena(room: RoomId, d: Difficulty | undefined): WorldState {
  const state = loadRoom(createWorld({ seed: 3, arena: { width: 1, height: 1 }, playerPos: vec(0, 0), ...(d ? { difficulty: d } : {}) }), room);
  return { ...state, player: { ...state.player, hp: 1e9, maxHp: 1e9, disguiseBroken: true } };
}

const immortal = (s: WorldState): WorldState => ({ ...s, player: { ...s.player, hp: s.player.maxHp } });

function runUntil(state: WorldState, until: (s: WorldState, events: readonly GameEvent[]) => boolean, maxMs: number): { state: WorldState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < maxMs / FIXED_DT_MS; i++) {
    current = step(immortal(current), IDLE, FIXED_DT_MS);
    events.push(...current.events);
    if (until(current, current.events)) break;
  }
  return { state: current, events };
}

const bossOf = (s: WorldState): EnemyState => s.enemies.find((e) => e.boss)!;

describe('hosted spell cards: structure per tier', () => {
  for (const { species, guardian } of HOSTED) {
    it(`${species}: easy keeps its own fight; normal and harder fight with hosted cards`, () => {
      expect(behaviourFor(species, 'easy')).toBe(ENEMY_BEHAVIOUR[species]);
      for (const d of CARD_TIERS) expect(fight(species, d)?.cards.length ?? 0).toBeGreaterThanOrEqual(guardian ? 4 : 2);
    });

    it(`${species}: survival cards only from hard (one), nightmare adds cards and closes on a last spell of at most 15 %`, () => {
      const survivals = (d: Difficulty) => fight(species, d)!.cards.filter((c) => c.survival).length;
      expect(survivals('normal')).toBe(0);
      expect(survivals('hard')).toBe(1);
      expect(survivals('nightmare')).toBe(1);
      const hard = fight(species, 'hard')!.cards;
      const nightmare = fight(species, 'nightmare')!.cards;
      expect(nightmare.length - hard.length).toBeGreaterThanOrEqual(1);
      expect(nightmare.length - hard.length).toBeLessThanOrEqual(2);
      expect(nightmare.at(-1)!.lastSpell).toBe(true);
      expect(cardFloorShare(fight(species, 'nightmare')!, nightmare.length - 2)).toBeLessThanOrEqual(0.15 + 1e-9);
      for (const d of CARD_TIERS) {
        const cards = fight(species, d)!.cards;
        expect(cards.reduce((s, c) => s + c.hpShare, 0)).toBeCloseTo(1);
        expect(cards.every((c) => c.timerMs >= 12_000)).toBe(true);
        expect(cards.filter((c) => c.survival).every((c) => c.hpShare === 0 && c.timerMs <= 20_000)).toBe(true);
        // The survival card is never the first or the last.
        expect(cards[0]!.survival).toBeUndefined();
        expect(cards.at(-1)!.survival).toBeUndefined();
      }
    });

    it(`${species}: every card plays only moves its own engine knows, and only moves it already plays at that tier`, () => {
      const known = knownMoves(species);
      for (const d of CARD_TIERS) {
        for (const card of fight(species, d)!.cards) {
          expect(card.steps).toEqual([]);
          expect(card.moves!.length).toBeGreaterThan(0);
          for (const move of card.moves!) expect(known, `${d} ${card.id} ${move}`).toContain(move);
        }
      }
    });

    it(`${species}: every card has a full name (the banner) and a short one (the bar) in every language`, () => {
      for (const d of CARD_TIERS) {
        for (const card of fight(species, d)!.cards) {
          for (const lang of LANGUAGES) {
            expect(catalog(lang)[card.nameKey], `${lang} ${card.nameKey}`).toBeTruthy();
            expect(catalog(lang)[`boss.stance.${card.id}`], `${lang} ${card.id}`).toBeTruthy();
          }
        }
      }
    });

    if (guardian) {
      it(`${species}: its awakening is a phase-2 card (the longer declaration) in the middle of the fight`, () => {
        for (const d of CARD_TIERS) {
          const cards = fight(species, d)!.cards;
          const at = cards.findIndex((c) => c.phase2);
          expect(at, d).toBeGreaterThan(0);
          expect(at, d).toBeLessThan(cards.length - 1);
        }
      });
    }
  }
});

describe('hosted spell cards: in a run', () => {
  for (const { species, room } of HOSTED) {
    it(`${species} on normal declares its first card on sight, then plays that card's first move with its own engine`, () => {
      const f = fight(species, 'normal')!;
      const declared = runUntil(arena(room, 'normal'), (s) => isDeclaring(bossOf(s)), 5000).state;
      expect(bossOf(declared).boss!.stance).toBe(f.cards[0]!.id);
      // Invulnerable while it declares.
      expect(bossBar(declared)!.stance).toBe(f.cards[0]!.id);
      const played = runUntil(declared, (s) => !isDeclaring(bossOf(s)), 5000).state;
      const boss = bossOf(played).boss!;
      expect(boss.spell).toBe(f.cards[0]!.id);
      const opening = species === 'trevenant' ? 'slam' : f.cards[0]!.moves![0];
      expect(boss.stance).toBe(opening);
      // The bar reads the card, its notches and its clock.
      const bar = bossBar(played)!;
      expect(bar.stance).toBe(f.cards[0]!.id);
      expect(bar.segments).toHaveLength(f.cards.length - 1);
      expect(bar.cardLeftMs).toBeGreaterThan(0);
    });

    it(`${species} on nightmare: breaking a segment ends the card (shots cleared) and declares the next; the last card timing out fells it`, () => {
      const f = fight(species, 'nightmare')!;
      const start = runUntil(arena(room, 'nightmare'), (s) => bossOf(s).ai.mode !== 'idle' && !isDeclaring(bossOf(s)), 8000).state;
      const boss = bossOf(start);
      // Down to the first card's floor: the card is broken.
      const hurt = { ...start, enemies: start.enemies.map((e) => (e.id === boss.id ? { ...e, hp: boss.boss!.hpFloor! } : e)) };
      const broken = runUntil(hurt, (_s, ev) => ev.some((e) => e.type === 'spellCardEnd'), 200);
      const end = broken.events.find((e) => e.type === 'spellCardEnd');
      expect(end).toMatchObject({ card: f.cards[0]!.id, outcome: 'broken' });
      expect(broken.state.projectiles.filter((p) => p.owner === 'enemy')).toHaveLength(0);
      expect(bossOf(broken.state).boss!.stance).toBe(f.cards[1]!.id);
      expect(isDeclaring(bossOf(broken.state))).toBe(true);
      // The last spell, out of time: the boss falls with no damage dealt.
      const last = { ...start, enemies: start.enemies.map((e) => (e.id === boss.id ? atCard(e, f, f.cards.length - 1) : e)) };
      const out = runUntil(last, (s) => !bossOf(s).alive, f.cards.at(-1)!.timerMs + 4000);
      expect(bossOf(out.state).alive).toBe(false);
      expect(out.events.find((e) => e.type === 'spellCardEnd')).toMatchObject({ outcome: 'timeout' });
    });
  }

  it('a phase-2 card puts its engine in phase 2 for good; the boss never awakens on its own', () => {
    for (const { species, room } of HOSTED.filter((h) => h.guardian)) {
      const f = fight(species, 'normal')!;
      const s0 = arena(room, 'normal');
      const at = f.cards.findIndex((c) => c.phase2);
      // The first card with its floor taken away and the boss at 30 %: its own awakening threshold (50 %) is long passed.
      const low = { ...s0, enemies: s0.enemies.map((e) => { if (!e.boss) return e; const c = atCard(e, f, 0); return { ...c, hp: e.maxHp * 0.3, boss: { ...c.boss!, hpFloor: 0 } }; }) };
      const early = runUntil(low, () => false, 6000);
      expect(early.events.some((e) => e.type === 'bossStance' && (e.stance === 'awaken' || e.stance === 'ultra')), species).toBe(false);
      expect(bossOf(early.state).boss!.phase, species).toBeUndefined();
      const p2 = { ...s0, enemies: s0.enemies.map((e) => (e.boss ? atCard(e, f, at) : e)) };
      const played = runUntil(p2, (s) => !isDeclaring(bossOf(s)), 4000).state;
      expect(bossOf(played).boss!.phase, species).toBe(2);
      expect(bossOf(played).boss!.stance, species).toBe(f.cards[at]!.moves![0]);
    }
  });

  it('a hosted card is captured like any other (no hit through it), and guests read the card from the snapshot', () => {
    const f = fight('lanturn', 'normal')!;
    const s0 = arena('grotto', 'normal');
    const playing = runUntil(s0, (s) => spellOf(bossOf(s).boss) !== undefined && !isDeclaring(bossOf(s)), 6000).state;
    expect(playing.capture?.card).toBe(f.cards[0]!.id);
    const guest = applyHostSnapshot({ ...createWorld({ seed: 3, arena: playing.arena, playerPos: vec(0, 0), localId: 'p2', role: 'guest', difficulty: 'normal' }) }, hostSnapshot(playing));
    const seen = guest.enemies.find((e) => e.boss)!;
    expect(spellOf(seen.boss)).toBe(f.cards[0]!.id);
    expect(bossBar(guest)!.stance).toBe(f.cards[0]!.id);
    // Broken with the player untouched: captured.
    const boss = bossOf(playing);
    const hurt: WorldState = { ...playing, projectiles: [], enemies: playing.enemies.map((e) => (e.id === boss.id ? { ...e, hp: boss.boss!.hpFloor! } : e)) };
    let current: WorldState = hurt;
    let captured = false;
    for (let i = 0; i < 20 && !captured; i++) {
      current = step(current, IDLE, FIXED_DT_MS);
      captured = current.events.some((e) => e.type === 'cardCaptured' && e.card === f.cards[0]!.id);
    }
    expect(captured).toBe(true);
  });

  it("Salazzle's court leaves with the card: no Salandit outlives a card's end", () => {
    const f = fight('salazzle', 'nightmare')!;
    const s0 = arena('den', 'nightmare');
    const last = { ...s0, enemies: s0.enemies.map((e) => (e.boss ? atCard(e, f, f.cards.length - 1) : e)) };
    const called = runUntil(last, (s) => s.enemies.some((e) => e.alive && e.species === 'salandit'), 20_000).state;
    expect(called.enemies.some((e) => e.alive && e.species === 'salandit')).toBe(true);
    const out = runUntil(called, (s) => !bossOf(s).alive, f.cards.at(-1)!.timerMs + 2000).state;
    expect(out.enemies.filter((e) => e.alive && e.species === 'salandit')).toHaveLength(0);
  });
});
