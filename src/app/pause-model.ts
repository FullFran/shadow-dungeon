import type { HeldItem } from '../adapters/hud';
import { MAX_LEVEL, levelProgress } from '../core/progression';
import { dungeonById } from '../data/dungeons';
import type { Difficulty } from '../data/difficulty';
import type { MoveId } from '../data/moves';
import { PLAYER_SLOT_LAYOUT, type SlotKind } from '../data/slots';
import type { SpeciesId } from '../data/species';
import { t } from '../i18n';

/**
 * The model of the pause menu (src/app/pause-view.ts draws it; owner, 2026-11-04: the pause menu in the relic
 * look). Pure, so each rule is a test: which actions exist and in which order, which of them lose progress and
 * must be confirmed, and the run summary card (only data the run already has).
 */

export interface MenuActions {
  resume(): void;
  restart(): void;
  quit(): void;
  /** Solo restarts of this floor still allowed by the tier (data/difficulty.ts); null or absent = unlimited. */
  restartsLeft?: number | null;
  /** "Reportar un problema" (issue #9): the report form shown in the menu; `back` returns to it. Absent: no row. */
  openReport?(back: () => void): { element: HTMLElement; dispose(): void };
  /** "Copiar informe técnico" (issue #6): copies this session's diagnostics. Absent: no row. */
  copyReport?(): void;
  /** Fullscreen in and out (the same helper as F11 / Alt+Enter in play). Absent: no row. */
  toggleFullscreen?(): void;
  /** Whether the page is fullscreen now; the row's label follows it. */
  isFullscreen?(): boolean;
}

export type PauseEntry = 'resume' | 'restart' | 'settings' | 'fullscreen' | 'report' | 'copyReport' | 'quit';

/** The menu's actions in order: the report rows only when the app offers them, always before quitting. */
export function pauseEntries(actions: MenuActions): PauseEntry[] {
  return ['resume', 'restart', 'settings', ...(actions.toggleFullscreen ? (['fullscreen'] as const) : []), ...(actions.openReport ? (['report'] as const) : []), ...(actions.copyReport ? (['copyReport'] as const) : []), 'quit'];
}

/** The pages of the menu on a phone (it shows one at a time, the others are a tap away on a rail); desktop shows all four side by side. */
export const PAUSE_TABS = ['actions', 'map', 'run', 'items'] as const;
export type PauseTab = (typeof PAUSE_TABS)[number];

/** The page `delta` steps from `tab`, looping. */
export function nextTab(tab: PauseTab, delta: number): PauseTab {
  return PAUSE_TABS[(PAUSE_TABS.indexOf(tab) + delta + PAUSE_TABS.length) % PAUSE_TABS.length]!;
}

/** The restart row label: plain when unlimited, with the uses left otherwise ("none left" at 0). */
export function restartLabel(restartsLeft: number | null | undefined, tr: (key: string) => string): string {
  if (restartsLeft === null || restartsLeft === undefined) return tr('pause.restart');
  return restartsLeft > 0 ? `${tr('pause.restart')} (${restartsLeft})` : tr('pause.restartNone');
}

/** What the shared confirm dialog says before an action that loses progress. */
export interface PauseConfirm {
  titleKey: string;
  bodyKey: string;
  confirmKey: string;
}

export interface PauseAction {
  id: PauseEntry;
  label: string;
  /** One quiet line under the label: where the action leads. */
  hint: string;
  /** The one ember action (Continuar). */
  primary: boolean;
  /** Leaves the run: sits last and apart; only its icon is tinted, the confirm dialog carries the danger. */
  danger: boolean;
  /** Stays in the list, dimmed and inert (a restart with no uses left). */
  disabled: boolean;
  /** Set when the action loses progress: it must be confirmed first. */
  confirm: PauseConfirm | null;
}

export function pauseActions(actions: MenuActions, tr: (key: string) => string = t, coop = false): PauseAction[] {
  return pauseEntries(actions).map((id): PauseAction => {
    const base = { id, hint: id === 'fullscreen' ? '' : tr(`pause.hint.${id}`), primary: id === 'resume', danger: id === 'quit', disabled: false, confirm: null };
    switch (id) {
      case 'resume':
        return { ...base, label: tr('pause.resume') };
      case 'restart': {
        const none = actions.restartsLeft === 0;
        return { ...base, label: restartLabel(actions.restartsLeft, tr), disabled: none, confirm: none ? null : { titleKey: 'pause.confirm.restart.title', bodyKey: 'pause.confirm.restart.body', confirmKey: 'pause.confirm.restart.confirm' } };
      }
      case 'settings':
        return { ...base, label: tr('pause.settings') };
      case 'fullscreen': {
        const on = actions.isFullscreen?.() === true;
        return { ...base, label: tr(on ? 'hint.fullscreen.exit' : 'hint.fullscreen.enter'), hint: tr(on ? 'pause.hint.fullscreenExit' : 'pause.hint.fullscreen') };
      }
      case 'report':
        return { ...base, label: tr('title.report') };
      case 'copyReport':
        return { ...base, label: tr('lobby.copyReport') };
      case 'quit':
        return { ...base, label: tr('pause.quit'), confirm: { titleKey: 'pause.confirm.quit.title', bodyKey: coop ? 'pause.confirm.quit.bodyCoop' : 'pause.confirm.quit.body', confirmKey: 'pause.confirm.quit.confirm' } };
    }
  });
}

/** What the run knows about itself; the game fills it when the menu opens. */
export interface PauseRunInfo {
  species: SpeciesId;
  dungeon: string;
  floor: number;
  difficulty: Difficulty;
  /** Run time in game milliseconds (a solo run's pauses are not counted). */
  elapsedMs: number;
  coins: number;
  loadout: readonly (MoveId | null)[];
  /** The run's total experience; the level and how far into it are derived from it. */
  xp: number;
  /** The partner's passive and its state now (`passiveStatus`): hidden in combat, read here. */
  passive: { text: string; ready: boolean };
  /** A shared run: it keeps going for the partners while this menu is open. */
  coop: boolean;
}

export interface PauseMove {
  slot: SlotKind;
  id: MoveId | null;
  name: string;
}

export interface PauseSummary {
  species: SpeciesId;
  speciesName: string;
  dungeonName: string;
  floorLine: string;
  difficultyName: string;
  time: string;
  coins: number;
  moves: PauseMove[];
  items: HeldItem[];
  coop: boolean;
  level: number;
  /** How far into the level (0..1) and its words: "62 %", or "Máximo" at the cap. */
  xpFill: number;
  xpText: string;
  passive: { text: string; ready: boolean };
}

/** "12:34", or "1:02:05" past the hour. */
export function formatRunTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

export function pauseSummary(info: PauseRunInfo, held: readonly HeldItem[], tr: (key: string) => string = t): PauseSummary {
  const { level, fill } = levelProgress(info.xp);
  return {
    species: info.species,
    speciesName: tr(`species.${info.species}`),
    dungeonName: tr(dungeonById(info.dungeon).lore.nameKey),
    floorLine: `${tr('hud.floor')} ${info.floor}`,
    difficultyName: tr(`difficulty.${info.difficulty}`),
    time: formatRunTime(info.elapsedMs),
    coins: info.coins,
    moves: PLAYER_SLOT_LAYOUT.map((slot, i) => {
      const id = info.loadout[i] ?? null;
      return { slot, id, name: id ? tr(`move.${id}`) : tr('pause.moveEmpty') };
    }),
    items: [...held],
    coop: info.coop,
    level,
    xpFill: fill,
    xpText: level >= MAX_LEVEL ? tr('pause.xpMax') : `${Math.floor(fill * 100)} %`,
    passive: info.passive,
  };
}
