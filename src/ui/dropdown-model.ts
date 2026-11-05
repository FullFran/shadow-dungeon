/**
 * Pure keyboard model of the custom dropdown (src/ui/dropdown.ts), the ARIA
 * select-only combobox pattern: Enter, Space and the arrows open the list on
 * the selected option; inside it the arrows move (skipping disabled options,
 * stopping at the ends), Home and End jump, Enter or Space commit, Escape
 * closes without committing, Tab commits and lets focus move on, and a
 * printable key jumps to the next option that starts with it.
 */
export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface DropdownState {
  open: boolean;
  /** The highlighted option while open (the option shown while closed lives in the component). */
  active: number;
}

export interface DropdownKeyResult {
  state: DropdownState;
  /** The index to select, when the key committed one. */
  commit?: number;
  /** True: the key was used here (preventDefault, stop it reaching the menu behind). */
  handled: boolean;
}

const enabled = (options: readonly DropdownOption[], i: number): boolean => i >= 0 && i < options.length && !options[i]!.disabled;

/** First enabled option at or after `from` going `step` (1 or -1); -1 when none. */
function seek(options: readonly DropdownOption[], from: number, step: 1 | -1): number {
  for (let i = from; i >= 0 && i < options.length; i += step) if (enabled(options, i)) return i;
  return -1;
}

/** The enabled option to start on: the selected one, else the nearest enabled one after it, else before it. */
function landing(options: readonly DropdownOption[], selected: number): number {
  if (enabled(options, selected)) return selected;
  const after = seek(options, Math.max(0, selected), 1);
  return after >= 0 ? after : Math.max(0, seek(options, Math.min(selected, options.length - 1), -1));
}

/** Next option (after `from`, wrapping) whose label starts with the typed text, ignoring case; -1 when none. A single repeated letter cycles through its matches. */
export function typeAhead(options: readonly DropdownOption[], from: number, typed: string): number {
  const text = typed.toLowerCase();
  if (!text) return -1;
  const n = options.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    if (enabled(options, i) && options[i]!.label.toLowerCase().startsWith(text)) return i;
  }
  return -1;
}

/**
 * What a key does. `selected` is the committed option's index (where an open
 * list starts). `typed` is the type-ahead buffer including this key, when the
 * caller keeps one; by default the key alone.
 */
export function dropdownKey(state: DropdownState, key: string, options: readonly DropdownOption[], selected: number, typed: string = key): DropdownKeyResult {
  const ignored: DropdownKeyResult = { state, handled: false };
  if (!state.open) {
    if (key === 'Enter' || key === ' ' || key === 'ArrowDown' || key === 'ArrowUp') return { state: { open: true, active: landing(options, selected) }, handled: true };
    if (key.length === 1 && key !== ' ') {
      const hit = typeAhead(options, selected, typed);
      return hit < 0 ? { state, handled: true } : { state: { open: true, active: hit }, handled: true };
    }
    return ignored;
  }
  switch (key) {
    case 'ArrowDown': {
      const next = seek(options, state.active + 1, 1);
      return { state: { open: true, active: next < 0 ? state.active : next }, handled: true };
    }
    case 'ArrowUp': {
      const next = seek(options, state.active - 1, -1);
      return { state: { open: true, active: next < 0 ? state.active : next }, handled: true };
    }
    case 'Home':
      return { state: { open: true, active: landing(options, -1) }, handled: true };
    case 'End': {
      const last = seek(options, options.length - 1, -1);
      return { state: { open: true, active: last < 0 ? state.active : last }, handled: true };
    }
    case 'Enter':
    case ' ':
      return { state: { open: false, active: state.active }, commit: state.active, handled: true };
    case 'Escape':
      return { state: { open: false, active: state.active }, handled: true };
    case 'Tab':
      return { state: { open: false, active: state.active }, commit: state.active, handled: false };
    default: {
      if (key.length !== 1) return ignored;
      const hit = typeAhead(options, state.active, typed);
      return { state: hit < 0 ? state : { open: true, active: hit }, handled: true };
    }
  }
}
