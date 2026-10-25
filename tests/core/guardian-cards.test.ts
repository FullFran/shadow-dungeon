import { describe, expect, it } from 'vitest';
import type { CardFightDef, CardStepDef } from '../../src/data/cards';
import { scaledTelegraphMs, type Difficulty } from '../../src/data/difficulty';
import type { DanmakuPattern } from '../../src/data/enemies';
import { ROOMS, type RoomId } from '../../src/data/rooms';

import { TUNING } from '../../src/data/tuning';
import { bossBar } from '../../src/core/boss';
import { cardFloorShare, cardStep, fightOf, stepAttackMs, updateCardFight } from '../../src/core/cards';
import { tickAiAt } from '../../src/core/difficulty';
import { loadRoom } from '../../src/core/rooms';
import type { GameEvent, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { behaviourFor } from '../../src/core/tricks';
import { vec, type Vec2 } from '../../src/core/vec';
import { createWorld } from '../../src/core/world';
import { catalog, LANGUAGES } from '../../src/i18n';
import { IDLE } from './helpers';
import { computeDamage } from '../../src/core/damage';
import { firePattern } from '../../src/core/danmaku';
import { hitCap, speciesMaxHpAt } from '../../src/core/fairness';
import { hitPlayer } from '../../src/core/step';
import { PLAYABLE_SPECIES, SPECIES, type SpeciesId } from '../../src/data/species';

/**
 * The guardians' spell cards (data/aegislash-cards.ts, data/decidueye-cards.ts)
 * against the fairness rules of docs/souls-difficulty-research.md P4/P5: card
 * counts per tier, telegraph floors, at most two aimed threats, the per-tier
 * knobs (never density and speed both past x1.3), the shot cap, and a safe
 * path through every card, found by simulation.
 */

const GUARDIANS: readonly { species: SpeciesId; room: RoomId }[] = [
  { species: 'aegislash', room: 'boss' },
  { species: 'decidueye', room: 'roost' },
];
const CARD_TIERS: readonly Difficulty[] = ['normal', 'hard', 'nightmare'];

const fight = (species: SpeciesId, d: Difficulty): CardFightDef | undefined => fightOf(behaviourFor(species, d));

const patternsOf = (s: CardStepDef): readonly DanmakuPattern[] => [s.pattern, ...(s.layers ?? [])];
const shotOf = (p: DanmakuPattern) => ('shot' in p ? p.shot : undefined);
const positional = (s: CardStepDef): boolean =>
  patternsOf(s).some((p) => ((p.kind === 'sweep' || p.kind === 'zone') && p.attack.pierceRoll === true) || shotOf(p)?.pierceRoll === true);

/** Aimed threats a move sends at one player at once: an aimed fan is one, turrets fire from `atOnce` places. */
const aimedThreats = (s: CardStepDef): number => patternsOf(s).reduce((n, p) => n + (p.kind === 'fan' && p.aim === 'each' ? 1 : p.kind === 'turrets' ? p.atOnce : 0), 0);

/** Shots per part (ring, fan, wave, volley): the density knob. */
function density(p: DanmakuPattern): number {
  if (p.kind === 'rings') return p.perRing - p.gap;
  if (p.kind === 'spiral') return p.arms;
  if (p.kind === 'fan') return p.perFan;
  if (p.kind === 'turrets') return p.atOnce * p.perVolley;
  if (p.kind === 'lanes' || p.kind === 'walls') return 1000 / p.spacing - p.gapWidth / p.spacing;
  return 1;
}

describe('guardian spell cards: structure per tier', () => {
  for (const { species } of GUARDIANS) {
    it(`${species}: easy keeps the shipped fight; normal and harder fight with cards`, () => {
      expect(fight(species, 'easy')).toBeUndefined();
      for (const d of CARD_TIERS) expect(fight(species, d)?.cards.length ?? 0).toBeGreaterThanOrEqual(3);
    });

    it(`${species}: survival cards only from hard (one at most), nightmare adds cards and closes on a last spell`, () => {
      const survivals = (d: Difficulty) => fight(species, d)!.cards.filter((c) => c.survival).length;
      expect(survivals('normal')).toBe(0);
      expect(survivals('hard')).toBe(1);
      expect(survivals('nightmare')).toBe(1);
      const hard = fight(species, 'hard')!.cards;
      const nightmare = fight(species, 'nightmare')!.cards;
      expect(nightmare.length - hard.length).toBeGreaterThanOrEqual(1);
      expect(nightmare.length - hard.length).toBeLessThanOrEqual(2);
      expect(nightmare.at(-1)!.lastSpell).toBe(true);
      expect(cardFloorShare(fight(species, 'nightmare')!, nightmare.length - 2)).toBeLessThanOrEqual(0.15);
      // Every tier's shares cover the whole bar, and every card has a timer.
      for (const d of CARD_TIERS) {
        const cards = fight(species, d)!.cards;
        expect(cards.reduce((s, c) => s + c.hpShare, 0)).toBeCloseTo(1);
        expect(cards.every((c) => c.timerMs >= 15_000)).toBe(true);
        expect(cards.filter((c) => c.survival).every((c) => c.hpShare === 0 && c.timerMs <= 20_000)).toBe(true);
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

    it(`${species}: every wind-up keeps its floor once scaled (400 ms for positional ones, 280 ms otherwise)`, () => {
      for (const d of CARD_TIERS) {
        for (const card of fight(species, d)!.cards) {
          for (const s of card.steps) {
            const floor = positional(s) ? 400 : 280;
            expect(scaledTelegraphMs(s.telegraphMs, d), `${d} ${card.id}`).toBeGreaterThanOrEqual(floor);
            expect(s.recoverMs, `${d} ${card.id} opening`).toBeGreaterThanOrEqual(600);
            // A mark that stops following leaves a choice window of 400 ms once the tier's clock speeds it up.
            if (s.pattern.kind === 'zone' && s.pattern.at === 'target') expect((s.pattern.lockMs * scaledTelegraphMs(s.telegraphMs, d)) / s.telegraphMs, `${d} ${card.id} lock`).toBeGreaterThanOrEqual(400);
          }
        }
      }
    });

    it(`${species}: never more than two aimed threats at a player, and at most three layers`, () => {
      for (const d of CARD_TIERS) {
        for (const card of fight(species, d)!.cards) {
          for (const s of card.steps) {
            expect(aimedThreats(s), `${d} ${card.id}`).toBeLessThanOrEqual(2);
            expect(patternsOf(s).length, `${d} ${card.id}`).toBeLessThanOrEqual(3);
          }
        }
      }
    });

    it(`${species}: the same card on a harder tier gains density, speed or layers, never density and speed both past x1.3`, () => {
      const base = fight(species, 'normal')!;
      let changed = 0;
      for (const d of ['hard', 'nightmare'] as const) {
        for (const card of fight(species, d)!.cards) {
          const was = base.cards.find((c) => c.id === card.id);
          if (!was) continue;
          card.steps.forEach((s, i) => {
            const old = was.steps[i]!;
            const dens = density(s.pattern) / density(old.pattern);
            const speed = (shotOf(s.pattern)?.speed ?? 1) / (shotOf(old.pattern)?.speed ?? 1);
            expect(dens > 1.3 && speed > 1.3, `${d} ${card.id} step ${i}`).toBe(false);
            expect(dens, `${d} ${card.id} density cap`).toBeLessThanOrEqual(2);
            expect(speed, `${d} ${card.id} speed cap`).toBeLessThanOrEqual(1.3);
            if (dens > 1 || speed > 1 || patternsOf(s).length > patternsOf(old).length) changed++;
          });
        }
      }
      expect(changed).toBeGreaterThan(0);
    });
  }
});

describe('guardian spell cards: damage per tier', () => {
  for (const { species } of GUARDIANS) {
    it(`${species}: hits harder on hard and nightmare (moderately), normal as the data says`, () => {
      expect(fight(species, 'normal')!.power).toBe(1);
      expect(fight(species, 'hard')!.power).toBeGreaterThan(1);
      expect(fight(species, 'nightmare')!.power).toBeGreaterThan(fight(species, 'hard')!.power);
      expect(fight(species, 'nightmare')!.power).toBeLessThanOrEqual(1.3);
    });

    it(`${species}: the card's power is in every shot it fires, and no landed hit passes the one-hit cap`, () => {
      const f = fight(species, 'nightmare')!;
      const state = loadRoom(createWorld({ seed: 2, arena: { width: 1, height: 1 }, playerPos: vec(0, 0), difficulty: 'nightmare' }), species === 'aegislash' ? 'boss' : 'roost');
      const boss = state.enemies[0]!;
      const ring = { kind: 'rings' as const, rings: 1, perRing: 8, gap: 2, gapTurnDeg: 0, gapMs: 100, shot: { power: 20, type: 'steel' as const, speed: 100, radius: 6, lifetimeMs: 1000 } };
      const fired = firePattern(state, boss, 100, ring, 0, f.power).projectiles.filter((p) => p.owner === 'enemy');
      expect(fired.length).toBe(6);
      expect(fired.every((p) => p.power === Math.round(20 * f.power))).toBe(true);
      // The strongest card hit, on every starter at level 1: capped at 35 % of the reference max HP (core/fairness.ts).
      const strongest = Math.max(...f.cards.flatMap((c) => c.steps.flatMap((s) => patternsOf(s).map((p) => ('shot' in p ? p.shot.power : p.attack.power)))));
      for (const playable of PLAYABLE_SPECIES) {
        const victim = { ...state, player: { ...state.player, species: playable, maxHp: SPECIES[playable].maxHp, hp: SPECIES[playable].maxHp, disguiseBroken: true } };
        const { damage } = computeDamage({ power: strongest * f.power, moveType: 'ghost', attackerTypes: SPECIES[species].types, defenderTypes: SPECIES[playable].types });
        const hit = hitPlayer(victim, { damage, type: 'ghost' });
        expect(SPECIES[playable].maxHp - hit.player.hp, playable).toBeLessThanOrEqual(hitCap(speciesMaxHpAt(playable, victim.referenceLevel ?? 1)));
      }
    });
  }
});

// --- Fairness by simulation ---------------------------------------------------

const CELL = 12;
const FRAME_TICKS = 6;
const PLAYER_R = TUNING.player.radius;

interface Field {
  cols: number;
  rows: number;
  /** Per frame (FRAME_TICKS steps): cells a player standing there would be hit in. */
  frames: Uint8Array[];
  startCell: number;
  peakShots: number;
}

/**
 * Plays card `index` of fight `f` on a still player (at the room's start, or
 * `at`), the boss's card engine alone (its shots fly, the player is never
 * hit), and records where shots go. `bare` drops the room's obstacles.
 */
function simulate(room: RoomId, d: Difficulty, f: CardFightDef, index: number, ms: number, at?: Vec2, bare = false): Field {
  let state = loadRoom(createWorld({ seed: 7, arena: { width: 1, height: 1 }, playerPos: vec(0, 0), difficulty: d }), room);
  if (bare) state = { ...state, arena: { ...state.arena, obstacles: [] } };
  if (at) state = { ...state, player: { ...state.player, pos: at } };
  const boss = state.enemies[0]!;
  const card = f.cards[index]!;
  const hpFloor = boss.maxHp * cardFloorShare(f, index);
  state = {
    ...state,
    player: { ...state.player, hp: 1e9, maxHp: 1e9, disguiseBroken: true },
    enemies: [{ ...boss, hp: hpFloor + boss.maxHp * 0.5, boss: { ...boss.boss!, stance: card.id, card: index, cardMs: 0, hpFloor, comboIndex: 0, combosDone: 0 }, ai: { ...boss.ai, mode: 'approach', cooldownMs: 300 } }],
  };
  const { width, height, obstacles = [] } = state.arena;
  const cols = Math.floor(width / CELL);
  const rows = Math.floor(height / CELL);
  const blockedStatic = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * CELL;
      const y = (r + 0.5) * CELL;
      const edge = x < PLAYER_R || y < PLAYER_R || x > width - PLAYER_R || y > height - PLAYER_R;
      const solid = obstacles.some((o) => x > o.x - PLAYER_R && x < o.x + o.width + PLAYER_R && y > o.y - PLAYER_R && y < o.y + o.height + PLAYER_R);
      if (edge || solid) blockedStatic[r * cols + c] = 1;
    }
  }
  const start = state.player.pos;
  const startCell = Math.floor(start.y / CELL) * cols + Math.floor(start.x / CELL);
  const frames: Uint8Array[] = [];
  let frame = Uint8Array.from(blockedStatic);
  let peakShots = 0;
  const mark = (x: number, y: number, reach: number) => {
    const r0 = Math.max(0, Math.floor((y - reach) / CELL));
    const r1 = Math.min(rows - 1, Math.floor((y + reach) / CELL));
    const c0 = Math.max(0, Math.floor((x - reach) / CELL));
    const c1 = Math.min(cols - 1, Math.floor((x + reach) / CELL));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (Math.hypot((c + 0.5) * CELL - x, (r + 0.5) * CELL - y) <= reach) frame[r * cols + c] = 1;
  };
  const ticks = Math.ceil(ms / FIXED_DT_MS);
  for (let t = 0; t < ticks; t++) {
    const events: GameEvent[] = [];
    const e = state.enemies[0]!;
    if (e.alive) state = updateCardFight(state, { ...e, ai: tickAiAt(e.ai, FIXED_DT_MS, d) }, f, state.player.pos, FIXED_DT_MS, events);
    const dt = FIXED_DT_MS / 1000;
    const moved = state.projectiles
      .map((p) => ({ ...p, pos: vec(p.pos.x + p.vel.x * dt, p.pos.y + p.vel.y * dt), remainingMs: p.remainingMs - FIXED_DT_MS }))
      .filter((p) => p.remainingMs > 0 && p.pos.x > -p.radius && p.pos.y > -p.radius && p.pos.x < width + p.radius && p.pos.y < height + p.radius)
      .filter((p) => !obstacles.some((o) => o.cover && p.pos.x > o.x && p.pos.x < o.x + o.width && p.pos.y > o.y && p.pos.y < o.y + o.height));
    state = { ...state, projectiles: moved };
    const shots = moved.filter((p) => p.owner === 'enemy');
    peakShots = Math.max(peakShots, shots.length);
    for (const p of shots) mark(p.pos.x, p.pos.y, p.radius + PLAYER_R + 1);
    // The melee moves (a sweep around the boss, a bursting zone) while they strike.
    const b = state.enemies[0]!;
    const s = cardStep(f, b);
    if (b.ai.mode === 'attack' && s && (s.pattern.kind === 'sweep' || s.pattern.kind === 'zone')) {
      const at = s.pattern.kind === 'zone' && s.pattern.at === 'target' ? (b.ai.aimPoint ?? b.pos) : b.pos;
      mark(at.x, at.y, s.pattern.radius + PLAYER_R + 1);
    }
    if ((t + 1) % FRAME_TICKS === 0) {
      frames.push(frame);
      frame = Uint8Array.from(blockedStatic);
    }
  }
  return { cols, rows, frames, startCell, peakShots };
}

/** Whether a player starting on the start cell can stay out of every hit, moving at most one cell (12 px) a frame (100 ms: 120 px/s, under the walk speed). */
function safePath(field: Field): { ok: boolean; worst: number; atFrame: number } {
  const { cols, rows, frames } = field;
  let reach = new Uint8Array(cols * rows);
  if (frames[0]![field.startCell]) return { ok: false, worst: 0, atFrame: 0 };
  reach[field.startCell] = 1;
  let worst = Infinity;
  for (let f = 1; f < frames.length; f++) {
    const unsafe = frames[f]!;
    const next = new Uint8Array(cols * rows);
    let count = 0;
    for (let i = 0; i < reach.length; i++) {
      if (!reach[i]) continue;
      const c = i % cols;
      for (const j of [i, c > 0 ? i - 1 : -1, c < cols - 1 ? i + 1 : -1, i - cols, i + cols]) {
        if (j < 0 || j >= next.length || next[j] || unsafe[j]) continue;
        next[j] = 1;
        count++;
      }
    }
    if (count === 0) return { ok: false, worst: 0, atFrame: f };
    worst = Math.min(worst, count);
    reach = next;
  }
  return { ok: true, worst, atFrame: frames.length };
}

/** Spots in the shelter of each cover block (just past the middle of each side): where a safespot would hide. */
function coverSpots(room: RoomId): Vec2[] {
  const out: Vec2[] = [];
  for (const o of ROOMS[room].obstacles.filter((b) => b.cover)) {
    const cx = o.x + o.width / 2;
    const cy = o.y + o.height / 2;
    const gap = PLAYER_R + 6;
    out.push(vec(cx, o.y - gap), vec(cx, o.y + o.height + gap), vec(o.x - gap, cy), vec(o.x + o.width + gap, cy));
  }
  return out;
}

/** One whole loop of a card's moves (with their rests), plus time for the last shots to land; at most 14 s. */
function loopMs(f: CardFightDef, index: number): number {
  const card = f.cards[index]!;
  const loop = card.steps.reduce((sum, s) => sum + s.telegraphMs + stepAttackMs(s) + s.recoverMs + card.restMs, 400);
  return Math.min(14_000, Math.min(card.timerMs, loop + 2500));
}

describe('guardian spell cards: a safe path through every card (simulation)', () => {
  for (const { species, room } of GUARDIANS) {
    for (const d of CARD_TIERS) {
      const f = fight(species, d)!;
      f.cards.forEach((card, index) => {
        it(`${species} ${d} ${card.id}: dense, never a wall without a way through, no safe spot to stand still by the cover, under the shot cap`, () => {
          const ms = loopMs(f, index);
          const field = simulate(room, d, f, index, ms);
          const path = safePath(field);
          expect(path.ok, `no way through at frame ${path.atFrame}`).toBe(true);
          // Standing still on the start cell gets hit at some point: the card makes the player move.
          expect(field.frames.some((fr) => fr[field.startCell] === 1)).toBe(true);
          expect(field.peakShots).toBeLessThanOrEqual(f.maxShots);
          expect(field.peakShots).toBeGreaterThan(15);
          // No safespot (Touhou's flaw): a player standing still in the shelter of any cover block is hit at some point of the card.
          for (const spot of coverSpots(room)) {
            const there = simulate(room, d, f, index, ms, spot);
            expect(there.frames.some((fr) => fr[there.startCell] === 1), `safe spot at ${spot.x},${spot.y}`).toBe(true);
          }
        });
      });
    }
  }
});

describe('guardian spell cards: the fairness check can fail', () => {
  const shot = { power: 10, type: 'ghost' as const, speed: 140, radius: 7, lifetimeMs: 6000 };
  const curtain = (gapWidth: number): CardFightDef => ({
    ...fight('aegislash', 'normal')!,
    cards: [{ id: 'sc-test-curtain', nameKey: 'x', hpShare: 1, timerMs: 30_000, restMs: 400, steps: [{ telegraphMs: 600, recoverMs: 600, pattern: { kind: 'lanes', waves: 5, gapMs: 700, spacing: 24, gapWidth, shiftPx: 80, shot } }] }],
  });

  it('a curtain without a gap in a bare room has no way through; with a gap it has one', () => {
    expect(safePath(simulate('boss', 'normal', curtain(0), 0, 8000, undefined, true)).ok).toBe(false);
    expect(safePath(simulate('boss', 'normal', curtain(110), 0, 8000, undefined, true)).ok).toBe(true);
  });

  it('a one-way curtain leaves a safespot in a pillar\'s shadow (the check finds it)', () => {
    const sheltered = coverSpots('boss').filter((spot) => {
      const field = simulate('boss', 'normal', curtain(110), 0, 8000, spot);
      return field.frames.every((fr) => fr[field.startCell] === 0);
    });
    expect(sheltered.length).toBeGreaterThan(0);
  });
});

describe('guardian spell cards: in a run', () => {
  function throne(d: Difficulty | undefined): WorldState {
    const state = loadRoom(createWorld({ seed: 3, arena: { width: 1, height: 1 }, playerPos: vec(0, 0), ...(d ? { difficulty: d } : {}) }), 'boss');
    return { ...state, player: { ...state.player, hp: 1e9, maxHp: 1e9, disguiseBroken: true } };
  }
  const runFor = (state: WorldState, ms: number) => {
    let current = state;
    for (let i = 0; i < ms / FIXED_DT_MS; i++) current = step({ ...current, player: { ...current.player, hp: current.player.maxHp } }, IDLE, FIXED_DT_MS);
    return current;
  };

  it('Aegislash on normal declares its first card on sight; the bar shows the segments and the clock', () => {
    const played = runFor(throne('normal'), 2000);
    const boss = played.enemies[0]!;
    expect(boss.boss!.stance).toBe('sc-aeg-walls');
    const bar = bossBar(played)!;
    expect(bar.segments).toHaveLength(3);
    expect(bar.segments![0]).toBeCloseTo(boss.maxHp * 0.75);
    expect(bar.cardLeftMs).toBeGreaterThan(0);
  });

  it('Decidueye on hard declares its first card in the roost; easy keeps its shipped cards', () => {
    const roost = (d: Difficulty | undefined) => {
      const state = loadRoom(createWorld({ seed: 3, arena: { width: 1, height: 1 }, playerPos: vec(0, 0), ...(d ? { difficulty: d } : {}) }), 'roost');
      return { ...state, player: { ...state.player, hp: 1e9, maxHp: 1e9, disguiseBroken: true } };
    };
    expect(runFor(roost('hard'), 1500).enemies[0]!.boss!.stance).toBe('sc-dec-volley');
    expect(['volley', 'fan', 'dive']).toContain(runFor(roost(undefined), 1500).enemies[0]!.boss!.stance);
  });

  it('Aegislash on easy keeps the stance duel (no cards, no segments)', () => {
    const played = runFor(throne(undefined), 2000);
    expect(['shield', 'blade']).toContain(played.enemies[0]!.boss!.stance);
    expect(bossBar(played)!.segments).toBeUndefined();
  });

  it('a Sima echo of Aegislash keeps the lighter duel on every tier', () => {
    const echo = { ...throne('nightmare'), enemyScale: { hp: 1, damage: 1, echo: true as const } };
    const played = runFor(echo, 2000);
    expect(['shield', 'blade']).toContain(played.enemies[0]!.boss!.stance);
  });
});
