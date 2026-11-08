import type { TownService } from '../town/town-menu';
import type { PixelIconId } from '../ui/pixel-icons';

/**
 * The title as a game hub (owner, 2026-11-03; odd/tasks/title-hub.md):
 * small relic buttons round the screen, the partner on an altar in the
 * middle and one dominant Play. Supersedes the three-entry title of
 * 2026-10-26. This module is the pure model: which buttons, where, locked
 * or badged; src/app/title-hub-view.ts draws it.
 */
export interface HubState {
  /** The town is open (tutorial dungeon cleared, or an older save that used it): app/adventure-route.ts `townOpen`. */
  townOpen: boolean;
  /** A starter was chosen (the quiz or by hand). */
  starterChosen: boolean;
  /** Patch notes of this version not read yet. */
  newsUnseen: boolean;
  installable: boolean;
  ticketAdmin: boolean;
}

/** `left`: your Pokémon and what makes it stronger; `right`: the world and its records; `system`: top right; `links`: bottom right. */
export type HubZone = 'play' | 'online' | 'left' | 'right' | 'system' | 'links';

export type HubId =
  | Extract<TownService, 'pokemon' | 'tutor' | 'evolve' | 'gacha' | 'shop' | 'board' | 'achievements' | 'shrine' | 'challenges' | 'gallery' | 'friends' | 'account' | 'settings' | 'controls'>
  | 'play'
  | 'online'
  | 'news'
  | 'fullscreen'
  | 'prologue'
  | 'credits'
  | 'report'
  | 'install'
  | 'tickets';

export interface HubButton {
  id: HubId;
  zone: HubZone;
  icon: PixelIconId;
  /** i18n key of the short label. */
  labelKey: string;
  /** i18n key of why it is locked (only while `locked`). */
  lockKey?: string;
  /** Shown and focusable, but explains itself instead of opening. */
  locked: boolean;
  /** Something new behind it (only real unseen content: DESIGN.md §7). */
  badge: boolean;
}

/** The services that live in the town: locked on the title until the town opens, as the route already does. */
export const TOWN_GATED: readonly HubId[] = ['tutor', 'evolve', 'gacha', 'shop', 'board', 'shrine', 'challenges', 'gallery'];

const LAYOUT: readonly { id: HubId; zone: HubZone }[] = [
  { id: 'pokemon', zone: 'left' },
  { id: 'tutor', zone: 'left' },
  { id: 'evolve', zone: 'left' },
  { id: 'gacha', zone: 'left' },
  { id: 'shop', zone: 'left' },
  { id: 'board', zone: 'right' },
  { id: 'challenges', zone: 'right' },
  { id: 'shrine', zone: 'right' },
  { id: 'achievements', zone: 'right' },
  { id: 'gallery', zone: 'right' },
  { id: 'friends', zone: 'right' },
  { id: 'news', zone: 'system' },
  { id: 'account', zone: 'system' },
  { id: 'settings', zone: 'system' },
  { id: 'fullscreen', zone: 'system' },
  { id: 'play', zone: 'play' },
  { id: 'online', zone: 'online' },
  { id: 'controls', zone: 'links' },
  { id: 'prologue', zone: 'links' },
  { id: 'credits', zone: 'links' },
  { id: 'report', zone: 'links' },
  { id: 'install', zone: 'links' },
  { id: 'tickets', zone: 'links' },
];

export function hubButtons(state: HubState): HubButton[] {
  return LAYOUT.filter(({ id }) => (id !== 'install' || state.installable) && (id !== 'tickets' || state.ticketAdmin)).map(({ id, zone }) => {
    const townLock = !state.townOpen && TOWN_GATED.includes(id);
    const starterLock = id === 'pokemon' && !state.starterChosen;
    const locked = townLock || starterLock;
    return {
      id,
      zone,
      icon: id,
      labelKey: `hub.${id}`,
      ...(locked ? { lockKey: townLock ? 'hub.locked.town' : 'hub.locked.starter' } : {}),
      locked,
      badge: id === 'news' && state.newsUnseen,
    };
  });
}

export type HubDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Spatial focus: the control nearest in the pressed direction (distance
 * along it, plus twice the sideways offset), or `from` when none lies that
 * way. Points are control centres in any unit.
 */
export function hubStep(points: readonly { id: string; x: number; y: number }[], from: string, dir: HubDirection): string {
  const at = points.find((p) => p.id === from);
  if (!at) return points[0]?.id ?? from;
  let best = from;
  let bestScore = Infinity;
  for (const p of points) {
    if (p.id === from) continue;
    const dx = p.x - at.x;
    const dy = p.y - at.y;
    const along = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : -dy;
    const side = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (along <= 0) continue;
    const score = along + side * 2;
    if (score < bestScore) {
      bestScore = score;
      best = p.id;
    }
  }
  return best;
}

/** The profile plate's record: best floor and expeditions, singular for one ("1 expedición", not "1 expediciones"). */
export function recordLine(t: (key: string) => string, floor: number, runs: number): string {
  return t(runs === 1 ? 'hub.record.one' : 'hub.record').replace('{floor}', String(floor)).replace('{runs}', String(runs));
}

export type HubGroupId = 'partner' | 'world' | 'more';

export interface HubGroup {
  id: HubGroupId;
  labelKey: string;
  icon: PixelIconId;
  buttons: HubButton[];
  badge: boolean;
}

const GROUPS: readonly { id: HubGroupId; labelKey: string; icon: PixelIconId; zones: readonly HubZone[] }[] = [
  { id: 'partner', labelKey: 'hub.rail.partner', icon: 'pokemon', zones: ['left'] },
  { id: 'world', labelKey: 'hub.rail.world', icon: 'travel', zones: ['right'] },
  { id: 'more', labelKey: 'hub.more', icon: 'settings', zones: ['system', 'links'] },
];

/**
 * The hub on a phone (owner 2026-11-08: "demasiado botón ... pequeño y sobrecargado"): Play and online stay at rest, the
 * two rails and the small system and link buttons fold into three group buttons that open a sheet of large tiles.
 * Nothing is dropped; a group is badged when a button inside it is.
 */
export function compactHub(buttons: readonly HubButton[]): { rest: HubButton[]; groups: HubGroup[] } {
  const rest = buttons.filter((b) => b.zone === 'play' || b.zone === 'online');
  const groups = GROUPS.map(({ id, labelKey, icon, zones }): HubGroup => {
    const inside = buttons.filter((b) => zones.includes(b.zone));
    return { id, labelKey, icon, buttons: inside, badge: inside.some((b) => b.badge) };
  });
  return { rest, groups };
}
