import { END_ICONS, type EndIconId } from '../ui/icons/end-icons';
import type { PixelIcon } from '../ui/pixel-icons';
import type { EndCard, EndLine, EndView } from './end-model';

/**
 * The end view laid out as a result ceremony (owner, 2026-11-04: "más grande y más visual"), pure: the figures of the
 * summary and the record become stat tiles (at most six visible, Miller; the rest a second row), long text a strip of
 * details, the Pokémonedas a rewards row, the Sima's score and events stay cards. Every line of every card lands in
 * exactly one place, so none the old table showed is dropped.
 */
export const MAX_TILES = 6;
export type { EndIconId };

export interface EndRewards {
  /** The card title («Pokémonedas»). */
  title: string;
  /** The headline earning (counts up). */
  hero: EndLine | null;
  /** The new balance. */
  balance: EndLine | null;
  /** The breakdown and materials, small. */
  rows: EndLine[];
}

export interface EndLayout {
  tiles: EndLine[];
  more: EndLine[];
  details: EndLine[];
  reward: EndRewards | null;
  cards: EndCard[];
  seal: string | null;
}

/** The pixel icon of a tile id. */
export const endIconOf = (id: EndIconId): PixelIcon => END_ICONS[id];

const TILE_CARDS = new Set(['summary', 'record']);
const REWARD_CARDS = new Set(['coins', 'reward']);

export function endLayout(view: EndView): EndLayout {
  const figures: EndLine[] = [];
  const details: EndLine[] = [];
  const cards: EndCard[] = [];
  let reward: EndRewards | null = null;
  for (const card of view.cards) {
    if (TILE_CARDS.has(card.id)) {
      for (const line of card.lines) (line.wide ? details : figures).push(line);
    } else if (REWARD_CARDS.has(card.id)) {
      reward ??= { title: card.title, hero: null, balance: null, rows: [] };
      for (const line of card.lines) {
        if (line.tone === 'coin') reward.hero = line;
        else if (line.tone === 'balance') reward.balance = line;
        else reward.rows.push(line);
      }
    } else cards.push(card);
  }
  return { tiles: figures.slice(0, MAX_TILES), more: figures.slice(MAX_TILES), details, reward, cards, seal: view.seal ?? null };
}

/**
 * How many of the twelve grid columns each tile spans so the grid has no holes: rows of three (four columns each), a row of
 * two (six each), a lone tile full width; four tiles make one row of four.
 */
export function tileSpans(count: number): number[] {
  if (count === 4) return [3, 3, 3, 3];
  const spans: number[] = [];
  for (let left = count; left > 0; left -= 3) spans.push(...Array<number>(Math.min(3, left)).fill(left >= 3 ? 4 : 12 / left));
  return spans;
}
