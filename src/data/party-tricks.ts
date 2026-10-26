import { BOSS_AGGRO } from './party-scaling';
import type { ArcherDef, DanmakuDef, EnemyDef, ThiefDef, TreantDef } from './enemies';
import type { QueenDef } from './swamp-enemies';
import type { SpeciesId } from './species';

/**
 * Bosses by party (docs/gdd.md §8): from `minParty` players a boss plays one
 * more area card in its rotation, one it already knows (its telegraph,
 * pattern and fairness tests stay the same). Patches compose over the
 * tier's behaviour (core/tricks.ts `behaviourAt`), so a hard-tier card stays
 * in. One boss still winds up one attack at a time: the card adds area
 * pressure, never a second telegraph on the same player. Bosses without a
 * cheap area card (Aegislash, Lanturn, Nihilego, the echoes) get none.
 */
/*
 * A hosted spell-card boss (data/hosted-cards.ts) plays its party move once
 * more in every card's loop (`partyMoves`, core/cards.ts `hostedMoves`).
 */
export interface PartyTrick {
  minParty: number;
  patch: (def: EnemyDef) => Partial<EnemyDef>;
}

const FROM = BOSS_AGGRO.areaCardFrom;

export const PARTY_TRICKS: Partial<Record<SpeciesId, readonly PartyTrick[]>> = {
  // The marked root lanes once more.
  trevenant: [{ minParty: FROM, patch: (d) => ({ cards: [...(d as TreantDef).cards, 'roots'], partyMoves: ['roots'] }) as Partial<TreantDef> }],
  // A second fan from the edge of the clearing.
  decidueye: [{ minParty: FROM, patch: (d) => ({ cards: [...(d as ArcherDef).cards, 'fan'] }) as Partial<ArcherDef> }],
  // Another gem ring.
  sableye: [{ minParty: FROM, patch: (d) => ({ cards: [...(d as ThiefDef).cards, 'gems'], partyMoves: ['gems'] }) as Partial<ThiefDef> }],
  // The kelp lanes again.
  dhelmise: [{ minParty: FROM, patch: (d) => ({ cards: [...(d as DanmakuDef).cards, 'kelp'], partyMoves: ['kelp'] }) as Partial<DanmakuDef> }],
  // One more haze over the court.
  salazzle: [{ minParty: FROM, patch: (d) => ({ cards: [...(d as unknown as QueenDef).cards, 'haze'], partyMoves: ['haze'] }) as Partial<EnemyDef> }],
};
