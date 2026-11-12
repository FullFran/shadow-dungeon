import { describe, expect, it } from 'vitest';
import { atCard, cardFloorShare, cardHolds, cardHpFloor, echoCards, fightOf, HOLD_HP, holdCard, isDeclaring } from '../../src/core/cards';
import { atHeraldCard } from '../../src/core/herald/brain';
import { loadRoom } from '../../src/core/rooms';
import { startRun } from '../../src/core/run';
import type { EnemyState, GameEvent, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { applyHitClaims } from '../../src/core/sync';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { behaviourFor } from '../../src/core/tricks';
import { vec } from '../../src/core/vec';
import { createWorld } from '../../src/core/world';
import { CARD_FLOOR, type CardFightDef } from '../../src/data/cards';
import type { Difficulty } from '../../src/data/difficulty';
import { ENEMY_BEHAVIOUR } from '../../src/data/enemies';
import type { RoomId } from '../../src/data/rooms';
import type { SpeciesId } from '../../src/data/species';
import { IDLE } from './helpers';

/**
 * The last card has no hold (owner, 2026-11-12: "tenemos que quitar que si
 * le das el golpe de que apenas le queda vida que no aguante. en le resto de
 * fases si"; odd/tasks/last-phase-and-timer.md S1): on a boss's last card a
 * hit that takes its remaining HP kills it, no "¡Aguanta!"; every earlier
 * card keeps its floor and hold as before. Every card boss, every tier,
 * every Sima echo stage, solo and through a guest's claim.
 */
const TIERS: readonly Difficulty[] = ['normal', 'hard', 'nightmare'];
const SPECIES = Object.keys(ENEMY_BEHAVIOUR) as SpeciesId[];
const fightAt = (s: SpeciesId, d: Difficulty): CardFightDef | undefined => fightOf(behaviourFor(s, d));
const CARD_BOSSES = SPECIES.filter((s) => TIERS.some((d) => fightAt(s, d)));

const tierWorld = (d: Difficulty): WorldState => createWorld({ seed: 1, arena: { width: 1, height: 1 }, playerPos: vec(0, 0), difficulty: d });

/** A bare boss of 1000 HP on card `index` of `fight`, its card just started (its hold as the engine sets it). */
function onCard(d: Difficulty, fight: CardFightDef, index: number): EnemyState {
  const base = loadRoom(tierWorld(d), 'boss').enemies.find((e) => e.boss)!;
  const declared = atCard({ ...base, maxHp: 1000, hp: 1000 }, fight, index);
  return holdCard(tierWorld(d), declared, fight, index, 0);
}

/** The clamp every hit path shares (core/combat.ts, core/sync.ts). */
const struck = (enemy: EnemyState, damage: number): number => Math.max(Math.min(cardHpFloor(enemy), enemy.hp), enemy.hp - damage);

describe('the last card never holds a lethal hit, on every card boss', () => {
  it('finds the card bosses (8 dungeon bosses and the Senda bosses)', () => {
    expect(CARD_BOSSES.length).toBeGreaterThanOrEqual(8 + 50);
  });

  it.each(CARD_BOSSES.map((s) => [s] as const))('%s: every tier and echo stage', (species) => {
    for (const d of TIERS) {
      const full = fightAt(species, d);
      if (!full) continue;
      const fights: [string, CardFightDef][] = [['full', full], ...([1, 2, 3] as const).map((stage) => [`echo ${stage}`, echoCards(full, stage)] as [string, CardFightDef])];
      for (const [label, fight] of fights) {
        const last = fight.cards.length - 1;
        for (const [index, card] of fight.cards.entries()) {
          const where = `${d} ${label} ${card.id} (${index}/${last})`;
          const boss = onCard(d, fight, index);
          const floor = 1000 * cardFloorShare(fight, index);
          if (index === last) {
            // A boss left with a sliver: the hit that takes it kills, with no "¡Aguanta!".
            const sliver = { ...boss, hp: 1 };
            expect(boss.boss!.holdFloor, where).toBeUndefined();
            expect(cardHpFloor(sliver), where).toBe(0);
            expect(struck(sliver, 5), where).toBeLessThanOrEqual(0);
            expect(cardHolds(sliver, 5), where).toBe(false);
          } else if (!card.survival && CARD_FLOOR[d] > 0) {
            // Earlier cards: the segment's last HP still holds early in the card.
            expect(boss.boss!.holdFloor, where).toBeCloseTo(floor + HOLD_HP, 6);
            expect(struck(boss, 1e6), where).toBeCloseTo(floor + HOLD_HP, 6);
            expect(cardHolds(boss, 1e6), where).toBe(true);
          }
        }
      }
    }
  });
});

/** Steps the world (the player untouchable) until `until` or `maxMs`. */
function runUntil(state: WorldState, id: string, until: (boss: EnemyState) => boolean, maxMs: number): WorldState {
  let w = state;
  for (let t = 0; t < maxMs && !until(w.enemies.find((e) => e.id === id)!); t += FIXED_DT_MS) {
    w = step(w, IDLE, FIXED_DT_MS);
    w = { ...w, player: { ...w.player, hp: w.player.maxHp } };
  }
  return w;
}

/** A guest's (p2) claimed hit of `damage` on boss `id`, applied by the host. */
function claim(state: WorldState, id: string, damage: number): { state: WorldState; events: GameEvent[] } {
  const next = applyHitClaims({ ...state, events: [] }, [{ id: `c${state.tick}`, playerId: 'p2', enemyId: id, damage, effectiveness: 1, hitstunMs: 0, knockback: vec(0, 0), blocked: false }]);
  return { state: next, events: next.events };
}

const ROOMS: readonly { species: SpeciesId; room: RoomId }[] = [
  { species: 'aegislash', room: 'boss' },
  { species: 'decidueye', room: 'roost' },
  { species: 'sableye', room: 'vault' },
  { species: 'trevenant', room: 'hollow' },
  { species: 'lanturn', room: 'grotto' },
  { species: 'dhelmise', room: 'wreck' },
  { species: 'salazzle', room: 'den' },
  { species: 'nihilego', room: 'rift' },
];

describe('in a fight (host step, a guest\'s claimed hit)', () => {
  for (const { species, room } of ROOMS) {
    it(`${species} on nightmare: the last card dies to a lethal hit at once; card 0 still holds`, () => {
      const f = fightAt(species, 'nightmare')!;
      const s0 = loadRoom(createWorld({ seed: 3, arena: { width: 1, height: 1 }, playerPos: vec(0, 0), difficulty: 'nightmare' }), room);
      const world = { ...s0, player: { ...s0.player, hp: 1e9, maxHp: 1e9, disguiseBroken: true } };
      const boss = world.enemies.find((e) => e.species === species)!;
      for (const index of [0, f.cards.length - 1]) {
        const at = { ...world, enemies: world.enemies.map((e) => (e.id === boss.id ? atCard(e, f, index) : e)) };
        // Into the card's play, well inside its card-floor window.
        const playing = runUntil(at, boss.id, (b) => !isDeclaring(b) && b.ai.mode !== 'idle' && (b.boss?.cardMs ?? 0) >= 2 * FIXED_DT_MS, 6000);
        const before = playing.enemies.find((e) => e.id === boss.id)!;
        expect(isDeclaring(before), `${species} card ${index} playing`).toBe(false);
        const hit = claim(playing, boss.id, before.hp + 10);
        const after = hit.state.enemies.find((e) => e.id === boss.id)!;
        if (index === 0) {
          expect(after.alive, `${species} card 0 holds`).toBe(true);
          expect(hit.events.some((e) => e.type === 'cardHold'), `${species} card 0 says so`).toBe(true);
        } else {
          expect(after.alive, `${species} last card dies`).toBe(false);
          expect(hit.events.some((e) => e.type === 'cardHold'), `${species} last card: no "¡Aguanta!"`).toBe(false);
          expect(hit.events.some((e) => e.type === 'enemyDefeated' && e.enemyId === boss.id)).toBe(true);
        }
      }
    });
  }

  it('a herald: its last card dies to a lethal hit at once; its first card still holds', { timeout: 60_000 }, () => {
    const start = startRun(4, {}, 32, 'eclipse-chasm').world;
    const world = { ...start, difficulty: 'nightmare' as const, player: { ...start.player, hp: 1e9, maxHp: 1e9 } };
    const herald = world.enemies.find((e) => e.species === 'sima-herald')!;
    for (const index of [0, 99]) {
      const at = { ...world, enemies: world.enemies.map((e) => (e.id === herald.id ? atHeraldCard(world, e, index) : e)) };
      const playing = runUntil(at, herald.id, (b) => b.ai.mode !== 'transform' && b.ai.mode !== 'idle' && (b.boss?.stanceMs ?? 0) >= 2 * FIXED_DT_MS, 8000);
      const before = playing.enemies.find((e) => e.id === herald.id)!;
      const hit = claim(playing, herald.id, before.hp + 10);
      const after = hit.state.enemies.find((e) => e.id === herald.id)!;
      expect(after.alive, `herald card ${index}`).toBe(index === 0);
      expect(hit.events.some((e) => e.type === 'cardHold'), `herald card ${index}`).toBe(index === 0);
    }
  });
});
