import type { Vec2 } from '../core/vec';
import type { EntranceState } from './overworld';
import { stepDifficulty, type Difficulty } from '../data/difficulty';
import { t } from '../i18n';

/**
 * The online lobby is the town: the room walks it together. Pure rules:
 * how often a walker's presence goes out, and who may lead the room into a
 * dungeon (the host; a guest at a dungeon's mouth or the waystone is told
 * so). The scene takes a `TownLobby` from the app, which wraps the net
 * session (src/net/session.ts).
 */
export const PRESENCE_MS = 100;

/** True when this walker's presence is due again (~10 Hz). */
export const presenceDue = (lastSentMs: number | null, nowMs: number): boolean => lastSentMs === null || nowMs - lastSentMs >= PRESENCE_MS;

/** How long a guest waits for the host to let it in before the room window says the host cannot be reached (over the Internet admission took up to ~9.5 s in tests, 2026-10-29). */
export const ADMIT_TIMEOUT_MS = 25_000;

/** The room as this player stands in it: in the host's roster, still waiting for the host's answer, or no answer in time. */
export type RoomStatus = 'in' | 'connecting' | 'unreachable';

/** A guest is in only once the host has listed it; until then its town is its own, and nobody else is drawn. */
export function roomStatus({ isHost, admitted, waitedMs }: { isHost: boolean; admitted: boolean; waitedMs: number }): RoomStatus {
  if (isHost || admitted) return 'in';
  return waitedMs < ADMIT_TIMEOUT_MS ? 'connecting' : 'unreachable';
}

/**
 * The version-refusal notice (issue #7): the guest's message names both
 * builds and says how to update, the host's toast names the guest's build.
 * Without the other side's label (an older peer) the older wording stays.
 */
export function versionNotice(side: 'guest' | 'host', mine: string, theirs?: string): string {
  if (!theirs) return t(side === 'guest' ? 'net.version' : 'net.versionRefused');
  return t(side === 'guest' ? 'net.versionBoth' : 'net.versionRefusedBoth')
    .replace('{mine}', mine)
    .replace('{theirs}', theirs);
}

export type EntranceAction = 'enter' | 'locked' | 'missing' | 'host-only';

/** What a dungeon's mouth does for this walker: in a room only the host may take the group in. */
export function entranceAction(state: EntranceState, lobby: { isHost: boolean } | null): EntranceAction {
  if (state !== 'open') return state;
  return lobby && !lobby.isHost ? 'host-only' : 'enter';
}

/** The signal pillar: alone it opens the online room window; in a room it says so (the room menu is on Esc). */
export const beaconAction = (lobby: { isHost: boolean } | null): 'open' | 'in-room' => (lobby ? 'in-room' : 'open');

/** The waystone's quick travel starts a run too: the host's alone in a room. */
export const canTravel = (lobby: { isHost: boolean } | null): boolean => !lobby || lobby.isHost;

export interface TownLobbyPlayer {
  name: string;
  host: boolean;
  self: boolean;
}

export interface TownLobbyWalker {
  id: string;
  name: string;
  /** A SPRITE_KEYS name (unknown ones draw as Mimikyu). */
  species: string;
  /** Wears its line's shiny skin. */
  shiny?: boolean;
  /** Its line was picked as female. */
  female?: boolean;
  map: string;
  pos: Vec2;
  facing: Vec2;
  moving: boolean;
}

export interface TownLobby {
  isHost: boolean;
  /** This player's nickname, drawn dimmer over its own head. */
  selfName: string;
  /** The room code for the corner window (dots while hidden). */
  code(): string;
  players(): readonly TownLobbyPlayer[];
  /** The other players' walkers (interpolated). */
  walkers(): readonly TownLobbyWalker[];
  sendPresence(presence: { map: string; pos: Vec2; facing: Vec2; moving: boolean }): void;
  /** Esc: the room's menu rows (copy the code, hide or show it, leave); `close` closes the menu. */
  menu(close: () => void): { label: string; onConfirm: () => void }[];
  /**
   * Host: the ways into a dungeon when there is a choice to make for the
   * whole group (the Sima del Eclipse: daily challenge or free run); each
   * becomes its own Enter row and reaches `onDepart` as its `value`. Null or
   * absent: a single Enter row.
   */
  variants?(dungeon: string): readonly { label: string; value: string }[] | null;
  /** The room's difficulty tier (docs/gdd.md §9): the host's pick, shown to everyone in the room window. */
  difficulty?(): Difficulty;
  /** Host: picks the tier for the whole group (the guests see it at once). */
  setDifficulty?(next: Difficulty): void;
  /** Guest: whether the host has let it in yet (absent: in). */
  status?(): RoomStatus;
}

/** A tier row for a town window: label, value, ◀ ▶ steps and a confirm cycles. */
export interface TierRow {
  label: string;
  value: string;
  className: string;
  onAdjust(delta: -1 | 1): void;
  onConfirm(): void;
}

/**
 * The host's tier row in the entrance and waystone windows (null for a guest
 * or outside a room: solo picks the tier on the loadout screen). `name` turns
 * a tier into its label; `changed` redraws the window after a change.
 */
export function tierRow(lobby: Pick<TownLobby, 'isHost' | 'difficulty' | 'setDifficulty'> | null | undefined, label: string, name: (d: Difficulty) => string, changed: () => void): TierRow | null {
  if (!lobby?.isHost || !lobby.difficulty || !lobby.setDifficulty) return null;
  const current = lobby.difficulty();
  const set = (next: Difficulty) => {
    lobby.setDifficulty!(next);
    changed();
  };
  return { label, value: name(current), className: `difficulty-row tier-${current}`, onAdjust: (delta) => set(stepDifficulty(current, delta)), onConfirm: () => set(stepDifficulty(current, 1, true)) };
}

/** The Enter rows for a dungeon: one per variant (`Enter · Daily challenge`), else the plain one. */
export function enterRows(
  dungeon: string,
  enterLabel: string,
  lobby: Pick<TownLobby, 'isHost' | 'variants'> | null | undefined,
  depart: (dungeon: string, variant?: string) => void,
): { label: string; onConfirm: () => void }[] {
  const variants = lobby?.isHost ? (lobby.variants?.(dungeon) ?? null) : null;
  if (!variants || variants.length === 0) return [{ label: enterLabel, onConfirm: () => depart(dungeon) }];
  return variants.map((v) => ({ label: `${enterLabel} · ${v.label}`, onConfirm: () => depart(dungeon, v.value) }));
}
