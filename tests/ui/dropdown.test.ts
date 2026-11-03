import { describe, expect, it } from 'vitest';
import { dropdownKey, typeAhead, type DropdownOption } from '../../src/ui/dropdown-model';

const options: DropdownOption[] = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo' },
  { value: 'c', label: 'Charlie', disabled: true },
  { value: 'd', label: 'Delta' },
  { value: 'b2', label: 'Beta' },
];

describe('dropdown keyboard model', () => {
  it('opens on the selected option with Enter, Space or the arrows', () => {
    for (const key of ['Enter', ' ', 'ArrowDown', 'ArrowUp']) {
      const out = dropdownKey({ open: false, active: 0 }, key, options, 3);
      expect(out.state).toEqual({ open: true, active: 3 });
      expect(out.handled).toBe(true);
      expect(out.commit).toBeUndefined();
    }
  });

  it('moves the active option with the arrows, skipping disabled ones and stopping at the ends', () => {
    expect(dropdownKey({ open: true, active: 1 }, 'ArrowDown', options, 1).state.active).toBe(3);
    expect(dropdownKey({ open: true, active: 3 }, 'ArrowUp', options, 1).state.active).toBe(1);
    expect(dropdownKey({ open: true, active: 4 }, 'ArrowDown', options, 1).state.active).toBe(4);
    expect(dropdownKey({ open: true, active: 0 }, 'ArrowUp', options, 1).state.active).toBe(0);
    expect(dropdownKey({ open: true, active: 2 }, 'Home', options, 1).state.active).toBe(0);
    expect(dropdownKey({ open: true, active: 0 }, 'End', options, 1).state.active).toBe(4);
  });

  it('Enter or Space commits the active option and closes; Escape closes without committing', () => {
    expect(dropdownKey({ open: true, active: 3 }, 'Enter', options, 0)).toMatchObject({ state: { open: false, active: 3 }, commit: 3, handled: true });
    expect(dropdownKey({ open: true, active: 1 }, ' ', options, 0).commit).toBe(1);
    const esc = dropdownKey({ open: true, active: 3 }, 'Escape', options, 0);
    expect(esc.state.open).toBe(false);
    expect(esc.commit).toBeUndefined();
    expect(esc.handled).toBe(true);
  });

  it('Tab commits the active option and closes but leaves the key to the browser', () => {
    const out = dropdownKey({ open: true, active: 3 }, 'Tab', options, 0);
    expect(out).toMatchObject({ state: { open: false }, commit: 3, handled: false });
  });

  it('ignores keys it does not own while closed, so Escape still reaches the menu behind', () => {
    expect(dropdownKey({ open: false, active: 0 }, 'Escape', options, 0).handled).toBe(false);
    expect(dropdownKey({ open: false, active: 0 }, 'Tab', options, 0).handled).toBe(false);
  });

  it('never opens on a disabled option', () => {
    expect(dropdownKey({ open: false, active: 0 }, 'Enter', options, 2).state.active).toBe(3);
  });

  it('type-ahead jumps to the next option starting with the typed text', () => {
    expect(typeAhead(options, 0, 'b')).toBe(1);
    expect(typeAhead(options, 1, 'b')).toBe(4);
    expect(typeAhead(options, 4, 'b')).toBe(1);
    expect(typeAhead(options, 0, 'be')).toBe(4);
    expect(typeAhead(options, 0, 'c')).toBe(-1);
    expect(typeAhead(options, 0, 'z')).toBe(-1);
  });

  it('a printable key opens the list and moves to the match', () => {
    const out = dropdownKey({ open: false, active: 0 }, 'd', options, 0);
    expect(out.state).toEqual({ open: true, active: 3 });
    expect(out.handled).toBe(true);
  });
});
