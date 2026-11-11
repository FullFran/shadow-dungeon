import { BIND_ACTIONS, inputLabel, isFixedSlot, normalizeInput, type BindAction, type Binding, type Bindings, type RebindResult } from '../adapters/bindings';
import { t } from '../i18n';

/**
 * The model of Settings > Keyboard and mouse (issue #62): one row per rebindable action with its two inputs, and
 * the sentence that tells the player what a rebind did. Pure; the DOM and the key capture live in
 * src/app/settings-view.ts.
 */
export interface BindingSlotModel {
  input: Binding;
  label: string;
  /** The menu's Esc: shown, never changed. */
  fixed: boolean;
}

export interface BindingRowModel {
  action: BindAction;
  label: string;
  slots: [BindingSlotModel, BindingSlotModel];
}

const slotOf = (table: Bindings, action: BindAction, slot: 0 | 1): BindingSlotModel => {
  const input = table[action][slot];
  return { input, label: input ? inputLabel(input) : t('bind.none'), fixed: isFixedSlot(action, slot) };
};

export function bindingRows(table: Bindings): BindingRowModel[] {
  return BIND_ACTIONS.map((action) => ({ action, label: t(`bind.action.${action}`), slots: [slotOf(table, action, 0), slotOf(table, action, 1)] }));
}

/** What a rebind did, in one sentence: bound, swapped with another action, that action left without the key, or refused. */
export function rebindFeedback(result: RebindResult, action: BindAction, rawInput: string): string {
  const input = normalizeInput(rawInput);
  const key = inputLabel(input);
  if (result.kind === 'refused') return t(`bind.refused.${result.reason}`).replace('{key}', key);
  if (result.kind === 'ok') return t('bind.done').replace('{action}', t(`bind.action.${action}`)).replace('{key}', key);
  const other = t(`bind.action.${result.other.action}`);
  const given = result.bindings[result.other.action][result.other.slot];
  if (given === null) return t('bind.cleared').replaceAll('{key}', key).replaceAll('{other}', other);
  return t('bind.swapped').replaceAll('{key}', key).replaceAll('{other}', other).replace('{old}', inputLabel(given));
}
