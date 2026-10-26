import { describe, expect, it } from 'vitest';
import type { EnemyState } from '../../src/core/state';
import { AIM_DRAG, dragAim, IDLE_TOUCH, slotCastMode, touchToPlayerInput, type TouchAimContext, type TouchFrame } from '../../src/adapters/touch';
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
