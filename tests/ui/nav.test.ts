import { describe, expect, it } from 'vitest';
import { firstSelectable, moveCursor, navAction, restoreCursor, selectable, tapAction } from '../../src/ui/nav';

const items = (...flags: ('ok' | 'off' | 'head')[]) => flags.map((f) => ({ disabled: f === 'off', header: f === 'head' }));

describe('cursor navigation', () => {
  it('only plain items are selectable (disabled items and headers are not)', () => {
    expect(items('ok', 'off', 'head').map(selectable)).toEqual([true, false, false]);
  });

  it('moves down and up, wrapping at both ends', () => {
    const list = items('ok', 'ok', 'ok');
    expect(moveCursor(list, 0, 1)).toBe(1);
    expect(moveCursor(list, 2, 1)).toBe(0);
    expect(moveCursor(list, 0, -1)).toBe(2);
  });

  it('skips disabled items and headers in both directions, wrapping past them', () => {
    const list = items('head', 'ok', 'off', 'ok', 'head', 'off');
    expect(moveCursor(list, 1, 1)).toBe(3);
    expect(moveCursor(list, 3, 1)).toBe(1);
    expect(moveCursor(list, 1, -1)).toBe(3);
    expect(moveCursor(list, 3, -1)).toBe(1);
  });

  it('stays put when nothing else is selectable, and reports -1 when nothing is', () => {
    expect(moveCursor(items('off', 'ok', 'off'), 1, 1)).toBe(1);
    expect(moveCursor(items('off', 'head'), 0, 1)).toBe(-1);
    expect(moveCursor([], 0, -1)).toBe(-1);
  });

  it('starts on the first selectable item at or after a start index', () => {
    expect(firstSelectable(items('head', 'off', 'ok', 'ok'))).toBe(2);
    expect(firstSelectable(items('ok', 'off', 'ok'), 1)).toBe(2);
    expect(firstSelectable(items('ok', 'off', 'off'), 1)).toBe(0);
    expect(firstSelectable(items('off'))).toBe(-1);
  });

  it('keeps the cursor on re-render while its item is still selectable, else moves to the next one', () => {
    expect(restoreCursor(items('ok', 'ok', 'ok'), 2)).toBe(2);
    expect(restoreCursor(items('ok', 'off', 'ok'), 1)).toBe(2);
    expect(restoreCursor(items('ok', 'ok'), 5)).toBe(0);
  });
});

describe('menu keys', () => {
  it('maps arrows and W/S to the cursor, A/D and left/right to adjusting, Enter/Space to confirm, Esc to back', () => {
    expect(['ArrowUp', 'KeyW', 'ArrowDown', 'KeyS'].map((c) => navAction(c))).toEqual(['prev', 'prev', 'next', 'next']);
    expect(['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].map((c) => navAction(c))).toEqual(['left', 'left', 'right', 'right']);
    expect(['Enter', 'NumpadEnter', 'Space', 'Escape'].map((c) => navAction(c))).toEqual(['confirm', 'confirm', 'confirm', 'back']);
    expect(navAction('KeyQ')).toBeNull();
  });

  it('a horizontal list (cards) moves with left/right and A/D as well', () => {
    expect(['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD', 'ArrowUp', 'ArrowDown'].map((c) => navAction(c, 'horizontal'))).toEqual([
      'prev',
      'prev',
      'next',
      'next',
      'prev',
      'next',
    ]);
  });
});

describe('tap to select (shop rows on touch)', () => {
  const tap = (tapToSelect: boolean, wasActive: boolean, pressedBy: string | null, pointerClick = true) => tapAction({ tapToSelect, wasActive, pressedBy, pointerClick });

  it('a finger on a row that is not under the cursor only selects it; a second tap confirms', () => {
    expect(tap(true, false, 'touch')).toBe('select');
    expect(tap(true, true, 'touch')).toBe('confirm');
  });

  it('a click pressed elsewhere (the tap that opened the window, landing on a row) never confirms', () => {
    expect(tap(true, false, null)).toBe('select');
    expect(tap(true, true, null)).toBe('select');
  });

  it('mouse, pen, the keyboard confirm and ordinary rows confirm at once', () => {
    expect(tap(true, false, 'mouse')).toBe('confirm');
    expect(tap(true, false, 'pen')).toBe('confirm');
    expect(tap(true, false, null, false)).toBe('confirm');
    expect(tap(false, false, 'touch')).toBe('confirm');
    expect(tap(false, false, null)).toBe('confirm');
  });
});
