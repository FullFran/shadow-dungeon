import { describe, expect, it } from 'vitest';
import es from '../../src/i18n/es.json';
import { MOVES, type MoveId } from '../../src/data/moves';
import { STORY_BOSSES, STORY_FIGHTS } from '../../src/data/story/bosses';
import { cardNamesOf, spellKey } from '../../src/data/story/kit';
import { STORY_CARD_MOVES } from '../../src/data/story/card-moves';
import { ERUPTION_MOVES, HAND_DRAWN_SHOTS } from '../../src/adapters/fx/cues';

/**
 * Issue #67 (S5): "a card named after a move uses that move". A Senda card
 * whose banner is «Signo <move> «...»» draws its shots of that move's type as
 * that move; its other shots keep their type's move, so no damage type moves.
 * A name that cannot be drawn (a status move, a move of a type the card never
 * fires, a hand-drawn or ground-erupting look) is listed below, never silent.
 */
const strings = es as Record<string, string>;
const MOVE_BY_NAME = new Map(Object.keys(MOVES).map((id) => [strings[`move.${id}`], id as MoveId]));

interface Shot { type: string; move?: string; speed: number; radius: number }

function shotsOf(root: unknown, out: Shot[] = [], seen = new Set<unknown>()): Shot[] {
  if (!root || typeof root !== 'object' || seen.has(root)) return out;
  seen.add(root);
  const o = root as Record<string, unknown>;
  if (typeof o.speed === 'number' && o.speed > 0 && typeof o.radius === 'number' && typeof o.type === 'string') out.push(o as unknown as Shot);
  for (const v of Object.values(o)) shotsOf(v, out, seen);
  return out;
}

/** Every shot a card fires, over the four tiers. */
function cardShots(bossId: string, card: string): Shot[] {
  const nameKey = spellKey(bossId, card);
  const out: Shot[] = [];
  for (const fight of STORY_FIGHTS[bossId as keyof typeof STORY_FIGHTS]) for (const c of fight.cards) if (c.nameKey === nameKey) shotsOf(c.steps, out);
  return out;
}

/** The move a banner names, or null when it names none. */
function namedMove(bossId: string, card: string): MoveId | null {
  const name = /^Signo (.+?) «/.exec(strings[spellKey(bossId, card)] ?? '')?.[1];
  return (name ? MOVE_BY_NAME.get(name) : undefined) ?? null;
}

/** Why a named move cannot be drawn on its card, or null when it can. */
function cannotDraw(bossId: string, card: string, move: MoveId): string | null {
  const def = MOVES[move];
  if (def.hitbox.kind === 'self') return 'status move';
  if (HAND_DRAWN_SHOTS.has(move) || ERUPTION_MOVES.has(move)) return 'no baked flight look';
  const shots = cardShots(bossId, card);
  if (shots.length === 0) return 'no moving shot on the card';
  if (!shots.some((s) => s.type === def.type)) return `its moving shots are ${[...new Set(shots.map((s) => s.type))].sort().join('/')}, not ${def.type}`;
  return null;
}

const cards = STORY_BOSSES.flatMap((boss) => cardNamesOf(boss).map((card) => ({ boss: boss.id, card, move: namedMove(boss.id, card) })));

describe('a Senda card named after a move uses that move (#67, S5)', () => {
  it('finds the named cards', () => {
    expect(cards.filter((c) => c.move).length).toBeGreaterThan(60);
  });

  it('every drawable named card is in the table with its move, and nothing else is', () => {
    const want = Object.fromEntries(cards.filter((c) => c.move && !cannotDraw(c.boss, c.card, c.move)).map((c) => [`${c.boss}.${c.card}`, c.move]));
    expect(STORY_CARD_MOVES).toEqual(want);
  });

  it('its shots of the move\'s type draw as the move; its others keep their type\'s move', () => {
    for (const [key, move] of Object.entries(STORY_CARD_MOVES)) {
      const [boss, card] = key.split('.') as [string, string];
      const shots = cardShots(boss, card);
      const same = shots.filter((s) => s.type === MOVES[move].type);
      expect(same.length, key).toBeGreaterThan(0);
      for (const s of same) expect(s.move, key).toBe(move);
      for (const s of shots.filter((x) => x.type !== MOVES[move].type)) expect(s.move, key).not.toBe(move);
    }
  });

  it('the named cards that cannot be drawn are the listed ones', () => {
    const left = cards.filter((c) => c.move && cannotDraw(c.boss, c.card, c.move)).map((c) => `${c.boss}.${c.card} ${c.move}: ${cannotDraw(c.boss, c.card, c.move!)}`);
    expect(left).toEqual(NOT_DRAWN);
  });
});

/** Named after a move the card cannot be drawn as (issue #67 report; renaming them is the owner's call). */
const NOT_DRAWN: string[] = [
  'mimikyu-noctowl.drop future-sight: its moving shots are ghost, not psychic',
  'mimikyu-jigglypuff.fan hyper-voice: its moving shots are fairy/psychic, not normal',
  'mimikyu-jigglypuff.orbit hyper-voice: its moving shots are fairy/psychic, not normal',
  'mimikyu-hatterene.bloom calm-mind: status move',
  'mimikyu-wound.drop phantom-force: its moving shots are fairy, not ghost',
  'cubone-dusclops.drop night-shade: its moving shots are dark, not ghost',
  'cubone-kangaskhan.rain outrage: its moving shots are ghost/normal, not dragon',
  'cubone-bisharp.survival iron-defense: status move',
  'cubone-wound.drop bonemerang: no baked flight look',
  'litwick-banette.moon curse: status move',
  'litwick-muk.drop sludge-bomb: its moving shots are ghost, not poison',
  'litwick-muk.survival minimize: status move',
  'litwick-wound.drop will-o-wisp: status move',
  'litwick-wound.rain curse: status move',
  'litwick-wound.survival overheat: its moving shots are ghost, not fire',
  'litwick-wound.curl will-o-wisp: status move',
  'zorua-kecleon.fan sucker-punch: its moving shots are ghost/normal, not dark',
  'zorua-kecleon.orbit sucker-punch: its moving shots are ghost/normal, not dark',
  'zorua-gengar.drop shadow-sneak: its moving shots are poison, not ghost',
  'zorua-mightyena.drop sucker-punch: its moving shots are ghost, not dark',
  'zorua-mightyena.rain howl: status move',
  'zorua-houndoom.bloom will-o-wisp: status move',
  'zorua-spiritomb.drop hex: its moving shots are dark, not ghost',
  'zorua-spiritomb.survival curse: status move',
  'zorua-wound.drop foul-play: its moving shots are ghost, not dark',
  'abra-mr-mime.fan reflect: status move',
  'abra-hypno.drop psychic: its moving shots are ghost, not psychic',
  'abra-musharna.drop future-sight: its moving shots are fairy, not psychic',
  'abra-wound.survival calm-mind: status move',
  'piplup-weavile.drop sucker-punch: its moving shots are ice, not dark',
  'shinx-ampharos.survival charge: status move',
  'shinx-manectric.drop wild-charge: its moving shots are fire, not electric',
  'shinx-electivire.drop thunder-punch: its moving shots are fighting, not electric',
  'shinx-electivire.survival charge: status move',
  'shinx-umbreon.drop dark-pulse: its moving shots are ghost, not dark',
  'shinx-wound.drop wild-charge: its moving shots are dark, not electric',
  'axew-druddigon.drop headbutt: its moving shots are rock, not normal',
  'axew-bisharp.blades night-slash: its moving shots are steel, not dark',
  'axew-bisharp.survival iron-defense: status move',
  'axew-salamence.survival dragon-dance: status move',
  'axew-wound.blades x-scissor: its moving shots are dragon, not bug',
  'axew-wound.beam x-scissor: its moving shots are dragon/steel, not bug',
];
