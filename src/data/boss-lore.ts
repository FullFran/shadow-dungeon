import { registeredCards } from './cards';
import { ENEMY_BEHAVIOUR } from './enemies';

/**
 * Who the bosses are, for the combat HUD (.agents/DESIGN.md §4 "Combat HUD"): the roster the boss bar serves, each
 * boss's epithet (the line under its name, i18n `boss.epithet.*`), the events it can announce (its spell cards and
 * stances) and, for each event, a short telegraph cue (how to read it). Pure data derived from the enemy tables, so a
 * new boss or card shows up in the tests that iterate it without being listed twice.
 */

/** Enemy kinds that carry boss state (core/boss.ts `hasBossState`) plus any enemy flagged `bar: true`. */
const BOSS_KINDS: ReadonlySet<string> = new Set(['boss', 'archer', 'thief', 'treant', 'danmaku', 'queen', 'ultra', 'eclipse', 'herald']);

/** Every species that fights with a boss bar. */
export function bossSpecies(): string[] {
  return Object.entries(ENEMY_BEHAVIOUR as Record<string, { kind?: string; bar?: boolean }>)
    .filter(([, def]) => (def.kind !== undefined && BOSS_KINDS.has(def.kind)) || def.bar === true)
    .map(([id]) => id);
}

/** The Sendas' lines (data/story): a mid-boss is that line's shadow, a `-wound` its wound. */
const SENDA_LINES = ['mimikyu', 'cubone', 'litwick', 'zorua', 'abra', 'piplup', 'shinx', 'axew'] as const;

/** i18n key of a boss's epithet: its own for the guardians, one per line for the Senda shadows and wounds. */
export function bossEpithetKey(species: string): string {
  const line = SENDA_LINES.find((l) => species.startsWith(`${l}-`));
  if (line) return species.endsWith('-wound') ? `boss.epithet.wound.${line}` : `boss.epithet.shadow.${line}`;
  return `boss.epithet.${species}`;
}

/** How to read an event at a glance: its pattern of danger. Each has an icon (`cue-<kind>`) and a line (`boss.cue.<kind>`). */
export const BOSS_CUES = ['volley', 'ring', 'area', 'dash', 'summon', 'guard'] as const;
export type BossCue = (typeof BOSS_CUES)[number];

/** The cue of an event (a stance or spell card id): by what the id names, the plain ground warning when unknown. */
export function cueOf(stance: string): BossCue {
  if (/escort|dance|court/.test(stance)) return 'summon';
  if (/^(shield|oaths|mirror|unsheathe)$|walls/.test(stance)) return 'guard';
  if (/volley|fan|rain|lanes|feathers|shards|bubbles|downpour|blades|hundred|swords|riptide|shadow/.test(stance)) return 'volley';
  if (/ring|corona|spiral|bell|maelstrom|whirlpool|moon|crown|bloom/.test(stance)) return 'ring';
  if (/dive|slam|glint|stitch|noose|lure|surge|undertow|drop|wormhole|lastword|judgement|blade/.test(stance)) return 'dash';
  return 'area';
}

interface EventSource {
  kind?: string;
  cards?: readonly string[];
  phase1?: readonly string[];
  phase2?: unknown;
  cardNames?: Readonly<Record<string, string>>;
  spellCards?: { cards: readonly { id: string }[] };
}

/** The spell-card id prefix of a species in data/cards.ts (Aegislash's are `sc-aeg-*`). */
const cardPrefix = (species: string): string => (species === 'aegislash' ? 'sc-aeg-' : `sc-${species}-`);

/** Every event a boss can announce: its named cards, stances and registered spell cards (a herald's generated cards are `herald0..3` and their phase-2 `x`). */
export function bossEvents(species: string): string[] {
  const def = (ENEMY_BEHAVIOUR as Record<string, EventSource | undefined>)[species];
  if (!def) return [];
  const out = new Set<string>();
  for (const key of Object.keys(def.cardNames ?? {})) out.add(key);
  for (const id of def.cards ?? []) out.add(id);
  for (const id of def.phase1 ?? []) out.add(id);
  if (Array.isArray(def.phase2)) for (const id of def.phase2 as string[]) out.add(id);
  for (const card of def.spellCards?.cards ?? []) out.add(card.id);
  if (def.kind === 'boss') {
    out.add('shield');
    out.add('blade');
  }
  if (def.kind === 'herald') for (let i = 0; i < 4; i++) for (const suffix of ['', 'x']) out.add(`herald${i}${suffix}`);
  const prefix = cardPrefix(species);
  for (const id of registeredCards()) if (id.startsWith(prefix)) out.add(id);
  return [...out];
}

/**
 * The stance a boss shows while it changes phase ("El Rey desenvaina", "Despierta"...), by the kind of its
 * engine; every peer reads it from the synced boss state, so a guest sees the change the host made.
 */
export const PHASE_STANCES = ['unsheathe', 'mist', 'ultra', 'awaken'] as const;

const PHASE_STANCE_OF_KIND: Readonly<Record<string, (typeof PHASE_STANCES)[number]>> = { boss: 'unsheathe', archer: 'mist', ultra: 'ultra', danmaku: 'awaken', herald: 'awaken' };

/** The phase-change stance of a boss, or null for one that has no second phase. */
export function bossPhaseStance(species: string): (typeof PHASE_STANCES)[number] | null {
  const def = (ENEMY_BEHAVIOUR as Record<string, EventSource | undefined>)[species];
  if (!def || def.kind === undefined || def.phase2 === undefined) return null;
  return PHASE_STANCE_OF_KIND[def.kind] ?? null;
}
