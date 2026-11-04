import { describe, expect, it } from 'vitest';
import { createDeviceState, deviceOfKey, deviceOfPointer, padTouched } from '../../src/adapters/last-device';

describe('which device the player is using', () => {
  it('a real key press is the keyboard; the key events the pad bridge makes for menus and the town are the pad', () => {
    expect(deviceOfKey(true)).toBe('keyboard');
    expect(deviceOfKey(false)).toBe('gamepad');
  });

  it('a finger is touch; a mouse or pen goes with the keyboard', () => {
    expect(deviceOfPointer('touch')).toBe('touch');
    expect(deviceOfPointer('mouse')).toBe('keyboard');
    expect(deviceOfPointer('pen')).toBe('keyboard');
  });

  it('a pad counts as used with a button down or a stick pushed past its dead zone, not while it rests', () => {
    expect(padTouched({ buttons: [{ pressed: false }, { pressed: false }], axes: [0.05, -0.1, 0, 0] })).toBe(false);
    expect(padTouched({ buttons: [{ pressed: false }, { pressed: true }], axes: [0, 0] })).toBe(true);
    expect(padTouched({ buttons: [], axes: [0, 0.8] })).toBe(true);
    expect(padTouched({ buttons: [], axes: [-0.6, 0] })).toBe(true);
  });

  it('starts as touch on a touch UI and as the keyboard otherwise, and follows the last thing used', () => {
    expect(createDeviceState(true).current()).toBe('touch');
    const state = createDeviceState(false);
    expect(state.current()).toBe('keyboard');
    expect(state.set('gamepad')).toBe(true);
    expect(state.current()).toBe('gamepad');
    // Same device again: no change to announce.
    expect(state.set('gamepad')).toBe(false);
    expect(state.set('touch')).toBe(true);
    expect(state.current()).toBe('touch');
  });
});
