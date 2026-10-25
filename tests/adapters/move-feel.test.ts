import { describe, expect, it } from 'vitest';
import type { ActionState, GameEvent, PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { MOVES, type MoveId } from '../../src/data/moves';
import { SPECIES } from '../../src/data/species';
import { POKEMON_TYPES } from '../../src/data/types';
import { SOUND_IDS, soundFor } from '../../src/adapters/audio';
import { applyEvents, initialJuice, isHeavyHit, JUICE } from '../../src/adapters/juice';
import { enemyAttackType, playerVfx } from '../../src/adapters/move-vfx';
import { TYPE_COLORS } from '../../src/ui/tokens';
import { IDLE } from '../core/helpers';

type EnemyHit = Extract<GameEvent, { type: 'enemyHit' }>;
const hit = (extra: Partial<EnemyHit> = {}): EnemyHit => ({ type: 'enemyHit', enemyId: 'e1', damage: 5, effectiveness: 1, pos: vec(0, 0), ...extra });

const press = (slot: number): PlayerInput => ({ ...IDLE, aim: vec(600, 300), slots: [slot === 0, slot === 1], slotMouse: [slot === 0, slot === 1] });

function swing(species: 'zorua' | 'cubone', loadout: [MoveId, MoveId], slot: number, ms: number): GameEvent[] {
  let state: WorldState = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300), species, loadout });
  state = spawnEnemy(state, 'aegislash', vec(428, 300), { dormant: true });
  state = { ...state, player: { ...state.player, illusionBroken: true } };
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.ceil(ms / FIXED_DT_MS); i++) {
    state = step(state, i === 0 ? press(slot) : IDLE, FIXED_DT_MS);
    events.push(...state.events);
  }
  return events;
}

describe('juice tier', () => {
  it('keeps the damage and super-effective rule', () => {
    expect(isHeavyHit(hit())).toBe(false);
    expect(isHeavyHit(hit({ damage: JUICE.heavyDamage }))).toBe(true);
    expect(isHeavyHit(hit({ effectiveness: 2 }))).toBe(true);
  });

  it('makes the last part of a multi-hit move and moves flagged heavy feel heavy', () => {
    expect(isHeavyHit(hit({ moveId: 'fury-swipes', finisher: true }))).toBe(true);
    expect(isHeavyHit(hit({ moveId: 'fury-swipes' }))).toBe(false);
    expect(isHeavyHit(hit({ moveId: 'bone-club' }))).toBe(true);
    expect(isHeavyHit(hit({ moveId: 'ember' }))).toBe(false);
    const juice = applyEvents(initialJuice(), [hit({ moveId: 'bone-club' })], vec(0, 0));
    expect(juice.hitstopMs).toBe(JUICE.heavyHitstopMs);
    expect(juice.shakeMs).toBeGreaterThan(0);
    expect(soundFor(hit({ moveId: 'bone-rush', finisher: true }))).toBe('hitHeavy');
    expect(soundFor(hit({ moveId: 'bone-rush' }))).toBe('hit');
  });

  it("leaves Mimikyu's moves on the plain damage rule", () => {
    for (const id of SPECIES.mimikyu.movepool) {
      expect(MOVES[id].juice).toBeUndefined();
      expect(isHeavyHit(hit({ moveId: id }))).toBe(false);
    }
  });

  it('tags the hits of a move with its id and only the last part of a multi-hit as the finisher', () => {
    const fury = swing('zorua', ['fury-swipes', 'night-daze'], 0, 600).filter((e): e is EnemyHit => e.type === 'enemyHit');
    expect(fury).toHaveLength(MOVES['fury-swipes'].multiHit!);
    expect(fury.every((e) => e.moveId === 'fury-swipes')).toBe(true);
    expect(fury.map((e) => Boolean(e.finisher))).toEqual([false, false, false, false, true]);
    const club = swing('cubone', ['bone-club', 'bonemerang'], 0, 600).filter((e): e is EnemyHit => e.type === 'enemyHit');
    expect(club.map((e) => [e.moveId, Boolean(e.finisher)])).toEqual([['bone-club', false]]);
  });
});

describe('type colours', () => {
  it('has a palette for every type, used by player and enemy attacks', () => {
    for (const type of POKEMON_TYPES) {
      const colours = TYPE_COLORS[type];
      expect(colours, type).toBeDefined();
      for (const value of [colours.core, colours.glow, colours.edge]) expect(value).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('names the type of each enemy attack for its telegraph tint', () => {
    let state = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(100, 100) });
    state = spawnEnemy(state, 'poochyena', vec(200, 200));
    state = spawnEnemy(state, 'gastly', vec(300, 200));
    state = spawnEnemy(state, 'aegislash', vec(400, 200));
    const [pooch, gastly, boss] = state.enemies;
    expect(enemyAttackType(pooch!)).toBe('dark');
    expect(enemyAttackType(gastly!)).toBe('poison');
    expect(enemyAttackType(boss!)).toBe('steel');
    expect(enemyAttackType({ ...boss!, boss: { ...boss!.boss!, stance: 'blade' } })).toBe('ghost');
  });
});

describe('player move VFX', () => {
  const base = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300), species: 'zorua', loadout: ['fury-swipes', 'night-daze'] }).player;
  const acting = (moveId: MoveId, phase: ActionState['phase'], phaseMs: number, extra: Partial<ActionState> = {}) => ({
    ...base,
    action: { slotIndex: 0, moveId, phase, phaseMs, chargeMs: 0, chargeLevel: 0, aimDir: vec(1, 0), mouseAim: true, hitIds: [], ...extra },
  });

  it('draws nothing while idle or winding up', () => {
    expect(playerVfx(base)).toEqual([]);
    expect(playerVfx(acting('night-daze', 'windup', 50))).toEqual([]);
  });

  it('rings a 360 move at its range and fades the ground arc of a swing', () => {
    const ring = playerVfx(acting('night-daze', 'active', MOVES['night-daze'].activeMs / 2));
    expect(ring).toEqual([expect.objectContaining({ kind: 'ring', type: 'dark' })]);
    const r = ring[0] as { radius: number; alpha: number };
    expect(r.radius).toBeGreaterThan(10);
    expect(r.radius).toBeLessThanOrEqual(40);
    const early = playerVfx(acting('bone-club', 'active', 10))[0] as { kind: string; alpha: number };
    const late = playerVfx(acting('bone-club', 'recovery', 60))[0] as { kind: string; alpha: number };
    expect(early.kind).toBe('arc');
    expect(late.alpha).toBeLessThan(early.alpha);
  });

  it('leaves a trail behind a dash and a swipe mark per part of a multi-hit', () => {
    const dash = playerVfx(acting('feint-attack', 'active', MOVES['feint-attack'].activeMs / 2));
    expect(dash[0]).toMatchObject({ kind: 'trail', type: 'dark' });
    expect((dash[0] as { length: number }).length).toBeGreaterThan(0);
    const swipes = playerVfx(acting('fury-swipes', 'active', 90, { hitWindow: 2 })).filter((v) => v.kind === 'swipe');
    expect(swipes).toHaveLength(3);
  });
});

describe('passive feedback', () => {
  const passives = ['illusion', 'flash-fire', 'battle-armor'] as const;

  it('flashes the passive that acted', () => {
    for (const passive of passives) {
      const juice = applyEvents(initialJuice(), [{ type: 'passiveTriggered', passive }], vec(0, 0));
      expect(juice.flash).toMatchObject({ kind: 'passive', passive });
    }
  });

  it('gives each starter passive its own sound', () => {
    const sounds = passives.map((passive) => soundFor({ type: 'passiveTriggered', passive }));
    for (const sound of sounds) expect(SOUND_IDS).toContain(sound);
    expect(new Set(sounds).size).toBe(passives.length);
    expect(sounds).not.toContain('disguiseBroken');
  });
});
