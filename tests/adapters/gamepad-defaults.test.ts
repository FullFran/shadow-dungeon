import { describe, expect, it } from 'vitest';
import { padKeyDefault, sendPadKey, type FocusedControl, type PadKeyPage } from '../../src/adapters/gamepad';

/**
 * The pad's keys are synthetic, and the browser runs no default action for them (issue #32 audit, odd/tasks/gamepad.md
 * S5, S8): the bridge does what a real key would have done, only when no screen took the key.
 */
const button: FocusedControl = { tag: 'BUTTON' };
const field: FocusedControl = { tag: 'INPUT', type: 'text' };

describe('what a pad key does when no screen takes it', () => {
  it('Enter on a focused button, link, summary or checkbox activates it, as a real Enter or Space would', () => {
    expect(padKeyDefault('Enter', button)).toBe('activate');
    expect(padKeyDefault('Enter', { tag: 'A', href: true })).toBe('activate');
    expect(padKeyDefault('Enter', { tag: 'SUMMARY' })).toBe('activate');
    for (const type of ['button', 'submit', 'reset', 'image', 'checkbox', 'radio']) expect(padKeyDefault('Enter', { tag: 'INPUT', type })).toBe('activate');
  });
  it('Enter never activates a disabled control, a link without a target, a text field or a file picker', () => {
    expect(padKeyDefault('Enter', { tag: 'BUTTON', disabled: true })).toBeNull();
    expect(padKeyDefault('Enter', { tag: 'A' })).toBeNull();
    expect(padKeyDefault('Enter', field)).toBeNull();
    expect(padKeyDefault('Enter', { tag: 'TEXTAREA' })).toBeNull();
    expect(padKeyDefault('Enter', { tag: 'INPUT', type: 'file' })).toBeNull();
  });
  it('down, right and Tab move the focus to the next control, up and left to the previous one, a text field included', () => {
    for (const focused of [button, field, { tag: 'TEXTAREA' }]) {
      expect(padKeyDefault('ArrowDown', focused)).toBe('next');
      expect(padKeyDefault('ArrowRight', focused)).toBe('next');
      expect(padKeyDefault('Tab', focused)).toBe('next');
      expect(padKeyDefault('ArrowUp', focused)).toBe('previous');
      expect(padKeyDefault('ArrowLeft', focused)).toBe('previous');
    }
  });
  it('with nothing focused (the town, a cursor menu, a run) a key does nothing more', () => {
    for (const code of ['Enter', 'ArrowDown', 'ArrowUp', 'Tab', 'Escape']) expect(padKeyDefault(code, null)).toBeNull();
  });
  it('Escape and the item picks have no default', () => {
    for (const code of ['Escape', 'Digit1', 'Digit2', 'Digit3']) expect(padKeyDefault(code, button)).toBeNull();
  });
});

describe('sending a pad key', () => {
  const page = (focused: FocusedControl | null, listener: (e: { code: string; prevented: boolean; moveFocus(): void }) => boolean = () => false) => {
    const did: string[] = [];
    let focus: string = focused ? 'start' : 'body';
    const fake: PadKeyPage = {
      focused: () => focus,
      describe: (el) => (el === 'start' ? focused : null),
      dispatch: (_el, type, code) => {
        did.push(`${type} ${code}`);
        // A listener returns true when it took the key (preventDefault).
        return !listener({ code, prevented: false, moveFocus: () => void (focus = 'moved') });
      },
      activate: (el) => void did.push(`click ${String(el)}`),
      moveFocus: (_el, step) => void did.push(`focus ${step}`),
    };
    return { did, fake };
  };

  it('a press on a focused button is its key and then its click', () => {
    const { did, fake } = page(button);
    sendPadKey(fake, 'keydown', 'Enter', false);
    expect(did).toEqual(['keydown Enter', 'click start']);
  });
  it('a screen that takes the key gets no click and no focus move', () => {
    const { did, fake } = page(button, () => true);
    sendPadKey(fake, 'keydown', 'Enter', false);
    sendPadKey(fake, 'keydown', 'ArrowDown', false);
    expect(did).toEqual(['keydown Enter', 'keydown ArrowDown']);
  });
  it('a screen that moved the focus itself is left alone', () => {
    const { did, fake } = page(field, (e) => {
      e.moveFocus();
      return false;
    });
    sendPadKey(fake, 'keydown', 'ArrowDown', false);
    expect(did).toEqual(['keydown ArrowDown']);
  });
  it('down leaves a text field for the next control, up for the previous one', () => {
    const { did, fake } = page(field);
    sendPadKey(fake, 'keydown', 'ArrowDown', false);
    sendPadKey(fake, 'keydown', 'ArrowUp', false);
    expect(did).toEqual(['keydown ArrowDown', 'focus 1', 'keydown ArrowUp', 'focus -1']);
  });
  it('a held Enter clicks once, a key going up does nothing more, and a repeated arrow moves again', () => {
    const { did, fake } = page(button);
    sendPadKey(fake, 'keydown', 'Enter', true);
    sendPadKey(fake, 'keyup', 'Enter', false);
    sendPadKey(fake, 'keydown', 'ArrowDown', true);
    expect(did).toEqual(['keydown Enter', 'keyup Enter', 'keydown ArrowDown', 'focus 1']);
  });
  it('with nothing focused the key goes to the page and nothing else happens', () => {
    const { did, fake } = page(null);
    sendPadKey(fake, 'keydown', 'Enter', false);
    sendPadKey(fake, 'keydown', 'ArrowDown', false);
    expect(did).toEqual(['keydown Enter', 'keydown ArrowDown']);
  });
});
