import { missionProgressOf, missionStatus, type Mission, type MissionReward, type MissionState, type MissionStatus } from '../core/missions';
import type { Difficulty } from '../data/difficulty';
import { dungeonById } from '../data/dungeons';
import { MISSIONS, type MissionKind } from '../data/missions';
import type { PixelIconId } from '../ui/pixel-icons';
import { coinText } from './coin-lines';

/**
 * The mission board as data for its view (owner, 2026-11-04: "rediseña el tablón"), pure:
 * one card per posted mission (icon by kind, difficulty, reward, requester), the three
 * accepted slots and the one action a card offers. Texts are i18n templates filled with
 * the content's own names; `tr` is the i18n lookup.
 */
type Tr = (key: string) => string;

const fill = (text: string, values: Record<string, string>): string => Object.entries(values).reduce((out, [k, v]) => out.split(`{${k}}`).join(v), text);

function values(m: Mission, tr: Tr): Record<string, string> {
  const g = m.goal;
  switch (g.kind) {
    case 'floor':
      return { dungeon: tr(dungeonById(g.dungeon).lore.nameKey), floor: String(g.floor) };
    case 'clear':
      return { dungeon: tr(dungeonById(g.dungeon).lore.nameKey) };
    case 'defeat':
      return { type: tr(`type.${g.type}`), count: String(g.count) };
    case 'species':
      return { species: tr(`species.${g.line}`) };
  }
}

export const missionTitle = (m: Mission, tr: Tr): string => fill(tr(`mission.${m.goal.kind}.title`), values(m, tr));

export const missionText = (m: Mission, tr: Tr): string => fill(tr(`mission.${m.goal.kind}.text`), values(m, tr));

/** "120 P + 1 Esencias de Abra (Normal)". */
export function rewardText(reward: MissionReward, tr: Tr): string {
  const mat = reward.materials;
  const materials = mat ? ` + ${fill(tr('mission.materials'), { n: String(mat.count), species: tr(`species.${mat.line}`), difficulty: tr(`difficulty.${mat.tier}`) })}` : '';
  return coinText(reward.coins, tr) + materials;
}

/** A row's right-hand state: take it, its progress, claim it, or claimed. */
export function statusText(status: MissionStatus, progress: number, target: number, tr: Tr): string {
  if (status === 'accepted') return `${progress}/${target}`;
  return tr(`mission.status.${status}`);
}

export { fill };

/** The pixel icon of a goal kind: stairs (floor), dungeon gate (clear), sword (defeat), the partner ball (species). */
export const MISSION_ICONS: Readonly<Record<MissionKind, PixelIconId>> = { floor: 'stairs', clear: 'dungeons', defeat: 'sword', species: 'pokemon' };

export const missionIcon = (kind: MissionKind): PixelIconId => MISSION_ICONS[kind];

/** Who posted a mission of this kind (i18n key). */
export const requesterKey = (kind: MissionKind): string => `mission.requester.${kind}`;

/** The keys the board view reads besides the mission texts (a test checks both languages). */
export const BOARD_VIEW_KEYS = [
  'mission.title',
  'mission.slots',
  'mission.slot.empty',
  'mission.action.accept',
  'mission.action.claim',
  'mission.action.abandon',
  'mission.action.full',
  'mission.action.claimed',
  'mission.abandon.title',
  'mission.abandon.body',
  'mission.abandon.confirm',
  'mission.requester',
  'mission.requires',
  'mission.condition',
  'mission.progress',
  'mission.ready',
  'mission.hint',
  'mission.pick',
  'mission.period.daily',
  'mission.period.weekly',
  'mission.status.open',
  'mission.status.done',
  'mission.status.claimed',
  'mission.full',
  'mission.claimed',
  'mission.reset',
  'screen.coins.balance',
  'title.achievements',
  'menu.back',
  'hub.hint',
] as const;

export interface MissionCard {
  id: string;
  kind: MissionKind;
  icon: PixelIconId;
  /** The weekly mission: the starred one. */
  weekly: boolean;
  title: string;
  /** The full condition. */
  text: string;
  requester: string;
  status: MissionStatus;
  progress: number;
  target: number;
  /** Real progress, 0..1. */
  share: number;
  tier: Difficulty;
  coins: number;
  reward: string;
  /** Complete and waiting to be cashed in: the board's one highlight. */
  ready: boolean;
}

export function missionCard(m: Mission, state: MissionState, tr: Tr): MissionCard {
  const status = missionStatus(state, m);
  const progress = status === 'claimed' ? m.target : Math.min(missionProgressOf(state, m), m.target);
  return {
    id: m.id,
    kind: m.goal.kind,
    icon: missionIcon(m.goal.kind),
    weekly: m.period === 'weekly',
    title: missionTitle(m, tr),
    text: missionText(m, tr),
    requester: tr(requesterKey(m.goal.kind)),
    status,
    progress,
    target: m.target,
    share: m.target > 0 ? progress / m.target : 0,
    tier: m.tier,
    coins: m.reward.coins,
    reward: rewardText(m.reward, tr),
    ready: status === 'done',
  };
}

/** Every posted mission of the board as a card, in board order. */
export const boardCards = (board: readonly Mission[], state: MissionState, tr: Tr): MissionCard[] => board.map((m) => missionCard(m, state, tr));

/** The accepted slots: the missions held, in the order they were taken, then empty slots up to the limit. */
export function slotCards(board: readonly Mission[], state: MissionState, tr: Tr): (MissionCard | null)[] {
  const held = state.accepted.flatMap((a) => board.find((m) => m.id === a.id) ?? []);
  return Array.from({ length: MISSIONS.maxAccepted }, (_, i) => (held[i] ? missionCard(held[i]!, state, tr) : null));
}

export type CardAction = 'accept' | 'full' | 'claim' | 'abandon' | 'none';

/** The one action a card offers: take it (or why not), cash it in, give it up, or nothing once claimed. */
export function cardAction(status: MissionStatus, full: boolean): CardAction {
  if (status === 'open') return full ? 'full' : 'accept';
  if (status === 'done') return 'claim';
  if (status === 'accepted') return 'abandon';
  return 'none';
}
