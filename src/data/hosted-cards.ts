import { registerCards, type CardFightDef, type SpellCardDef, type SpellCardId } from './cards';
import { dheChain, dheWhirl, lanBackflow, lanBolt, lanLanterns, nihFracture, nihNeurotoxin, nihUpward, salSparks, sabRicochet, treBranches, treWisps } from './pattern-cards';

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
 * Each boss also has new pattern cards (data/pattern-cards.ts, owner
 * decision 2b): on Normal one replaces its weakest card, the rest join on
 * Hard and Nightmare; the shared card engine plays them (core/cards.ts) and
 * its own engine waits meanwhile.
 *
 * Shape per tier, as the guardians' (tests/core/hosted-cards.test.ts):
 * - Normal: the boss's cycle cut into cards that keep its order; a phase-2
 *   card (`phase2`, the longer declaration) where the boss had an awakening.
 * - Hard: the same cards (with the tier's own tricks) and one survival card.
 * - Nightmare: one or two more cards and a last spell of at most 15 % HP.
 *
 * HP shares and `hpScale` are tuned by the beatability proof (src/sim/prove.ts,
 * kill feasibility: the reference player empties every segment in its punish
 * windows with the tier's margin); values are provisional.
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

/** A fight's cards: hosted ones from their specs, pattern cards (data/pattern-cards.ts, played by the shared card engine) as they are. */
const fight = (boss: string, specs: readonly (CardSpec | SpellCardDef)[], extra: Partial<CardFightDef> = {}): CardFightDef =>
  registerCards({ ...FIGHT, ...extra, cards: specs.map((s) => ('steps' in s ? s : card(boss, s))) });

const survival = (id: SpellCardId, moves: readonly string[], timerMs: number): CardSpec => ({ id, moves, hpShare: 0, timerMs, survival: true });

// --- Sableye, el ladrón de gemas (Crypt mid-boss) -------------------------------

const SAB_GLINT = (hpShare: number): CardSpec => ({ id: 'sc-sab-glint', moves: ['glint'], hpShare, timerMs: 30_000 });
const SAB_GEMS = (hpShare: number): CardSpec => ({ id: 'sc-sab-gems', moves: ['gems', 'glint'], hpShare, timerMs: 35_000 });
const SAB_VAULT = survival('sc-sab-vault', ['gems'], 12_000);

// The ricochet takes the gems' place on Normal (the lowest share); the gems stay on Hard and Nightmare.
export const SABLEYE_CARDS_NORMAL = fight('sableye', [SAB_GLINT(0.53), sabRicochet('normal', 0.47)], { hpScale: 0.94 });
export const SABLEYE_CARDS_HARD = fight('sableye', [SAB_GLINT(0.4), SAB_VAULT, SAB_GEMS(0.33), sabRicochet('hard', 0.27)], { hpScale: 0.77 });
export const SABLEYE_CARDS_NIGHTMARE = fight(
  'sableye',
  [SAB_GLINT(0.37), SAB_VAULT, SAB_GEMS(0.27), sabRicochet('nightmare', 0.21), { id: 'sc-sab-lastword', moves: ['glint', 'gems'], hpShare: 0.15, timerMs: 30_000, lastSpell: true }],
  { hpScale: 0.98 },
);

// --- Trevenant (Misty Forest mid-boss): it walks in to slam between moves -------

const TRE_ROOTS = (hpShare: number): CardSpec => ({ id: 'sc-tre-roots', moves: ['roots'], hpShare, timerMs: 35_000 });
const TRE_SPIRAL = (hpShare: number): CardSpec => ({ id: 'sc-tre-spiral', moves: ['spiral'], hpShare, timerMs: 35_000 });
const TRE_CURSE = (hpShare: number): CardSpec => ({ id: 'sc-tre-curse', moves: ['curse'], hpShare, timerMs: 35_000 });
const TRE_GROVE = survival('sc-tre-grove', ['grove'], 14_000);

// The branches take the curse's place on Normal (the lowest share); the curse stays on Hard and Nightmare.
export const TREVENANT_CARDS_NORMAL = fight('trevenant', [TRE_ROOTS(0.35), TRE_SPIRAL(0.35), treBranches('normal', 0.3)]);
export const TREVENANT_CARDS_HARD = fight('trevenant', [TRE_ROOTS(0.26), TRE_SPIRAL(0.26), treBranches('hard', 0.16), TRE_GROVE, TRE_CURSE(0.16), treWisps('hard', 0.16)]);
export const TREVENANT_CARDS_NIGHTMARE = fight('trevenant', [
  TRE_ROOTS(0.22),
  TRE_SPIRAL(0.22),
  treBranches('nightmare', 0.13),
  TRE_GROVE,
  TRE_CURSE(0.15),
  treWisps('nightmare', 0.13),
  { id: 'sc-tre-lastword', moves: ['curse', 'grove'], hpShare: 0.15, timerMs: 35_000, lastSpell: true },
]);

// --- Lanturn, el farol del abismo (Flooded Caves mid-boss) ----------------------

const LAN_BUBBLES = (hpShare: number): CardSpec => ({ id: 'sc-lan-bubbles', moves: ['bubbles', 'surge'], hpShare, timerMs: 35_000 });
const LAN_LURE = (hpShare: number): CardSpec => ({ id: 'sc-lan-lure', moves: ['lure', 'surge'], hpShare, timerMs: 35_000 });
const LAN_ABYSS = survival('sc-lan-abyss', ['bubbles', 'lure'], 12_000);

/** Lanturn's rings push a melee starter far out: less HP, so its turns are enough (src/sim/prove.ts, kill feasibility). */
// The backflow takes the lure's place on Normal (the lowest share); the lure stays on Hard and Nightmare.
export const LANTURN_CARDS_NORMAL = fight('lanturn', [LAN_BUBBLES(0.53), lanBackflow('normal', 0.47)], { hpScale: 0.58 });
export const LANTURN_CARDS_HARD = fight('lanturn', [LAN_BUBBLES(0.3), lanBackflow('hard', 0.25), LAN_ABYSS, LAN_LURE(0.25), lanLanterns('hard', 0.2)], { hpScale: 0.5 });
export const LANTURN_CARDS_NIGHTMARE = fight(
  'lanturn',
  [LAN_BUBBLES(0.22), lanBackflow('nightmare', 0.18), LAN_ABYSS, LAN_LURE(0.2), lanLanterns('nightmare', 0.13), lanBolt('nightmare', 0.12), { id: 'sc-lan-lastword', moves: ['deep', 'surge'], hpShare: 0.15, timerMs: 30_000, lastSpell: true }],
  { hpScale: 0.54 },
);

// --- Dhelmise, el Ancla de los Juramentos Hundidos (Flooded Caves guardian) -----

const DHE_UNDERTOW = (hpShare: number): CardSpec => ({ id: 'sc-dhe-undertow', moves: ['undertow', 'whirlpool'], hpShare, timerMs: 40_000 });
const DHE_KELP = (hpShare: number): CardSpec => ({ id: 'sc-dhe-kelp', moves: ['kelp', 'undertow'], hpShare, timerMs: 40_000 });
const DHE_RIPTIDE = (hpShare: number): CardSpec => ({ id: 'sc-dhe-riptide', moves: ['riptide', 'kelp'], hpShare, timerMs: 45_000, phase2: true });
const DHE_BELL = (hpShare: number): CardSpec => ({ id: 'sc-dhe-bell', moves: ['bell', 'undertow'], hpShare, timerMs: 45_000 });
const DHE_TIDE = survival('sc-dhe-tide', ['whirlpool', 'kelp'], 15_000);

/** The riptide's mark stops following 760 ms before it bursts (400 ms could only be rolled out of: src/sim/prove.ts). */
const WRECK = { markLockMs: 760 } as const;

// The anchor chain takes the riptide's place on Normal, awakening included (the shares tie, the riptide had the highest kill margin); the riptide stays on Hard and Nightmare.
export const DHELMISE_CARDS_NORMAL = fight('dhelmise', [DHE_UNDERTOW(0.25), DHE_KELP(0.25), dheChain('normal', 0.25, true), DHE_BELL(0.25)], WRECK);
// The compressed chart (data/types.ts PLAYER_HIT_LEVELS) cut Zorua's margin on the undertow (1.12 < 1.3) and, on Nightmare, the last word (1.02 < 1.1): HP x0.84 and x0.9 restore them (odd/tasks/type-balance.md).
export const DHELMISE_CARDS_HARD = fight('dhelmise', [DHE_UNDERTOW(0.2), DHE_KELP(0.2), DHE_RIPTIDE(0.17), dheChain('hard', 0.13, false), DHE_TIDE, dheWhirl('hard', 0.13), DHE_BELL(0.17)], { ...WRECK, hpScale: 0.84 });
export const DHELMISE_CARDS_NIGHTMARE = fight('dhelmise', [
  DHE_UNDERTOW(0.14),
  DHE_KELP(0.15),
  DHE_RIPTIDE(0.17),
  dheChain('nightmare', 0.1, false),
  DHE_TIDE,
  DHE_BELL(0.14),
  dheWhirl('nightmare', 0.1),
  { id: 'sc-dhe-maelstrom', moves: ['maelstrom', 'riptide'], hpShare: 0.15, timerMs: 45_000 },
  { id: 'sc-dhe-lastword', moves: ['bell', 'maelstrom'], hpShare: 0.05, timerMs: 40_000, lastSpell: true },
], { ...WRECK, hpScale: 0.9 });

// --- Salazzle, la reina del humo (Toxic Swamp mid-boss) ------------------------

const SAL_DANCE = (hpShare: number): CardSpec => ({ id: 'sc-sal-dance', moves: ['dance'], hpShare, timerMs: 30_000 });
const SAL_SPIRAL = (hpShare: number): CardSpec => ({ id: 'sc-sal-spiral', moves: ['spiral', 'dance'], hpShare, timerMs: 35_000 });
const SAL_HAZE = (hpShare: number): CardSpec => ({ id: 'sc-sal-haze', moves: ['haze', 'spiral'], hpShare, timerMs: 35_000 });
const SAL_COURT = survival('sc-sal-court', ['spiral', 'haze'], 12_000);
/** Her retinue leaves with each card (no Salandit lingers into a declaration). */
const COURT = { dismiss: ['salandit'] } as const;

// The sparks take the haze's place on Normal (the lowest share); the haze stays on Hard and Nightmare.
export const SALAZZLE_CARDS_NORMAL = fight('salazzle', [SAL_DANCE(0.4), SAL_SPIRAL(0.35), salSparks('normal', 0.25)], COURT);
export const SALAZZLE_CARDS_HARD = fight('salazzle', [SAL_DANCE(0.36), SAL_SPIRAL(0.3), SAL_COURT, SAL_HAZE(0.16), salSparks('hard', 0.18)], { ...COURT, hpScale: 0.98 });
export const SALAZZLE_CARDS_NIGHTMARE = fight(
  'salazzle',
  [SAL_DANCE(0.26), SAL_SPIRAL(0.25), SAL_COURT, SAL_HAZE(0.18), salSparks('nightmare', 0.16), { id: 'sc-sal-lastword', moves: ['escort', 'dance', 'haze'], hpShare: 0.15, timerMs: 35_000, lastSpell: true }],
  { ...COURT, hpScale: 0.98 },
);

// --- Nihilego, la que cayó por la grieta del cielo (Toxic Swamp guardian) -------

const NIH_TENDRILS = (hpShare: number): CardSpec => ({ id: 'sc-nih-tendrils', moves: ['tendrils', 'spores'], hpShare, timerMs: 40_000 });
const NIH_SHARDS = (hpShare: number): CardSpec => ({ id: 'sc-nih-shards', moves: ['shards', 'spores'], hpShare, timerMs: 40_000 });
const NIH_WORMHOLE = (hpShare: number): CardSpec => ({ id: 'sc-nih-wormhole', moves: ['wormhole', 'tendrils'], hpShare, timerMs: 45_000, phase2: true });
const NIH_FLOOD = (hpShare: number): CardSpec => ({ id: 'sc-nih-flood', moves: ['flood', 'shards'], hpShare, timerMs: 45_000 });
const NIH_RIFT = survival('sc-nih-rift', ['spores', 'tendrils'], 15_000);

// The fracture takes the shards' place on Normal (the lowest share); the shards stay on Hard and Nightmare.
export const NIHILEGO_CARDS_NORMAL = fight('nihilego', [NIH_TENDRILS(0.36), nihFracture('normal', 0.09), NIH_WORMHOLE(0.27), NIH_FLOOD(0.28)], { hpScale: 0.9 });
export const NIHILEGO_CARDS_HARD = fight(
  'nihilego',
  [NIH_TENDRILS(0.17), NIH_SHARDS(0.19), nihFracture('hard', 0.12), NIH_WORMHOLE(0.16), NIH_RIFT, nihUpward('hard', 0.12), nihNeurotoxin('hard', 0.1), NIH_FLOOD(0.14)],
  { hpScale: 0.97 },
);
export const NIHILEGO_CARDS_NIGHTMARE = fight('nihilego', [
  NIH_TENDRILS(0.14),
  NIH_SHARDS(0.06),
  nihFracture('nightmare', 0.08),
  NIH_WORMHOLE(0.14),
  NIH_RIFT,
  nihUpward('nightmare', 0.08),
  NIH_FLOOD(0.14),
  nihNeurotoxin('nightmare', 0.07),
  { id: 'sc-nih-downpour', moves: ['downpour', 'spores'], hpShare: 0.14, timerMs: 45_000 },
  { id: 'sc-nih-lastword', moves: ['flood', 'downpour'], hpShare: 0.15, timerMs: 40_000, lastSpell: true },
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
