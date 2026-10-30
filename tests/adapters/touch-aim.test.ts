import { describe, expect, it } from 'vitest';
import type { EnemyState, PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { createWorld } from '../../src/core/world';
import { AIM_DRAG, dragAim, IDLE_TOUCH, mergeInputs, slotCastMode, touchToPlayerInput, type TouchAimContext, type TouchFrame } from '../../src/adapters/touch';
import { MOVES } from '../../src/data/moves';

const view = { x: 0, y: 0, width: 512, height: 320 };
const ctx = (o: Partial<TouchAimContext> = {}): TouchAimContext => ({ view, pixelScale: 2, playerPos: { x: 100, y: 100 }, facing: { x: 1, y: 0 }, enemies: [], lockType: 'toggle', locked: false, autoAim: true, ...o });
const frame = (o: Partial<TouchFrame> = {}): TouchFrame => ({ ...IDLE_TOUCH, ...o });

describe('drag aim from a skill button', () => {
  it('is no aim (auto-aim) while the drag stays inside the dead zone', () => {
    expect(dragAim({ x: 10, y: 10 }, { x: 10 + AIM_DRAG.deadZonePx - 1, y: 10 })).toBeNull();
  });

  it('is the unit direction of the drag past the dead zone (screen and world share axes)', () => {
    const dir = dragAim({ x: 0, y: 0 }, { x: -30, y: 40 })!;
    expect(dir.x).toBeCloseTo(-0.6);
    expect(dir.y).toBeCloseTo(0.8);
  });

  it('aims the dragged slot at a point along the drag, as a mouse-aimed move (beats auto-aim)', () => {
    const enemyAhead = { id: 'e', pos: { x: 160, y: 100 }, alive: true, radius: 10 } as unknown as EnemyState;
    const input = touchToPlayerInput(frame({ boost: true, aim: { slot: 2, dir: { x: 0, y: -1 } } }), ctx({ enemies: [enemyAhead] }));
    expect(input.aim).toEqual({ x: 100, y: 100 - AIM_DRAG.reach });
    expect(input.slotMouse).toEqual([false, false, true, false]);
    expect(input.aimPointer).toBe(false);
  });

  it('marks a held charging button as aimable before any drag (so a later drag steers the charge), aiming at the stand-in point', () => {
    const input = touchToPlayerInput(frame({ heavy: true, aim: { slot: 1, dir: null } }), ctx({ autoAim: false }));
    expect(input.aim).toEqual({ x: 164, y: 100 });
    expect(input.slotMouse).toEqual([false, true, false, false]);
  });

  it('leaves a tap (no drag) to auto-aim', () => {
    const enemyAhead = { id: 'e', pos: { x: 160, y: 100 }, alive: true, radius: 10 } as unknown as EnemyState;
    const input = touchToPlayerInput(frame({ boost: true }), ctx({ enemies: [enemyAhead] }));
    expect(input.aim).toEqual({ x: 160, y: 100 });
    expect(input.slotMouse[2]).toBe(true);
  });
});

describe('cast mode per slot', () => {
  const plain = Object.values(MOVES).find((m) => !m.charge)!;
  const charged = Object.values(MOVES).find((m) => m.charge)!;

  it('charges while held (and aims while dragged) for a move with a charge', () => {
    expect(slotCastMode(1, charged)).toBe('hold');
    expect(slotCastMode(0, charged)).toBe('hold');
  });

  it('fires the main attack on press, and the other uncharged slots on release (drag to aim first)', () => {
    expect(slotCastMode(0, plain)).toBe('press');
    expect(slotCastMode(1, plain)).toBe('release');
    expect(slotCastMode(2, plain)).toBe('release');
    expect(slotCastMode(3, plain)).toBe('release');
  });
});

describe('releasing a charged move from a touch button', () => {
  // On a phone the mouse never moved: the keyboard side of the input aims at the corner of the view.
  const idleKeys: PlayerInput = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, aimPointer: false, roll: false, slots: [false, false], slotMouse: [false, false], lock: false, click: false, wheel: 0, view };
  const playFrame = (world: WorldState, touch: TouchFrame): WorldState =>
    step(world, mergeInputs(idleKeys, touchToPlayerInput(touch, ctx({ playerPos: world.player.pos, facing: world.player.facing }))), FIXED_DT_MS);
  const chargeThenRelease = (dir: { x: number; y: number } | null): WorldState => {
    let world = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: { x: 400, y: 300 }, loadout: ['shadow-claw', 'play-rough'] });
    const holding = frame({ heavy: true, aim: { slot: 1, dir } });
    for (let i = 0; i < 5; i++) world = playFrame(world, holding);
    return playFrame(world, frame({ aim: { slot: 1, dir } }));
  };

  it.each([
    ['right', { x: 1, y: 0 }],
    ['down', { x: 0, y: 1 }],
    ['left', { x: -1, y: 0 }],
  ])('fires along the drag: %s', (_name, dir) => {
    const action = chargeThenRelease(dir).player.action;
    expect(action?.phase).toBe('windup');
    expect(action?.aimDir.x).toBeCloseTo(dir.x);
    expect(action?.aimDir.y).toBeCloseTo(dir.y);
  });

  it('an idle touch frame still leaves the aim to the mouse', () => {
    expect(mergeInputs(idleKeys, touchToPlayerInput(IDLE_TOUCH, ctx())).aim).toEqual(idleKeys.aim);
  });

  it('a press without a drag fires along the facing, not at the corner of the view', () => {
    const world = chargeThenRelease(null);
    expect(world.player.action?.aimDir).toEqual(world.player.facing);
  });
});
