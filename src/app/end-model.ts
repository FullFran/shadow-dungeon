import { clockText } from '../core/endless';
import { dungeonById, guardianOf, TUTORIAL } from '../data/dungeons';
import type { SpeciesId } from '../data/species';
import { scoreLine, type ScoreEntry } from '../town/leaderboard';
import { endActions, endHeading, victoryLine } from './after-run';
import { coinLines } from './coin-lines';
import type { RunSummary } from './game';
import { simaEventLines } from './sima-summary';

/**
 * Every win/lose end screen as data (owner, 2026-11-04: "lo de ganar y perder rediséñalo"), pure:
 * the outcome heading, the creature to draw, the cards (summary, Pokémonedas, the Sima's score and
 * events) and at most two actions, the primary («back») first. The view is `end-screen.ts`.
 */
export type EndOutcome = 'victory' | 'defeat' | 'eclipse' | 'cut';

export interface EndLine {
  label: string;
  value: string;
  /** A line to read first (a new best, the Pokémonedas earned). */
  tone?: 'best' | 'coin';
  /** A small gilt chip beside the value. */
  badge?: string;
}
export interface EndCard {
  id: string;
  title: string;
  lines: EndLine[];
  notes?: string[];
}
export type EndActionId = 'back' | 'retry';
export interface EndView {
  outcome: EndOutcome;
  title: string;
  subtitle: string | null;
  notes: string[];
  species: SpeciesId;
  cards: EndCard[];
  /** The primary first (one ember); never more than two. */
  actions: { id: EndActionId; label: string }[];
}

export interface EndInput {
  result: 'victory' | 'defeat' | 'eclipse';
  summary: RunSummary;
  online: boolean;
  balance: number;
  /** The names of a room's players (null alone). */
  party: string[] | null;
  /** The local player's Pokémon (the face of a defeat). */
  playerSpecies: SpeciesId;
  /** The hub is open, so «back» reads «Town» rather than «Menu». */
  townOpen: boolean;
  /** The held items as "Name ×2" in pick order. */
  heldNames: string[];
  /** The Sima's score: this run's entry, its rank on the board (null: not in the top) and the board. */
  score?: { entry: ScoreEntry; rank: number | null; board: readonly ScoreEntry[] };
  /** A challenge clear's materials line. */
  materials?: string | null;
}

export function endModel(input: EndInput, tr: (key: string) => string): EndView {
  const { result, summary, online, party, score } = input;
  const dungeon = dungeonById(summary.dungeon);
  const heading = endHeading(result, summary.cutShort);
  const species: SpeciesId = result === 'victory' && !summary.cutShort ? (guardianOf(dungeon) ?? 'aegislash') : input.playerSpecies;
  // Victory names the dungeon's guardian, defeat the player's Pokémon (a run the host cut short says neither).
  const subtitle = heading.text ? tr(heading.text).replace('{name}', tr(`species.${species}`)) : null;
  const closing = victoryLine(dungeon, result);
  const notes = [...(summary.cutShort ? [tr(`net.cutShort.${summary.cutShort}`)] : []), ...(closing ? [tr(closing)] : [])];

  const summaryLines: EndLine[] = [
    { label: tr('difficulty.label'), value: tr(`difficulty.${summary.difficulty}`) },
    { label: tr('screen.floorReached'), value: String(summary.floor) },
    { label: tr('screen.level'), value: String(summary.level) },
    { label: tr('screen.seed'), value: String(summary.seed) },
    { label: tr('screen.items'), value: input.heldNames.length === 0 ? tr('screen.noItems') : input.heldNames.join(', ') },
    ...(party ? [{ label: tr('screen.party'), value: party.join(', ') }] : []),
  ];
  const cards: EndCard[] = [{ id: 'summary', title: tr('screen.summary'), lines: summaryLines }];

  // The Sima's ×0.5 is its pay rate, not a difficulty: its line says so.
  const coinTr = (key: string): string => tr(score && key === 'screen.coins.multiplier' ? 'endless.coins.rate' : key);
  const coinRows: EndLine[] = coinLines(summary.coins, input.balance, coinTr).map((line, i, all): EndLine => ({ ...line, ...(i === all.length - 2 ? { tone: 'coin' as const } : {}) }));
  cards.push({ id: 'coins', title: tr('screen.coins'), lines: [...coinRows, ...(input.materials ? [{ label: tr('screen.materials'), value: input.materials }] : [])] });

  if (score) {
    cards.push({
      id: 'score',
      title: tr('endless.score'),
      lines: [
        { label: tr('endless.score.mode'), value: `${tr(`endless.mode.${score.entry.mode}`)} · ${score.entry.date}` },
        { label: tr('endless.score.time'), value: clockText(score.entry.clockMs) },
        { label: tr('endless.score.rank'), value: score.rank === null ? tr('endless.score.unranked') : `#${score.rank}` },
      ],
      notes: score.board.slice(0, 3).map((e, i) => scoreLine(e, i + 1, tr)),
    });
  }
  if (summary.simaEvents?.length) cards.push({ id: 'events', title: tr('sima.summary.title'), lines: [], notes: simaEventLines(summary.simaEvents, tr) });

  const back = { id: 'back' as const, label: tr(party ? 'lobby.backToTown' : input.townOpen ? 'screen.town' : 'screen.menu') };
  const retry = { id: 'retry' as const, label: tr('screen.retry') };
  const wanted = endActions({ online, tutorialWon: summary.dungeon === TUTORIAL.id && result === 'victory' });
  return { outcome: summary.cutShort ? 'cut' : result, title: tr(heading.title), subtitle, notes, species, cards, actions: wanted.includes('retry') ? [back, retry] : [back] };
}

/** The keys the end view reads besides the species, dungeon and lore names (a test checks both languages). */
export const END_KEYS = [
  'screen.summary',
  'screen.coins',
  'screen.coins.balance',
  'screen.floorReached',
  'screen.level',
  'screen.seed',
  'screen.items',
  'screen.noItems',
  'screen.party',
  'screen.materials',
  'screen.retry',
  'screen.town',
  'screen.menu',
  'lobby.backToTown',
  'difficulty.label',
  'endless.score',
  'endless.score.mode',
  'endless.score.time',
  'endless.score.rank',
  'endless.score.unranked',
  'sima.summary.title',
] as const;
