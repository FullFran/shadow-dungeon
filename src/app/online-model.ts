import { normalizeRoomCode } from '../net/room-code';

/** The "Play online" window's model (.agents/DESIGN.md §4 Online window); pure, so it is tested without a DOM. */

export type OnlineAction = 'create' | 'join';

export interface OnlineModel {
  /** The single ember call to action. */
  primary: OnlineAction;
  /** The control that takes the focus on arrival. */
  focus: OnlineAction;
  /** The code shown in the field. */
  code: string;
}

/** A code that came with the link (`?room=`) makes Join the ember action; otherwise Create is. */
export function onlineModel(prefill: string): OnlineModel {
  const primary: OnlineAction = prefill ? 'join' : 'create';
  return { primary, focus: primary, code: prefill };
}

export type JoinAttempt = { ok: true; code: string } | { ok: false; reason: 'empty' | 'invalid' };

/** The typed code in canonical form, or why it cannot open a room yet. */
export function joinAttempt(typed: string): JoinAttempt {
  if (!typed.trim()) return { ok: false, reason: 'empty' };
  const code = normalizeRoomCode(typed.trim());
  return code ? { ok: true, code } : { ok: false, reason: 'invalid' };
}

/** The new player-facing strings of the window (each one exists in every language). */
export const ONLINE_KEYS: readonly string[] = ['online.create.body', 'online.join.body', 'online.nickname.hint', 'online.emptyCode'];
