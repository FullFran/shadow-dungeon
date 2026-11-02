import { CRYPT } from '../data/dungeons';

/**
 * The Crypt's contextual tutorial (odd/tasks/menu-redesign.md T7, S2, S10):
 * neutral stone signs that appear the first time each thing happens on this
 * device, teaching controls, not strategy (the game stays hard). Floors are
 * procedural, so signs answer moments, not places. Pure: the run feeds it its
 * events and the device's seen set; game.ts shows the signs.
 */
export const TUTORIAL_HINTS = ['move', 'attack', 'roll', 'stamina', 'charge', 'lock', 'bonfire'] as const;
export type TutorialHint = (typeof TUTORIAL_HINTS)[number];

/** Which wording a sign uses: the input the player is using now. */
export type TutorialDevice = 'keys' | 'touch' | 'pad';

/** The i18n key of a sign for a device: `tutorial.<hint>.<device>`. */
export const hintKey = (hint: TutorialHint, device: TutorialDevice): string => `tutorial.${hint}.${device}`;

/** Only the Crypt, the first dungeon; never a shrine trial, a Senda's story run or a dev run (spawns, start floor). */
export function tutorialApplies(run: { dungeon: string; trial: boolean; story: boolean; dev: boolean }): boolean {
  return run.dungeon === CRYPT.id && !run.trial && !run.story && !run.dev;
}

/** What happened this step, as far as the signs care. */
export interface TutorialMoment {
  /** The floor just entered, when one was. */
  floorStart?: number;
  events: readonly { type: string; slotIndex?: number }[];
  /** A bonfire was lit this step. */
  bonfire?: boolean;
}

/** The signs this moment brings, in the order to show them, leaving out the ones already seen. */
export function hintsFor(moment: TutorialMoment, seen: ReadonlySet<string>): TutorialHint[] {
  const out: TutorialHint[] = [];
  const add = (hint: TutorialHint) => {
    if (!seen.has(hint) && !out.includes(hint)) out.push(hint);
  };
  if (moment.floorStart === 1) {
    add('move');
    add('attack');
  }
  for (const event of moment.events) {
    if (event.type === 'playerHurt' || event.type === 'disguiseBroken') add('roll');
    else if (event.type === 'rollDenied') add('stamina');
    else if (event.type === 'moveStarted' && event.slotIndex === 1) add('charge');
    else if (event.type === 'moveStarted' && event.slotIndex === 0) add('lock');
  }
  if (moment.bonfire) add('bonfire');
  return out;
}

/** The signs seen on this device (like the Sima's scenes: app/sima-cinematic.ts), in their own key outside the settings. */
const SEEN_KEY = 'mazmorra-sombria.tutorialSeen';

interface SeenStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export function tutorialSeen(store: SeenStore): Set<string> {
  try {
    const raw = JSON.parse(store.get(SEEN_KEY) ?? '[]') as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function markTutorialSeen(store: SeenStore, hint: TutorialHint): void {
  const seen = tutorialSeen(store);
  if (seen.has(hint)) return;
  seen.add(hint);
  store.set(SEEN_KEY, JSON.stringify([...seen]));
}
