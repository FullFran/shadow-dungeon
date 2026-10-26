import { registerCards, type CardFightDef, type SpellCardDef, type SpellCardId } from './cards';

/**
 * The bosses that had their own card cycles (Sableye, Trevenant, Lanturn,
 * Dhelmise, Salazzle, Nihilego) as spell-card fights on Normal and harder
 * (user decision 2026-10-26 A). They are hosted cards (data/cards.ts
 * `moves`). Each card names some of the boss's own moves, and the boss's
 * engine plays them exactly as before: the patterns, telegraphs, tier
 * tricks (data/forest-tricks.ts, caves-tricks.ts, swamp-tricks.ts) and
 * fairness tests stay theirs. The card adds the HP segment, the timer, the
 * declaration and the capture (core/cards.ts `updateHostedCardFight`).
 * Easy keeps the fight as it shipped.
 *
 * Shape per tier, as the guardians' (tests/core/hosted-cards.test.ts):
 * - Normal: the boss's cycle cut into cards that keep its order; a phase-2
 *   card (`phase2`, the longer declaration) where the boss had an awakening.
 * - Hard: the same cards (with the tier's own tricks) and one survival card.
 * - Nightmare: one or two more cards and a last spell of at most 15 % HP.
 *
 * Timers leave room to break every segment with the reference damage
 * (src/sim/prove.ts, kill feasibility); values are provisional.
 */

const FIGHT = { aggroRange: 900, breakMs: 1200, phase2BreakMs: 1800, maxShots: 140, walkSpeed: 0, keepDistance: 0, power: 1 } as const;

interface CardSpec {
  id: SpellCardId;
  moves: readonly string[];
  hpShare: number;
  timerMs: number;
  survival?: true;
  lastSpell?: true;
  phase2?: true;
}

const card = (boss: string, spec: CardSpec): SpellCardDef => ({
  id: spec.id,
  nameKey: `spell.${boss}.${spec.id.replace(/^sc-[a-z]+-/, 'card-')}`,
  hpShare: spec.hpShare,
  timerMs: spec.timerMs,
  restMs: 0,
  steps: [],
  moves: spec.moves,
  ...(spec.survival ? { survival: true as const } : {}),
  ...(spec.lastSpell ? { lastSpell: true as const } : {}),
  ...(spec.phase2 ? { phase2: true as const } : {}),
});

const fight = (boss: string, specs: readonly CardSpec[], extra: Partial<CardFightDef> = {}): CardFightDef => registerCards({ ...FIGHT, ...extra, cards: specs.map((s) => card(boss, s)) });

const survival = (id: SpellCardId, moves: readonly string[], timerMs: number): CardSpec => ({ id, moves, hpShare: 0, timerMs, survival: true });

// --- Sableye, el ladrón de gemas (Crypt mid-boss) -------------------------------

const SAB_GLINT = (hpShare: number): CardSpec => ({ id: 'sc-sab-glint', moves: ['glint'], hpShare, timerMs: 30_000 });
const SAB_GEMS = (hpShare: number): CardSpec => ({ id: 'sc-sab-gems', moves: ['gems', 'glint'], hpShare, timerMs: 35_000 });
const SAB_VAULT = survival('sc-sab-vault', ['gems'], 12_000);

export const SABLEYE_CARDS_NORMAL = fight('sableye', [SAB_GLINT(0.5), SAB_GEMS(0.5)]);
export const SABLEYE_CARDS_HARD = fight('sableye', [SAB_GLINT(0.5), SAB_VAULT, SAB_GEMS(0.5)]);
export const SABLEYE_CARDS_NIGHTMARE = fight('sableye', [SAB_GLINT(0.45), SAB_VAULT, SAB_GEMS(0.4), { id: 'sc-sab-lastword', moves: ['glint', 'gems'], hpShare: 0.15, timerMs: 30_000, lastSpell: true }]);

// --- Trevenant (Misty Forest mid-boss): it walks in to slam between moves -------

const TRE_ROOTS = (hpShare: number): CardSpec => ({ id: 'sc-tre-roots', moves: ['roots'], hpShare, timerMs: 35_000 });
const TRE_SPIRAL = (hpShare: number): CardSpec => ({ id: 'sc-tre-spiral', moves: ['spiral'], hpShare, timerMs: 35_000 });
const TRE_CURSE = (hpShare: number): CardSpec => ({ id: 'sc-tre-curse', moves: ['curse'], hpShare, timerMs: 35_000 });
const TRE_GROVE = survival('sc-tre-grove', ['grove'], 14_000);

export const TREVENANT_CARDS_NORMAL = fight('trevenant', [TRE_ROOTS(0.35), TRE_SPIRAL(0.35), TRE_CURSE(0.3)]);
export const TREVENANT_CARDS_HARD = fight('trevenant', [TRE_ROOTS(0.35), TRE_SPIRAL(0.35), TRE_GROVE, TRE_CURSE(0.3)]);
export const TREVENANT_CARDS_NIGHTMARE = fight('trevenant', [
  TRE_ROOTS(0.3),
  TRE_SPIRAL(0.3),
  TRE_GROVE,
  TRE_CURSE(0.25),
  { id: 'sc-tre-lastword', moves: ['curse', 'grove'], hpShare: 0.15, timerMs: 35_000, lastSpell: true },
]);

// --- Lanturn, el farol del abismo (Flooded Caves mid-boss) ----------------------

const LAN_BUBBLES = (hpShare: number): CardSpec => ({ id: 'sc-lan-bubbles', moves: ['bubbles', 'surge'], hpShare, timerMs: 35_000 });
const LAN_LURE = (hpShare: number): CardSpec => ({ id: 'sc-lan-lure', moves: ['lure', 'surge'], hpShare, timerMs: 35_000 });
const LAN_ABYSS = survival('sc-lan-abyss', ['bubbles', 'lure'], 12_000);

export const LANTURN_CARDS_NORMAL = fight('lanturn', [LAN_BUBBLES(0.5), LAN_LURE(0.5)]);
export const LANTURN_CARDS_HARD = fight('lanturn', [LAN_BUBBLES(0.5), LAN_ABYSS, LAN_LURE(0.5)]);
export const LANTURN_CARDS_NIGHTMARE = fight('lanturn', [LAN_BUBBLES(0.45), LAN_ABYSS, LAN_LURE(0.4), { id: 'sc-lan-lastword', moves: ['deep', 'surge'], hpShare: 0.15, timerMs: 30_000, lastSpell: true }]);

// --- Dhelmise, el Ancla de los Juramentos Hundidos (Flooded Caves guardian) -----

const DHE_UNDERTOW = (hpShare: number): CardSpec => ({ id: 'sc-dhe-undertow', moves: ['undertow', 'whirlpool'], hpShare, timerMs: 40_000 });
const DHE_KELP = (hpShare: number): CardSpec => ({ id: 'sc-dhe-kelp', moves: ['kelp', 'undertow'], hpShare, timerMs: 40_000 });
const DHE_RIPTIDE = (hpShare: number): CardSpec => ({ id: 'sc-dhe-riptide', moves: ['riptide', 'kelp'], hpShare, timerMs: 45_000, phase2: true });
const DHE_BELL = (hpShare: number): CardSpec => ({ id: 'sc-dhe-bell', moves: ['bell', 'undertow'], hpShare, timerMs: 45_000 });
const DHE_TIDE = survival('sc-dhe-tide', ['whirlpool', 'kelp'], 15_000);

export const DHELMISE_CARDS_NORMAL = fight('dhelmise', [DHE_UNDERTOW(0.25), DHE_KELP(0.25), DHE_RIPTIDE(0.25), DHE_BELL(0.25)]);
export const DHELMISE_CARDS_HARD = fight('dhelmise', [DHE_UNDERTOW(0.27), DHE_KELP(0.27), DHE_RIPTIDE(0.23), DHE_TIDE, DHE_BELL(0.23)]);
export const DHELMISE_CARDS_NIGHTMARE = fight('dhelmise', [
  DHE_UNDERTOW(0.18),
  DHE_KELP(0.18),
  DHE_RIPTIDE(0.18),
  DHE_TIDE,
  DHE_BELL(0.18),
  { id: 'sc-dhe-maelstrom', moves: ['maelstrom', 'riptide'], hpShare: 0.16, timerMs: 45_000 },
  { id: 'sc-dhe-lastword', moves: ['bell', 'maelstrom'], hpShare: 0.12, timerMs: 40_000, lastSpell: true },
]);

// --- Salazzle, la reina del humo (Toxic Swamp mid-boss) ------------------------

const SAL_DANCE = (hpShare: number): CardSpec => ({ id: 'sc-sal-dance', moves: ['dance'], hpShare, timerMs: 30_000 });
const SAL_SPIRAL = (hpShare: number): CardSpec => ({ id: 'sc-sal-spiral', moves: ['spiral', 'dance'], hpShare, timerMs: 35_000 });
const SAL_HAZE = (hpShare: number): CardSpec => ({ id: 'sc-sal-haze', moves: ['haze', 'spiral'], hpShare, timerMs: 35_000 });
const SAL_COURT = survival('sc-sal-court', ['spiral', 'haze'], 12_000);
/** Her retinue leaves with each card (no Salandit lingers into a declaration). */
const COURT = { dismiss: ['salandit'] } as const;

export const SALAZZLE_CARDS_NORMAL = fight('salazzle', [SAL_DANCE(0.35), SAL_SPIRAL(0.35), SAL_HAZE(0.3)], COURT);
export const SALAZZLE_CARDS_HARD = fight('salazzle', [SAL_DANCE(0.35), SAL_SPIRAL(0.35), SAL_COURT, SAL_HAZE(0.3)], COURT);
export const SALAZZLE_CARDS_NIGHTMARE = fight(
  'salazzle',
  [SAL_DANCE(0.3), SAL_SPIRAL(0.3), SAL_COURT, SAL_HAZE(0.25), { id: 'sc-sal-lastword', moves: ['escort', 'dance', 'haze'], hpShare: 0.15, timerMs: 35_000, lastSpell: true }],
  COURT,
);

// --- Nihilego, la que cayó por la grieta del cielo (Toxic Swamp guardian) -------

const NIH_TENDRILS = (hpShare: number): CardSpec => ({ id: 'sc-nih-tendrils', moves: ['tendrils', 'spores'], hpShare, timerMs: 40_000 });
const NIH_SHARDS = (hpShare: number): CardSpec => ({ id: 'sc-nih-shards', moves: ['shards', 'spores'], hpShare, timerMs: 40_000 });
const NIH_WORMHOLE = (hpShare: number): CardSpec => ({ id: 'sc-nih-wormhole', moves: ['wormhole', 'tendrils'], hpShare, timerMs: 45_000, phase2: true });
const NIH_FLOOD = (hpShare: number): CardSpec => ({ id: 'sc-nih-flood', moves: ['flood', 'shards'], hpShare, timerMs: 45_000 });
const NIH_RIFT = survival('sc-nih-rift', ['spores', 'tendrils'], 15_000);

export const NIHILEGO_CARDS_NORMAL = fight('nihilego', [NIH_TENDRILS(0.25), NIH_SHARDS(0.25), NIH_WORMHOLE(0.25), NIH_FLOOD(0.25)]);
export const NIHILEGO_CARDS_HARD = fight('nihilego', [NIH_TENDRILS(0.27), NIH_SHARDS(0.27), NIH_WORMHOLE(0.23), NIH_RIFT, NIH_FLOOD(0.23)]);
export const NIHILEGO_CARDS_NIGHTMARE = fight('nihilego', [
  NIH_TENDRILS(0.18),
  NIH_SHARDS(0.18),
  NIH_WORMHOLE(0.18),
  NIH_RIFT,
  NIH_FLOOD(0.18),
  { id: 'sc-nih-downpour', moves: ['downpour', 'spores'], hpShare: 0.16, timerMs: 45_000 },
  { id: 'sc-nih-lastword', moves: ['flood', 'downpour'], hpShare: 0.12, timerMs: 40_000, lastSpell: true },
]);

/** Every hosted fight per species and tier (Normal, Hard, Nightmare). */
export const HOSTED_FIGHTS = {
  sableye: [SABLEYE_CARDS_NORMAL, SABLEYE_CARDS_HARD, SABLEYE_CARDS_NIGHTMARE],
  trevenant: [TREVENANT_CARDS_NORMAL, TREVENANT_CARDS_HARD, TREVENANT_CARDS_NIGHTMARE],
  lanturn: [LANTURN_CARDS_NORMAL, LANTURN_CARDS_HARD, LANTURN_CARDS_NIGHTMARE],
  dhelmise: [DHELMISE_CARDS_NORMAL, DHELMISE_CARDS_HARD, DHELMISE_CARDS_NIGHTMARE],
  salazzle: [SALAZZLE_CARDS_NORMAL, SALAZZLE_CARDS_HARD, SALAZZLE_CARDS_NIGHTMARE],
  nihilego: [NIHILEGO_CARDS_NORMAL, NIHILEGO_CARDS_HARD, NIHILEGO_CARDS_NIGHTMARE],
} as const;
