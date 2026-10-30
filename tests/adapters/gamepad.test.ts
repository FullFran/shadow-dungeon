import { describe, expect, it } from 'vitest';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import type { PlayerInput, WorldState } from '../../src/core/state';
import { createWorld } from '../../src/core/world';
import { KEY_REPEAT, keyEmitter, keyOf, PAD, padCombatKeys, padFrame, padKeys, padMemory, readPad, type PadMemory, type PadState } from '../../src/adapters/gamepad';
import { IDLE_TOUCH, mergeInputs, touchToPlayerInput, type TouchAimContext, type TouchFrame } from '../../src/adapters/touch';

const pad = (buttons: number[] = [], axes: number[] = [0, 0, 0, 0]): PadState => ({ axes, pressed: new Set(buttons) });
const frameOf = (state: PadState, memory: PadMemory = padMemory(null)) => padFrame(state, memory);

describe('reading a controller', () => {
  it('counts a button pressed, or a trigger pulled past half', () => {
    const state = readPad({ axes: [0.5], buttons: [{ pressed: true, value: 1 }, { pressed: false, value: 0 }, { pressed: false, value: 0.8 }, { pressed: false, value: 0.3 }] });
    expect([...state.pressed]).toEqual([0, 2]);
    expect(state.axes).toEqual([0.5]);
  });
});

describe('outside combat the pad acts as keys', () => {
  it('the D-pad and the stick are arrows, a slight lean is nothing', () => {
    expect([...padKeys(pad([PAD.up]))]).toEqual(['ArrowUp']);
    expect([...padKeys(pad([PAD.down]))]).toEqual(['ArrowDown']);
    expect([...padKeys(pad([PAD.left]))]).toEqual(['ArrowLeft']);
    expect([...padKeys(pad([PAD.right]))]).toEqual(['ArrowRight']);
    expect([...padKeys(pad([], [0.9, 0, 0, 0]))]).toEqual(['ArrowRight']);
    expect([...padKeys(pad([], [0, -0.9, 0, 0]))]).toEqual(['ArrowUp']);
    expect([...padKeys(pad([], [0.3, 0.3, 0, 0]))]).toEqual([]);
  });
  it('A confirms, B and Start go back, Back is the minimap, and X, Y and RB pick an item', () => {
    expect([...padKeys(pad([PAD.a]))]).toEqual(['Enter']);
    expect([...padKeys(pad([PAD.b]))]).toEqual(['Escape']);
    expect([...padKeys(pad([PAD.start]))]).toEqual(['Escape']);
    expect([...padKeys(pad([PAD.back]))]).toEqual(['Tab']);
    expect([...padKeys(pad([PAD.x, PAD.y, PAD.rb]))]).toEqual(['Digit1', 'Digit2', 'Digit3']);
  });
  it('in combat only the menu and the minimap are keys', () => {
    expect([...padCombatKeys(pad([PAD.start, PAD.back, PAD.a, PAD.x, PAD.up]))]).toEqual(['Escape', 'Tab']);
  });
  it('a key event carries the key the screens read', () => {
    expect(keyOf('Digit2')).toBe('2');
    expect(keyOf('Escape')).toBe('Escape');
    expect(keyOf('Enter')).toBe('Enter');
  });
});

describe('sending the keys', () => {
  const emitter = () => {
    const sent: string[] = [];
    return { sent, keys: keyEmitter((type, code, repeat) => sent.push(`${type} ${code}${repeat ? ' repeat' : ''}`)) };
  };
  it('a press is one down and one up, and only arrows repeat', () => {
    const { sent, keys } = emitter();
    keys.update(new Set(['Enter', 'ArrowDown']), 0);
    keys.update(new Set(['Enter', 'ArrowDown']), KEY_REPEAT.delayMs - 1);
    expect(sent).toEqual(['keydown Enter', 'keydown ArrowDown']);
    keys.update(new Set(['Enter', 'ArrowDown']), KEY_REPEAT.delayMs);
    keys.update(new Set(['Enter', 'ArrowDown']), KEY_REPEAT.delayMs + KEY_REPEAT.everyMs);
    expect(sent.slice(2)).toEqual(['keydown ArrowDown repeat', 'keydown ArrowDown repeat']);
    keys.update(new Set(), KEY_REPEAT.delayMs + KEY_REPEAT.everyMs + 1);
    expect(sent.slice(4)).toEqual(['keyup Enter', 'keyup ArrowDown']);
  });
  it('a change of mode lets go of what was sent, and what stays held sends nothing until released', () => {
    const { sent, keys } = emitter();
    keys.update(new Set(['ArrowUp']), 0);
    keys.rearm(new Set(['Escape']));
    expect(sent).toEqual(['keydown ArrowUp', 'keyup ArrowUp']);
    keys.update(new Set(['Escape']), 10);
    keys.update(new Set(), 20);
    expect(sent).toHaveLength(2);
    keys.update(new Set(['Escape']), 30);
    expect(sent.at(-1)).toBe('keydown Escape');
  });
});

describe('in combat', () => {
  it('the left stick moves, with a dead zone', () => {
    expect(frameOf(pad([], [0.1, 0.1, 0, 0])).frame.move).toEqual({ x: 0, y: 0 });
    expect(frameOf(pad([], [1, 0, 0, 0])).frame.move).toEqual({ x: 1, y: 0 });
  });
  it('X, Y, LB and RB hold the slots', () => {
    expect(frameOf(pad([PAD.x])).frame).toMatchObject({ fast: true, heavy: false, boost: false, area: false });
    expect(frameOf(pad([PAD.y])).frame).toMatchObject({ fast: false, heavy: true, boost: false, area: false });
    expect(frameOf(pad([PAD.lb])).frame).toMatchObject({ fast: false, heavy: false, boost: true, area: false });
    expect(frameOf(pad([PAD.rb])).frame).toMatchObject({ fast: false, heavy: false, boost: false, area: true });
  });
  it('A rolls once per press', () => {
    const first = frameOf(pad([PAD.a]));
    expect(first.frame.roll).toBe(true);
    expect(frameOf(pad([PAD.a]), first.memory).frame.roll).toBe(false);
  });
  it('LT or R3 lock, held and as a press', () => {
    for (const button of [PAD.lt, PAD.r3]) {
      const first = frameOf(pad([button]));
      expect(first.frame).toMatchObject({ lockHeld: true, lockTap: true });
      expect(frameOf(pad([button]), first.memory).frame).toMatchObject({ lockHeld: true, lockTap: false });
    }
  });
  it('the D-pad sides switch target once per press', () => {
    const right = frameOf(pad([PAD.right]));
    expect(right.frame.swipe).toBe(1);
    expect(frameOf(pad([PAD.right]), right.memory).frame.swipe).toBe(0);
    expect(frameOf(pad([PAD.left])).frame.swipe).toBe(-1);
  });
  it('a button held across a change of mode neither rolls, nor locks, nor counts as lifted', () => {
    const held = pad([PAD.a, PAD.lt, PAD.y]);
    expect(frameOf(held, padMemory(held)).frame).toMatchObject({ roll: false, lockTap: false });
    const { frame } = frameOf(pad([]), padMemory(held));
    // It was never aimed: the step only names the slot, with no direction to fire along.
    expect(frame.aim).toEqual({ slot: 1, dir: null });
  });
  it('idle pad, idle frame', () => {
    expect(frameOf(pad()).frame).toEqual(IDLE_TOUCH);
  });
});

describe('a charged move from the pad, through the real input path', () => {
  const view = { x: 0, y: 0, width: 512, height: 320 };
  // No mouse on a couch: the keyboard side aims at the corner of the view.
  const idleKeys: PlayerInput = { move: { x: 0, y: 0 }, aim: { x: 0, y: 0 }, aimPointer: false, roll: false, slots: [false, false, false, false], slotMouse: [false, false, false, false], lock: false, click: false, wheel: 0, view };
  const ctx = (world: WorldState): TouchAimContext => ({ view, pixelScale: 2, playerPos: world.player.pos, facing: world.player.facing, enemies: world.enemies, lockType: 'toggle', locked: false, autoAim: true });
  const apply = (world: WorldState, frame: TouchFrame) => step(world, mergeInputs(mergeInputs(idleKeys, touchToPlayerInput(IDLE_TOUCH, ctx(world))), touchToPlayerInput(frame, ctx(world))), FIXED_DT_MS);
  const world0 = () => createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: { x: 400, y: 300 }, loadout: ['shadow-claw', 'play-rough'] });

  it('fires along the right stick, even when the stick recentred before the release', () => {
    let world = world0();
    let memory = padMemory(null);
    const press = (state: PadState) => {
      const r = padFrame(state, memory);
      memory = r.memory;
      world = apply(world, r.frame);
    };
    press(pad([PAD.y], [0, 0, -1, 0]));
    for (let i = 0; i < 4; i++) press(pad([PAD.y], [0, 0, 0, 0]));
    press(pad([]));
    expect(world.player.action?.phase).toBe('windup');
    expect(world.player.action?.aimDir.x).toBeCloseTo(-1);
    expect(world.player.action?.aimDir.y).toBeCloseTo(0);
  });

  it('with no stick it fires along the facing, not at the corner of the view', () => {
    let world = world0();
    let memory = padMemory(null);
    for (const state of [pad([PAD.y]), pad([PAD.y]), pad([PAD.y]), pad([])]) {
      const r = padFrame(state, memory);
      memory = r.memory;
      world = apply(world, r.frame);
    }
    expect(world.player.action?.phase).toBe('windup');
    expect(world.player.action?.aimDir).toEqual(world.player.facing);
  });

  it('an idle pad leaves the input exactly as it was', () => {
    const world = world0();
    const merged = mergeInputs(idleKeys, touchToPlayerInput(padFrame(pad(), padMemory(null)).frame, ctx(world)));
    expect(merged).toEqual({ ...idleKeys, slots: [false, false, false, false] });
  });
});
