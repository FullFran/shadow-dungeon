import type { TownNpc } from '../data/town';

/**
 * The town's Esc menu (owner, 2026-10-26: "el pueblo es la interfaz para
 * todo"): quick access to every service of the town as a window, without
 * walking, then the way back to the title (or the room's own rows in an
 * online room). Walking to the NPCs and places still works the same.
 */
export const TOWN_SERVICES = ['pokemon', 'travel', 'dungeons', 'challenges', 'evolve', 'shop', 'tutor', 'gacha', 'board', 'achievements', 'gallery', 'shrine', 'online', 'account', 'settings', 'controls'] as const;
export type TownService = (typeof TOWN_SERVICES)[number];

/** The service each NPC window is (every `opens` kind must be one; tests/town/town-menu.test.ts). */
export const NPC_SERVICE: Record<NonNullable<TownNpc['opens']>, TownService> = { shop: 'shop', tutor: 'tutor', gacha: 'gacha', evolve: 'evolve' };

/** The services of the places one reads (the waystone leads to the dungeons and travels). */
export const PLACE_SERVICES: Record<'board' | 'waystone' | 'shrine' | 'beacon', readonly TownService[]> = {
  board: ['board'],
  waystone: ['dungeons', 'challenges', 'travel'],
  shrine: ['shrine'],
  beacon: ['online'],
};

/**
 * The menu rows for this walker: the services the app wired (`available`),
 * minus the signal pillar's online window inside a room (the room is already
 * online). Order follows `TOWN_SERVICES`.
 */
export function townMenuServices(available: ReadonlySet<TownService>, inRoom: boolean): TownService[] {
  return TOWN_SERVICES.filter((s) => available.has(s) && !(inRoom && s === 'online'));
}

/** i18n keys of a service row: its label and its description. */
export const serviceLabelKey = (service: TownService): string => `townMenu.${service}`;
export const serviceAboutKey = (service: TownService): string => `townMenu.${service}.about`;
