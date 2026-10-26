/**
 * `npx vite-node tools/type-balance.ts`: the type-chart study
 * (odd/tasks/type-balance.md, src/sim/type-balance.ts). Every study species
 * (the starters' base forms and every final form) with its default build and
 * a full investment, against every card boss (guardians, mid-bosses, Sima
 * echoes, Senda wounds) on Normal, Hard and Nightmare: the perfect bot plays
 * each fight on the real engine and every card is recorded; the candidate
 * fixes (compressed charts, a minimum duration per card) are applied to those
 * records. The proof's kill margins (src/sim/prove.ts) are recomputed under
 * each chart from the stored witnesses' punish windows.
 *
 *   npx vite-node tools/type-balance.ts                       → reports/balance/type-chart-baseline.md
 *   npx vite-node tools/type-balance.ts --out=reports/balance/type-chart-after.md --after
 *   --seeds=1,2   bot seeds (default 1,2)    --records=<file.json>   reuse/save the fights (iteration only)
 *
 * Never writes reports/balance/latest.md.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Difficulty } from '../src/data/difficulty';
import { MOVES } from '../src/data/moves';
import { SPECIES, STARTER_SPECIES, type SpeciesId } from '../src/data/species';
import { TUNING } from '../src/data/tuning';
import type { PokemonType } from '../src/data/types';
import { levelDamage } from '../src/core/progression';
import { stageBonus } from '../src/core/evolution';
import type { MoveId } from '../src/data/moves';
import { cardWorld, fightIn, judgeCard, KILL_MARGIN, KNOWN_KILL_GAPS, PROOF_CASES, reachOf, startsOf, type CardProof, type Witness } from '../src/sim/prove';
import {
  analyticDps,
  buildFor,
  CANDIDATE_RULES,
  cardBound,
  cardUnder,
  caseLabel,
  levelFor,
  moveRate,
  type StudyEntry,
  RAW_RULE,
  ruleEffectiveness,
  runFight,
  STUDY_CASES,
  STUDY_ENTRIES,
  type BuildKind,
  type Candidate,
  type ChartRule,
  type FightRecord,
} from '../src/sim/type-balance';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const after = args.includes('--after');
const out = flag('out') ?? (after ? 'reports/balance/type-chart-after.md' : 'reports/balance/type-chart-baseline.md');
if (/latest\.md$/.test(out)) throw new Error('the study never overwrites latest.md');
const seeds = (flag('seeds') ?? '1,2').split(',').map(Number);
const recordsPath = flag('records');
const TIERS: readonly Difficulty[] = ['normal', 'hard', 'nightmare'];
const BUILDS: readonly BuildKind[] = ['default', 'full'];
const FLOORS = [0, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6];
/** The tiered floor candidate. */
const TIERED: Partial<Record<Difficulty, number>> = { easy: 0, normal: 0.25, hard: 0.3, nightmare: 0.35 };
/** The human model: card times x this (the owner on Nihilego took 1.87x the bot). */
const HUMAN = 1.9;
/** A card "skipped": it ended before this share of its timer. */
const SKIP = 0.35;
/** An outlier fight: shorter than this share of its designed duration (or most of its cards skipped). */
const SHORT = 0.35;
/** The chart the engine plays now (the records were made under it). */
const RECORDED: ChartRule = RAW_RULE;
/** The card floor the engine plays now (the records already carry it). */
const RECORDED_FLOOR = ((): Readonly<Record<Difficulty, number>> | null => null)();

/** The owner's playtest, 2026-10-26: Chandelure (final, Maestro moves, Mejoras), Shrine reflections on Nightmare. */
const OWNER: Readonly<Record<string, number>> = { trevenant: 33.9, decidueye: 43.0, aegislash: 58.4, dhelmise: 58.6, nihilego: 142.5 };

/** The chosen fix and the report's recommendation (written after reading the tables above; numbers quoted from them). */
const CHOSEN_CANDIDATE: Candidate | null = { rule: CANDIDATE_RULES[2]!, floor: 0.35, floorByTier: { easy: 0 } };
const RECOMMENDATION: string[] = [
  '## Recommendation',
  '',
  '**Chart B (super-effective ×1.6, both types ×2.2 cap, resisted ×0.75, both ×0.5, immunity unchanged at ×0.25, STAB unchanged), for the player\'s hits on enemies only, plus a card floor of 35 % of the timer on Normal, Hard and Nightmare (none on Easy).**',
  '',
  '- **The skip is not only a type problem.** With the shipped chart the engine bot ends 1602 of 2016 fights under 35 % of the designed duration or with most cards skipped, and neutral fights skip too (bot median 30 % of designed; even a fresh Mimikyu with its default kit skips Aegislash on Normal). No chart alone fixes it: every chart leaves 1538–1634 outliers. Only a floor does.',
  '- **Floor 35 %** is the smallest that leaves no fight skipping a card in either model, and it puts the human model where the owner\'s "reasonable" Nihilego sits (53 % of designed): advantaged 47 %, neutral 53 %, disadvantaged 71 % (human ×1.9, chart B). Higher floors erase the type advantage (50 %: 9 %; 60 %: 6 %) and make neutral fights drag (median +9 % and +18 %, p90 +77 % and +107 %). Lower floors (25 %, 30 %) leave cards ending before a third of their timer.',
  '- **Chart B over A and C**: same proof cost as A (8 new margin shortfalls, all Zorua\'s Dark on the Ghost guardians; C has 11) and the most type advantage left under the floor (human model: 15 % median speed-up, p75 22 %; A 13 %, C 11 %). It removes the ×4 hits (×6 with STAB: Cubone and Marowak on Salazzle and Nihilego) and makes a resisted move hurt half again as much (disadvantaged fights 84 % → 71 % of designed: they drag less). The shipped chart with the same floor keeps a little more advantage (20 %) but keeps ×4 and ×0.25, which is what the owner asked to remove.',
  '- **Type advantage is still meaningful, inside the floor**: an advantaged species finishes a fight about 15 % sooner than it would with neutral hits (p75 22 %), below the 20–40 % hoped for: with a floor at 35 % and a human finishing neutral fights near 53 %, the room left for advantage is at most ~1 − 35/53 ≈ 34 %, and the fights that skipped hardest are exactly the ones the floor now holds. Above the floor the advantage is the full ×1.6 (×2.2 with both types).',
  '- **Neutral and disadvantaged species**: under the human model the median neutral or disadvantaged fight is not slower (+0 %), 347 of 888 are more than 5 % slower (p90 +35 %): those are the fights that were skipping cards too, now held to a third of their timers. None gets longer than its designed duration (the floor never extends a card past its timer).',
  '- **Proof**: the compressed chart lowers the reference starters\' kill margins where Zorua\'s Dark ×2 was the worst starter; the 8 cards that fall under their target (Aegislash Normal walls and swords, Aegislash Hard fans, Decidueye Nightmare rain and stitch, Dhelmise Hard undertow, Dhelmise Nightmare last word, Decidueye\'s echo on Nightmare feathers) are tuned back with the card fight\'s `hpScale` on those tiers, not added to the known gaps (the list may only shrink). Their extra speed is bounded by the floor.',
  '- **Feedback**: while the floor holds, a hit that would take the segment under the pace line is absorbed: "¡Aguanta!" / "It holds!" over the boss (a guard\'s sound), and guests see it from the snapshot.',
  '',
  '### Progression spread',
  '',
  '- **Today** (engine bot, shipped): full investment beats a fresh Mimikyu by a median ×1.2 on neutral matchups and up to ×7 with advantage (Decidueye\'s echo). The analytic sources (non-stop DPS) say why: Mejoras ×2 are the largest single lever (×1.56–×1.84: +20 % damage and rank effects such as marks, zones and extra throws), then the tutor tier (×0.82–×1.64, species-dependent), the stage bonus ×1.12, and the type chart (up to ×4 on top of STAB: Marowak ×5.9 on Salazzle and Nihilego). Shop upgrades hold no damage (×1.00). Fresh Mimikyu is already ×3 on the Ghost guardians (Shadow Claw), so the "abismal" gap shows on neutral bosses and against ×4 matchups.',
  '- **After the chosen fix** the floor caps the top end (no card under 35 % of its timer) and chart B cuts the type factor (×4 → ×2.2): on the engine bot the neutral spread goes from a median ×1.22 (range ×0.51–×3.82) to ×1.00 (×0.63–×1.78) and the advantaged maximum from ×7.04 to ×1.77, since a fresh Mimikyu and a full Chandelure both meet the floor on the Ghost guardians. For a human (slower than the bot) the spread above the floor stays: the analytic totals under chart B are ×1.2–×1.95 on neutral matchups, ×3.3 at most with advantage (Marowak, was ×5.9).',
  '- **Target**: full investment 1.8–2.5× faster than fresh on neutral matchups (analytic DPS), more only with type advantage, bounded by the floor. Today the neutral analytic spread is ×1.2–×1.95 (inside or under the target) and the engine spread ×1.2 median, so **no progression lever needs trimming now**. If a later change pushes it over ×2.5, trim the Mejoras\' rank effects first (the largest factor; keep the +10 % per rank, shrink the extra share of marks and zones), then the Maestro tier budget (×1.4). Not changed in this branch.',
  '',
];

const NEUTRAL_RULE: ChartRule = { name: 'neutral', superEffective: 1, doubleSuper: 1, resisted: 1, doubleResisted: 1 };

const caseOf = (label: string) => STUDY_CASES.find((x) => caseLabel(x.case) === label)!;
const bossTypes = (label: string): readonly PokemonType[] => SPECIES[caseOf(label).case.species].types;
const median = (xs: readonly number[]): number => {
  if (xs.length === 0) return Number.NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const pct = (x: number) => (Number.isFinite(x) ? `${Math.round(x * 100)} %` : '-');
const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

// ---- The fights ----
const started = performance.now();
let records: FightRecord[];
if (recordsPath && existsSync(recordsPath)) records = JSON.parse(readFileSync(recordsPath, 'utf8')) as FightRecord[];
else {
  records = [];
  for (const { case: c } of STUDY_CASES)
    for (const tier of TIERS)
      for (const entry of STUDY_ENTRIES)
        for (const build of BUILDS) for (const seed of seeds) records.push({ ...runFight(c, tier, seed, entry, build), seed } as FightRecord & { seed: number });
  // The owner's calibration: Chandelure with its own types' best moves, Nightmare.
  const chandelure = STUDY_ENTRIES.find((e) => e.label === 'chandelure')!;
  for (const boss of Object.keys(OWNER)) for (const seed of seeds) records.push({ ...runFight(caseOf(boss).case, 'nightmare', seed, chandelure, 'stab'), seed } as FightRecord & { seed: number });
  if (recordsPath) writeFileSync(recordsPath, JSON.stringify(records));
}
console.error(`fights: ${records.length} in ${((performance.now() - started) / 1000).toFixed(0)} s`);

const designedMs = (r: FightRecord) => r.cards.reduce((s, k) => s + k.timerMs, 0);
/** Card times of a record under a candidate (the records' own floor already applies). */
const timesUnder = (r: FightRecord, cand: Candidate) => r.cards.map((k) => cardUnder(k, cand, bossTypes(r.boss), r.tier, RECORDED));
const playMs = (r: FightRecord, cand: Candidate) => timesUnder(r, cand).reduce((s, t) => s + t, 0);
const skipped = (r: FightRecord, cand: Candidate, share = SKIP) => {
  const ts = timesUnder(r, cand);
  const hurtable = r.cards.filter((k) => !k.survival).length;
  return { n: r.cards.filter((k, i) => !k.survival && ts[i]! < share * k.timerMs - 1).length, of: hurtable };
};
/** Effectiveness the record's damage mostly came from (shipped chart). */
function dominantEff(r: FightRecord, rule: ChartRule = RAW_RULE): number {
  const total: Partial<Record<PokemonType, number>> = {};
  for (const k of r.cards) for (const [t, d] of Object.entries(k.byType)) total[t as PokemonType] = (total[t as PokemonType] ?? 0) + (d ?? 0);
  const top = (Object.entries(total) as [PokemonType, number][]).sort((a, b) => b[1] - a[1])[0];
  return top ? ruleEffectiveness(rule, top[0], bossTypes(r.boss)) : 1;
}
const klass = (r: FightRecord) => {
  const e = dominantEff(r);
  return e > 1 ? 'advantaged' : e < 1 ? 'disadvantaged' : 'neutral';
};
const study = records.filter((r) => r.build !== 'stab');
const outlier = (r: FightRecord, cand: Candidate) => {
  const s = skipped(r, cand);
  return playMs(r, cand) < SHORT * designedMs(r) || s.n > 0.5 * s.of;
};

// ---- Proof margins under each chart ----
interface MarginRow {
  key: string;
  boss: string;
  tier: Difficulty;
  card: string;
  margin: number;
  target: number;
  starter: SpeciesId | null;
}
const store = JSON.parse(readFileSync('reports/proof/witnesses.json', 'utf8')) as { cards: Record<string, (Witness | null)[]> };
const proofs: { proof: CardProof; species: SpeciesId; level: number }[] = [];
for (const pc of PROOF_CASES) {
  const label = caseLabel(pc.case);
  for (const tier of pc.tiers) {
    const fight = fightIn(cardWorld(pc.case, tier, 0), pc.case.species);
    if (!fight) continue;
    fight.cards.forEach((card, index) => {
      const proof = judgeCard(pc.case, tier, index, startsOf(pc.case), store.cards[`${label}/${tier}/${card.id}`] ?? []);
      proofs.push({ proof, species: pc.case.species, level: levelFor(pc.case, tier) });
    });
  }
}
/** The proof's reference DPS (src/sim/prove.ts `referenceDps`) under `rule`. */
function referenceDps(player: SpeciesId, boss: SpeciesId, level: number, rule: ChartRule): number {
  const def = SPECIES[player];
  let best = 0;
  for (const id of def.defaultLoadout.slice(0, 2)) {
    if (!id) continue;
    const m = MOVES[id];
    const stab = def.types.includes(m.type) ? TUNING.combat.stab : 1;
    const damage = Math.max(1, Math.round(m.power * TUNING.combat.damagePerPower * stab * ruleEffectiveness(rule, m.type, SPECIES[boss].types) * levelDamage(level)));
    best = Math.max(best, (damage * 1000) / (m.windupMs + m.activeMs + m.recoveryMs + (m.cooldownMs ?? 0)));
  }
  return best;
}
function margins(rule: ChartRule): MarginRow[] {
  return proofs.flatMap(({ proof: p, species, level }) => {
    if (p.survival) return [];
    let margin = Number.POSITIVE_INFINITY;
    let starter: SpeciesId | null = null;
    for (const player of STARTER_SPECIES) {
      const def = SPECIES[player];
      if (def.defaultLoadout.slice(0, 2).every((id) => !id || ruleEffectiveness(RAW_RULE, MOVES[id].type, SPECIES[species].types) < 1)) continue;
      const fast = MOVES[def.defaultLoadout[0]!];
      const window = reachOf(fast).kind === 'ranged' ? p.punish.fireMs : p.punish.meleeMs;
      const m = (referenceDps(player, species, level, rule) * window) / 1000 / p.segmentHp;
      if (m < margin) {
        margin = m;
        starter = player;
      }
    }
    return [{ key: `${p.boss}/${p.tier}/${p.card}`, boss: p.boss, tier: p.tier, card: p.card, margin, target: KILL_MARGIN[p.tier], starter }];
  });
}
const knownGap = (m: MarginRow) => KNOWN_KILL_GAPS.some((g) => g.boss === m.boss && g.tier === m.tier && g.card === m.card);

// ---- Report ----
const L: string[] = [];
const chartName = (r: ChartRule) => r.name;
L.push(after ? '# Type chart and card floor: after' : '# Type chart and card floor: baseline study', '');
L.push(
  `Generated by \`npx vite-node tools/type-balance.ts${after ? ' --after' : ''}\` (src/sim/type-balance.ts; odd/tasks/type-balance.md). ${records.length} engine fights, seeds ${seeds.join(', ')}. Engine chart while recording: **${RECORDED.name}**; card floor while recording: ${RECORDED_FLOOR ? `Normal ${pct(RECORDED_FLOOR.normal)}, Hard ${pct(RECORDED_FLOOR.hard)}, Nightmare ${pct(RECORDED_FLOOR.nightmare)}` : 'none'}.`,
  '',
  '## Method',
  '',
  '- **Who**: the four starters in their base form, and every final form (Mimikyu after both awakenings, Zoroark, Chandelure, Marowak, Alakazam, Empoleon, Luxray, Haxorus) with its stage bonus.',
  "- **Builds**: *default* = the species' default loadout, no Mejoras. *full* = its best fast and best heavy move against that boss from its whole movepool (any tier, Maestro included; ranked by the analytic rate below under the shipped chart), the default boost and area, every move at rank +2.",
  "- **Against**: every card boss (the 5 guardians and 3 mid-bosses at their room's floor), the 5 Sima echoes at the floor they first appear, and every Senda wound, on Normal, Hard and Nightmare, at the floor's expected level (`core/fairness.ts`): the setup of a Shrine reflection (no items, no shop upgrades).",
  '- **Engine bot** (the realistic number): the perfect balance bot (`src/sim/bots.ts`, no reaction lag, four slots) plays the whole fight on the real engine, unkillable (every hit still lands, nothing ends the run). Each card records its length, how it ended and the damage dealt by move type.',
  "- **Candidates** are applied to those records: a card's damage rate scales by the candidate chart's effectiveness over the recorded one (per move type), the card ends when its segment would be empty, never before `floor × timer`, never after its timer. Survival cards always last their timer. Declarations are left out of every duration (the designed duration is the sum of the timers).",
  '- **Analytic bound** (dodge-free upper bound): the build\'s best fast or heavy move hitting non-stop (`core/move-power.ts` damage rate, rank effects, STAB, level, stage).',
  `- **Skipped card**: a hurtable card that ends before ${pct(SKIP)} of its timer. **Outlier**: a fight shorter than ${pct(SHORT)} of its designed duration, or with more than half its hurtable cards skipped.`,
  "- **Proof margins**: the beatability proof's kill margin (`src/sim/prove.ts`: reference starters, default moves, punish windows of the stored witnesses) recomputed under each chart. The card floor does not change it (it only bounds how early a card can end).",
  '',
  "**Limits.** The bot is not a human: it never panics, never misreads a pattern and always takes its window, but it also does not exploit marks, zones or i-frames on purpose and plays the fast slot most. The owner's runs below say how far it sits from a strong human. Re-weighing a recorded card by the damage ratio assumes the bot's attack time does not depend on how hard it hits (true while the card's patterns repeat). The analytic bound ignores movement, guards and the boss's invulnerable declarations, so it is a floor on time, not a forecast.",
  '',
);

// Calibration.
const NIHILEGO_DESIGNED = designedMs(records.find((r) => r.boss === 'nihilego' && r.tier === 'nightmare')!);
L.push('## Calibration: the owner\'s Chandelure (Shrine reflections, Nightmare)', '');
L.push("Chandelure with its own types' best moves (Ghost and Fire, rank +2) versus the owner's times. The owner's times include declarations; so does the bot's *fight* column.", '');
L.push('| boss | best STAB × type | designed (Σ timers) | owner | owner / designed | bot fight (stab build) | bot play | owner / bot fight | bot full build (best moves) |', '|---|---|---|---|---|---|---|---|---|');
for (const boss of Object.keys(OWNER)) {
  const stab = records.filter((r) => r.build === 'stab' && r.boss === boss && r.tier === 'nightmare');
  const full = records.filter((r) => r.build === 'full' && r.entry === 'chandelure' && r.boss === boss && r.tier === 'nightmare');
  if (stab.length === 0) continue;
  const designed = designedMs(stab[0]!);
  const fight = median(stab.map((r) => r.fightMs));
  const play = median(stab.map((r) => playMs(r, { rule: RECORDED, floor: 0 })));
  const eff = dominantEff(stab[0]!) * 1.5;
  L.push(`| ${boss} | ×${eff.toFixed(2)} | ${secs(designed)} | ${OWNER[boss]!.toFixed(1)} s | ${pct((OWNER[boss]! * 1000) / designed)} | ${secs(fight)} | ${secs(play)} | ${((OWNER[boss]! * 1000) / fight).toFixed(2)} | ${secs(median(full.map((r) => r.fightMs)))} (${full[0]?.loadout.slice(0, 2).join(' + ')}) |`);
}
L.push(
  '',
  `Read: on the four Ghost bosses (×3 with STAB) the bot lands within about ±25 % of the owner (0.75–1.26), so it reproduces the skip; on Nihilego (×1.5, the owner's "no difícil pero más razonable") the owner took ${((OWNER.nihilego! * 1000) / median(records.filter((r) => r.build === 'stab' && r.boss === 'nihilego').map((r) => r.fightMs))).toFixed(1)}× the bot: a strong human is close to the bot when cards fall in seconds, and slower when they have to play through the patterns. The owner's reference for a reasonable fight is Nihilego's 2:22.5, ${pct((OWNER.nihilego! * 1000) / NIHILEGO_DESIGNED)} of its designed duration on Nightmare (${secs(NIHILEGO_DESIGNED)} of timers).`,
  '',
);

// Effective multipliers.
const bosses = STUDY_CASES.map((x) => caseLabel(x.case));
L.push('## Effective multiplier of the full build (best move: type × STAB), shipped chart', '');
L.push(`| species | ${bosses.join(' | ')} |`, `|---|${bosses.map(() => '---').join('|')}|`);
for (const entry of STUDY_ENTRIES) {
  const cells = bosses.map((b) => {
    const c = caseOf(b).case;
    const build = buildFor(entry, 'full', c.species);
    const best = analyticDps(entry, build, c.species, RAW_RULE, 1);
    const m = MOVES[best.move];
    return `×${(ruleEffectiveness(RAW_RULE, m.type, SPECIES[c.species].types) * (SPECIES[entry.species].types.includes(m.type) ? 1.5 : 1)).toFixed(2)}`;
  });
  L.push(`| ${entry.label} | ${cells.join(' | ')} |`);
}
L.push('');

// Per tier matrices under the recorded engine.
const now: Candidate = { rule: RECORDED, floor: 0 };
for (const build of BUILDS) {
  L.push(`## Fight length as a share of the designed duration: ${build} build (engine bot, ${after ? 'after' : 'shipped'})`, '');
  L.push(`Cell: play time / Σ timers, then skipped cards / hurtable cards. **Bold** = outlier.`, '');
  for (const tier of TIERS) {
    L.push(`### ${tier}`, '', `| boss | designed | ${STUDY_ENTRIES.map((e) => e.label).join(' | ')} |`, `|---|---|${STUDY_ENTRIES.map(() => '---').join('|')}|`);
    for (const b of bosses) {
      const rs = study.filter((r) => r.boss === b && r.tier === tier && r.build === build);
      if (rs.length === 0) continue;
      const cells = STUDY_ENTRIES.map((e) => {
        const mine = rs.filter((r) => r.entry === e.label);
        if (mine.length === 0) return '-';
        const share = median(mine.map((r) => playMs(r, now) / designedMs(r)));
        const sk = skipped(mine[0]!, now);
        const cell = `${pct(share)} · ${sk.n}/${sk.of}`;
        return mine.some((r) => outlier(r, now)) ? `**${cell}**` : cell;
      });
      L.push(`| ${b} | ${secs(designedMs(rs[0]!))} | ${cells.join(' | ')} |`);
    }
    L.push('');
  }
}

// Outliers.
const outs = study.filter((r) => outlier(r, now));
const pairs = new Set(outs.map((r) => `${r.entry} × ${r.boss} (${r.tier}, ${r.build})`));
L.push(`## Outliers (${after ? 'after' : 'shipped'})`, '');
L.push(`${pairs.size} species × boss × tier × build cells of ${new Set(study.map((r) => `${r.entry}/${r.boss}/${r.tier}/${r.build}`)).size} are outliers (fight < ${pct(SHORT)} of designed, or > 50 % of cards skipped).`, '');
const byClass = (cls: string) => outs.filter((r) => klass(r) === cls).length;
L.push(`By the dominant hit's effectiveness: advantaged ${byClass('advantaged')}, neutral ${byClass('neutral')}, disadvantaged ${byClass('disadvantaged')} (fights, both seeds).`, '');
const ownerRows = study.filter((r) => r.entry === 'chandelure' && r.build === 'full' && r.tier === 'nightmare' && ['trevenant', 'decidueye', 'aegislash', 'dhelmise'].includes(r.boss));
L.push(`Chandelure (full) vs the four Ghost guardians on Nightmare: ${ownerRows.filter((r) => outlier(r, now)).length}/${ownerRows.length} fights are outliers; median play ${pct(median(ownerRows.map((r) => playMs(r, now) / designedMs(r))))} of designed.`, '');
L.push('<details><summary>Every outlier cell</summary>', '', ...[...pairs].sort().map((p) => `- ${p}`), '', '</details>', '');

// Candidates.
L.push('## Candidates', '');
L.push(
  `Every candidate applied to the same records, under two models of the player: **bot** (the engine bot as recorded: a strong human on advantaged fights, see the calibration) and **human ×${HUMAN}** (every card's own time ×${HUMAN} before the floor and the timer: the owner on Nihilego). *Adv. speed-up*: for each advantaged fight, 1 − time / time with every hit neutral (same species, same boss): how much faster the type advantage makes it (target ~20–40 %). *Neutral/disadv. slower*: fights with a neutral or resisted dominant hit more than 5 % slower than shipped under the same model (the floor can only slow a fight that skipped cards). *Proof gaps*: kill gaps of the proof under that chart (known list: ${KNOWN_KILL_GAPS.length}); *new* = not on the known list. The tiered floor is Normal ${pct(TIERED.normal!)}, Hard ${pct(TIERED.hard!)}, Nightmare ${pct(TIERED.nightmare!)}.`,
  '',
);
const rules = after ? [RAW_RULE, RECORDED] : CANDIDATE_RULES;
const marginCache = new Map<string, MarginRow[]>();
const marginsOf = (rule: ChartRule) => {
  const hit = marginCache.get(rule.name) ?? margins(rule);
  marginCache.set(rule.name, hit);
  return hit;
};
const floorsToTry: { label: string; floor: number; floorByTier?: Candidate['floorByTier'] }[] = [...FLOORS.map((f) => ({ label: pct(f), floor: f })), { label: 'tiered', floor: 0, floorByTier: TIERED }];
const advFights = study.filter((r) => klass(r) === 'advantaged');
for (const slow of [1, HUMAN]) {
  L.push(`### ${slow === 1 ? 'Bot' : `Human ×${HUMAN}`}`, '');
  L.push('| chart | floor | outlier fights | fights skipping > 50 % | adv. speed-up, median (p25–p75) | median length / designed (adv · neutral · disadv) | neutral/disadv. slower (> 5 %) | their slow-down, median · p90 | proof gaps (new) |', '|---|---|---|---|---|---|---|---|---|');
  const shippedHere: Candidate = { rule: RAW_RULE, floor: 0, slow };
  for (const rule of rules) {
    const gaps = marginsOf(rule).filter((m) => m.margin < m.target);
    const fresh = gaps.filter((m) => !knownGap(m));
    for (const f of floorsToTry) {
      const cand: Candidate = { rule, floor: f.floor, slow, ...(f.floorByTier ? { floorByTier: f.floorByTier } : {}) };
      const neutralCand: Candidate = { ...cand, rule: NEUTRAL_RULE };
      const ups = advFights.map((r) => 1 - playMs(r, cand) / playMs(r, neutralCand));
      const share = (cls: string) => median(study.filter((r) => klass(r) === cls).map((r) => playMs(r, cand) / designedMs(r)));
      const rest = study.filter((r) => klass(r) !== 'advantaged');
      const slower = rest.filter((r) => playMs(r, cand) > 1.05 * playMs(r, shippedHere)).length;
      const downs = rest.map((r) => playMs(r, cand) / playMs(r, shippedHere) - 1).sort((x, y) => x - y);
      const q = (xs: readonly number[], at: number) => [...xs].sort((x, y) => x - y)[Math.min(xs.length - 1, Math.floor(at * xs.length))]!;
      const most = study.filter((r) => {
        const sk = skipped(r, cand);
        return sk.n > 0.5 * sk.of;
      }).length;
      L.push(`| ${chartName(rule)} | ${f.label} | ${study.filter((r) => outlier(r, cand)).length} / ${study.length} | ${most} | ${pct(median(ups))} (${pct(q(ups, 0.25))}–${pct(q(ups, 0.75))}) | ${pct(share('advantaged'))} · ${pct(share('neutral'))} · ${pct(share('disadvantaged'))} | ${slower} / ${rest.length} | +${pct(median(downs))} · +${pct(q(downs, 0.9))} | ${gaps.length} (${fresh.length}) |`);
    }
  }
  L.push('');
}
L.push('### Analytic bound (dodge-free, non-stop best move): median length / designed of advantaged fights', '');
L.push(`| chart | ${FLOORS.map(pct).join(' | ')} |`, `|---|${FLOORS.map(() => '---').join('|')}|`);
for (const rule of rules) {
  const cells = FLOORS.map((floor) =>
    pct(
      median(
        advFights.map((r) => {
          const c = caseOf(r.boss).case;
          const entry = STUDY_ENTRIES.find((e) => e.label === r.entry)!;
          const dps = analyticDps(entry, buildFor(entry, r.build, c.species), c.species, rule, r.level).dps;
          return r.cards.reduce((sum, k) => sum + cardBound(k.segmentHp, k.timerMs, k.survival, dps, floor), 0) / designedMs(r);
        }),
      ),
    ),
  );
  L.push(`| ${chartName(rule)} | ${cells.join(' | ')} |`);
}
L.push('');
for (const rule of rules) {
  const fresh = marginsOf(rule).filter((m) => m.margin < m.target && !knownGap(m));
  const healed = KNOWN_KILL_GAPS.filter((g) => {
    const m = marginsOf(rule).find((x) => x.boss === g.boss && x.tier === g.tier && x.card === g.card);
    return m && m.margin >= m.target;
  });
  if (fresh.length === 0 && healed.length === 0) continue;
  L.push(`**${chartName(rule)}**: new gaps ${fresh.length ? fresh.map((m) => `${m.key} ${m.margin.toFixed(2)} < ${m.target} (${m.starter})`).join('; ') : 'none'}; known gaps closed ${healed.length ? healed.map((g) => `${g.boss}/${g.tier}/${g.card}`).join('; ') : 'none'}.`, '');
}

// Per boss, Nightmare, full build: the candidates side by side.
const shipped: Candidate = { rule: RAW_RULE, floor: 0 };
const A = CANDIDATE_RULES[1]!;
const show: Candidate[] = [shipped, { rule: A, floor: 0 }, { rule: RAW_RULE, floor: 0.35 }, { rule: A, floor: 0.35 }, { rule: A, floor: 0.5 }, { rule: A, floor: 0, slow: HUMAN }, { rule: A, floor: 0.35, slow: HUMAN }];
L.push('## Nightmare, full build: median fight length / designed per boss', '');
L.push(`| boss | class | ${show.map((c) => `${c.rule.name}, floor ${pct(c.floor)}${c.slow ? `, human ×${c.slow}` : ''}`).join(' | ')} |`, `|---|---|${show.map(() => '---').join('|')}|`);
for (const b of bosses) {
  for (const cls of ['advantaged', 'neutral', 'disadvantaged']) {
    const rs = study.filter((r) => r.boss === b && r.tier === 'nightmare' && r.build === 'full' && klass(r) === cls);
    if (rs.length === 0) continue;
    L.push(`| ${b} | ${cls} (${new Set(rs.map((r) => r.entry)).size}) | ${show.map((c) => pct(median(rs.map((r) => playMs(r, c) / designedMs(r))))).join(' | ')} |`);
  }
}
L.push('');

// ---- Progression spread (owner, 2026-10-26: "la diferencia entre eso y el Mimikyu sin ascender es abismal") ----
/** The fix the report recommends (null until chosen): the spread is shown under it too. */
const CHOSEN: Candidate | null = CHOSEN_CANDIDATE;
const fresh = STUDY_ENTRIES.find((e) => e.label === 'mimikyu')!;
const finals = STUDY_ENTRIES.filter((e) => e.final);
/** Analytic best move of a build by raw rate × STAB × type (what `analyticDps` picks). */
const pick = (entry: StudyEntry, kind: BuildKind, boss: SpeciesId): MoveId => analyticDps(entry, buildFor(entry, kind, boss), boss, RAW_RULE, 1).move;
const rawBest = (entry: StudyEntry, boss: SpeciesId): MoveId => {
  const kit = buildFor(entry, 'default', boss).loadout.slice(0, 2).filter((m): m is MoveId => m !== null);
  return kit.reduce((a, b) => (moveRate(b, 0) > moveRate(a, 0) ? b : a));
};
/** Full investment of `entry` over a fresh Mimikyu on `boss`, as a product of its sources (analytic, same level). */
function decompose(entry: StudyEntry, boss: SpeciesId, rule: ChartRule) {
  const m0 = pick(fresh, 'default', boss);
  const md = rawBest(entry, boss);
  const ms = pick(entry, 'full', boss);
  const stab = (e: StudyEntry, m: MoveId) => (SPECIES[e.species].types.includes(MOVES[m].type) ? TUNING.combat.stab : 1);
  const eff = (m: MoveId) => ruleEffectiveness(rule, MOVES[m].type, SPECIES[boss].types);
  const parts = {
    upgrades: 1,
    species: moveRate(md, 0) / moveRate(m0, 0),
    tutor: moveRate(ms, 0) / moveRate(md, 0),
    ranks: moveRate(ms, 2) / moveRate(ms, 0),
    stage: 1 + stageBonus(entry.species, 1, entry.awakened).damage,
    stab: stab(entry, ms) / stab(fresh, m0),
    type: eff(ms) / eff(m0),
  };
  return { ...parts, total: Object.values(parts).reduce((a, b) => a * b, 1), move: ms };
}
const spreadRows = (cand: Candidate) =>
  TIERS.flatMap((tier) =>
    bosses.flatMap((b) => {
      const base = study.filter((r) => r.boss === b && r.tier === tier && r.entry === 'mimikyu' && r.build === 'default');
      const full = study.filter((r) => r.boss === b && r.tier === tier && r.build === 'full' && finals.some((e) => e.label === r.entry));
      if (base.length === 0 || full.length === 0) return [];
      const t0 = median(base.map((r) => playMs(r, cand)));
      const of = (cls: string) => full.filter((r) => klass(r) === cls).map((r) => t0 / playMs(r, cand));
      return [{ tier, boss: b, t0, designed: designedMs(base[0]!), adv: of('advantaged'), neutral: of('neutral'), all: full.map((r) => t0 / playMs(r, cand)) }];
    }),
  );
L.push('## Progression spread: fresh Mimikyu versus full investment', '');
L.push(
  'Fresh = Mimikyu with its default kit, no Mejoras, no awakening, no shop upgrades (they hold no damage: vitality, stamina, respite, reflexes, insight), at the same expected level. Full = every final form with its full build (best moves, rank +2, stage bonus). Spread = fresh play time / full play time on the engine bot (×, higher = full investment faster); per boss and tier the median over the final forms whose dominant hit is neutral, and the best advantaged one. Level is the same on both sides (a Shrine reflection fixes it), so it is not a source.',
  '',
);
const spreadTable = (cand: Candidate, title: string) => {
  const rows = spreadRows(cand);
  L.push(`### ${title}`, '', '| tier | boss | fresh play / designed | neutral finals: median × | advantaged finals: best × | all finals: median × |', '|---|---|---|---|---|---|');
  for (const r of rows) L.push(`| ${r.tier} | ${r.boss} | ${secs(r.t0)} / ${secs(r.designed)} | ${r.neutral.length ? `×${median(r.neutral).toFixed(2)}` : '-'} | ${r.adv.length ? `×${Math.max(...r.adv).toFixed(2)}` : '-'} | ×${median(r.all).toFixed(2)} |`);
  const neutral = rows.flatMap((r) => r.neutral);
  const adv = rows.flatMap((r) => r.adv);
  L.push('', `Overall: neutral median ×${median(neutral).toFixed(2)} (range ×${Math.min(...neutral).toFixed(2)}–×${Math.max(...neutral).toFixed(2)}); advantaged median ×${median(adv).toFixed(2)}, max ×${Math.max(...adv).toFixed(2)}.`, '');
  return { neutral: median(neutral), adv: median(adv), advMax: Math.max(...adv) };
};
const spreadNow = spreadTable(after ? { rule: RAW_RULE, floor: 0 } : now, after ? 'Shipped chart, no floor (re-weighed from these records)' : 'Shipped');
const spreadFix = CHOSEN ? spreadTable(CHOSEN, `With the chosen fix (${CHOSEN.rule.name}, floor ${pct(CHOSEN.floor)} on Nightmare)`) : null;

L.push('### Where the spread comes from (analytic, Nightmare, guardians and mid-bosses)', '');
L.push('Each factor is a ratio over the fresh Mimikyu\'s best default move on that boss; their product is the analytic DPS spread (no dodging). Median over the 8 card bosses, then the extremes.', '');
L.push('| final form | species kit | tutor tier | Mejoras ×2 | stage bonus | STAB | type (shipped) | shop | total shipped | type (chosen) | total chosen |', '|---|---|---|---|---|---|---|---|---|---|---|');
const caseBosses = STUDY_CASES.filter((x) => x.role === 'boss').map((x) => x.case.species);
for (const e of finals) {
  const ds = caseBosses.map((b) => decompose(e, b, RAW_RULE));
  const dc = caseBosses.map((b) => decompose(e, b, CHOSEN?.rule ?? RAW_RULE));
  const m = (k: keyof (typeof ds)[number]) => `×${median(ds.map((d) => d[k] as number)).toFixed(2)}`;
  L.push(`| ${e.label} | ${m('species')} | ${m('tutor')} | ${m('ranks')} | ${m('stage')} | ${m('stab')} | ${m('type')} | ×1.00 | ${m('total')} (max ×${Math.max(...ds.map((d) => d.total)).toFixed(2)}) | ×${median(dc.map((d) => d.type)).toFixed(2)} | ×${median(dc.map((d) => d.total)).toFixed(2)} (max ×${Math.max(...dc.map((d) => d.total)).toFixed(2)}) |`);
}
L.push('');
const ch = finals.find((e) => e.label === 'chandelure')!;
L.push('Chandelure, per boss (analytic sources, shipped → chosen):', '');
for (const b of caseBosses) {
  const d = decompose(ch, b, RAW_RULE);
  const c = decompose(ch, b, CHOSEN?.rule ?? RAW_RULE);
  L.push(`- ${b} (${d.move}): kit ×${d.species.toFixed(2)} · tutor ×${d.tutor.toFixed(2)} · Mejoras ×${d.ranks.toFixed(2)} · stage ×${d.stage.toFixed(2)} · STAB ×${d.stab.toFixed(2)} · type ×${d.type.toFixed(2)} = ×${d.total.toFixed(2)} → type ×${c.type.toFixed(2)} = ×${c.total.toFixed(2)}`);
}
L.push('');
void spreadNow;
void spreadFix;

L.push(...RECOMMENDATION);
const text = `${L.join('\n')}\n`;
writeFileSync(out, text);
// Per-cell summary (median over seeds), so the after report can compare with the shipped engine's own fights (TSV: reports/balance/*.json is ignored).
const tsv = ['key\tplayMs\tdesignedMs\tskipped\thurtable\tclass\tpredictedMs'];
for (const key of [...new Set(study.map((r) => `${r.boss}/${r.tier}/${r.entry}/${r.build}`))].sort()) {
  const rs = study.filter((r) => `${r.boss}/${r.tier}/${r.entry}/${r.build}` === key);
  const sk = skipped(rs[0]!, now);
  const predicted = CHOSEN && !after ? String(Math.round(median(rs.map((r) => playMs(r, CHOSEN))))) : '';
  tsv.push([key, Math.round(median(rs.map((r) => playMs(r, now)))), designedMs(rs[0]!), sk.n, sk.of, klass(rs[0]!), predicted].join('\t'));
}
writeFileSync(out.replace(/\.md$/, '.tsv'), `${tsv.join('\n')}\n`);
console.log(`type-balance: ${records.length} fights in ${((performance.now() - started) / 1000).toFixed(0)} s → ${out}`);
