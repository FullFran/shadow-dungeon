import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, TIERS, TURN_FLOOR, type Difficulty } from '../../src/data/difficulty';
import type { RoomId } from '../../src/data/rooms';
import type { SpeciesId } from '../../src/data/species';
import { atCard, fightOf, inTurn, turnMsFor } from '../../src/core/cards';
import { atHeraldCard } from '../../src/core/herald/brain';
import { loadRoom } from '../../src/core/rooms';
import type { WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { behaviourFor } from '../../src/core/tricks';
import { vec } from '../../src/core/vec';
import { createWorld } from '../../src/core/world';
import { startRun } from '../../src/core/run';
import { IDLE } from './helpers';

/**
 * "Ritmo por turnos" (docs/gdd.md): after every combo a card boss opens a
 * "tu turno" window from the tier table (data/difficulty.ts `turnMs`,
 * `TURN_FLOOR`). Inside it no new threat starts and the shots still flying
 * fade. Played on the real engine for every card of every card boss on
 * every tier.
 */

const CARD_BOSSES: readonly { species: SpeciesId; room: RoomId }[] = [
  { species: 'aegislash', room: 'boss' },
  { species: 'decidueye', room: 'roost' },
  { species: 'sableye', room: 'vault' },
  { species: 'trevenant', room: 'hollow' },
  { species: 'lanturn', room: 'grotto' },
  { species: 'dhelmise', room: 'wreck' },
  { species: 'salazzle', room: 'den' },
  { species: 'nihilego', room: 'rift' },
];
const CARD_TIERS: readonly Difficulty[] = ['normal', 'hard', 'nightmare'];

describe('tu turno: the tier table', () => {
  it('shortens with the tier (a difficulty lever), never under the floors', () => {
    const lengths = DIFFICULTIES.map((d) => TIERS[d].turnMs);
    for (let i = 1; i < lengths.length; i++) expect(lengths[i]).toBeLessThan(lengths[i - 1]!);
    for (const d of DIFFICULTIES) {
      const s = { difficulty: d };
      expect(turnMsFor(s)).toBeGreaterThanOrEqual(TURN_FLOOR.minMs);
      expect(turnMsFor(s, { lastSpell: true })).toBeGreaterThanOrEqual(TURN_FLOOR.lastSpellMinMs);
      expect(turnMsFor(s, { lastSpell: true })).toBeLessThanOrEqual(turnMsFor(s));
      expect(turnMsFor(s, { survival: true })).toBe(0);
    }
    expect(TIERS.easy.turnMs).toBe(1600);
    expect(TIERS.nightmare.turnMs).toBe(800);
    // A pact that quickens the enemies keeps the real window: longer in enemy time.
    expect(turnMsFor({ difficulty: 'hard', simaPact: { enemySpeed: 1.25 } as never })).toBeCloseTo(1250);
  });
});

interface Watch {
  turns: { atMs: number; lengthMs: number; spawned: number; hurtByNew: boolean; leftover: number }[];
  firstAttackMs: number | null;
}

/** Plays from `state` for `ms` with an unhurtable idle player and records every turn window. */
function watch(state: WorldState, ms: number): Watch {
  let current = state;
  const turns: Watch['turns'] = [];
  let open: { atMs: number; ticks: number; before: Set<string>; spawned: number } | null = null;
  let firstAttackMs: number | null = null;
  for (let i = 0; i < ms / FIXED_DT_MS; i++) {
    current = step({ ...current, player: { ...current.player, hp: current.player.maxHp } }, IDLE, FIXED_DT_MS);
    const boss = current.enemies.find((e) => e.boss)!;
    if (!boss.alive) break;
    if (firstAttackMs === null && current.events.some((e) => e.type === 'enemyAttack')) firstAttackMs = i * FIXED_DT_MS;
    const opened = current.events.find((e) => e.type === 'bossTurn');
    if (opened && !open) open = { atMs: i * FIXED_DT_MS, ticks: 0, before: new Set(current.projectiles.map((p) => p.id)), spawned: 0 };
    if (open && inTurn(boss)) {
      open.ticks++;
      open.spawned += current.projectiles.filter((p) => p.owner === 'enemy' && !open!.before.has(p.id)).length;
    } else if (open) {
      const leftover = current.projectiles.filter((p) => p.owner === 'enemy' && open!.before.has(p.id)).length;
      turns.push({ atMs: open.atMs, lengthMs: (open.ticks + 1) * FIXED_DT_MS, spawned: open.spawned, hurtByNew: false, leftover });
      open = null;
    }
  }
  return { turns, firstAttackMs };
}

function cardWorld(room: RoomId, d: Difficulty, species: SpeciesId, index: number): WorldState {
  const s = loadRoom(createWorld({ seed: 5, arena: { width: 1, height: 1 }, playerPos: vec(0, 0), difficulty: d }), room);
  const f = fightOf(behaviourFor(species, d))!;
  return { ...s, player: { ...s.player, hp: 1e9, maxHp: 1e9, disguiseBroken: true }, enemies: s.enemies.map((e) => (e.boss ? atCard(e, f, index) : e)) };
}

describe('tu turno: after every combo of every card', () => {
  for (const { species, room } of CARD_BOSSES) {
    for (const d of CARD_TIERS) {
      it(`${species} ${d}: every card opens its turn after each combo, long enough, with no new threat inside and its shots gone`, () => {
        const f = fightOf(behaviourFor(species, d))!;
        f.cards.forEach((card, index) => {
          const played = watch(cardWorld(room, d, species, index), Math.min(card.timerMs, 24_000));
          if (card.survival) {
            expect(played.turns, `${card.id} survival`).toHaveLength(0);
            return;
          }
          expect(played.turns.length, `${card.id} turns`).toBeGreaterThanOrEqual(1);
          const want = turnMsFor({ difficulty: d }, card);
          for (const t of played.turns) {
            expect(t.lengthMs, `${card.id} turn length`).toBeGreaterThanOrEqual(want);
            expect(t.spawned, `${card.id} new shots in its turn`).toBe(0);
            // Every shot from before the turn faded inside it.
            expect(t.leftover, `${card.id} shots outlive the turn`).toBe(0);
          }
          // No long stretch of combos without a turn: the first within 16 s of the card's start (its declaration included), then at most 16 s apart.
          const times = [0, ...played.turns.map((t) => t.atMs)];
          for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!, `${card.id} gap`).toBeLessThanOrEqual(16_000);
        });
      });
    }
  }

  it('a herald opens its turn after every cycle too', () => {
    const start = startRun(4, {}, 32, 'eclipse-chasm').world;
    const world: WorldState = { ...start, difficulty: 'nightmare', player: { ...start.player, hp: 1e9, maxHp: 1e9, disguiseBroken: true } };
    const withHerald: WorldState = { ...world, enemies: world.enemies.map((e) => (e.herald ? atHeraldCard(world, e, 0) : e)) };
    expect(withHerald.enemies.some((e) => e.herald)).toBe(true);
    const played = watch(withHerald, 20_000);
    expect(played.turns.length).toBeGreaterThanOrEqual(1);
    for (const t of played.turns) {
      expect(t.lengthMs).toBeGreaterThanOrEqual(turnMsFor({ difficulty: 'nightmare' }));
      expect(t.spawned).toBe(0);
    }
  });
});
