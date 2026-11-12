/**
 * The Nightmare card HP band (odd/tasks/nightmare-tuning.md N1,
 * data/nightmare-band.ts): measures every Nightmare card's kill margin with
 * no band and prints the segment HP factor that brings it into
 * [NIGHTMARE_BAND.min, NIGHTMARE_BAND.max] (src/sim/band.ts `bandFactors`).
 *
 * The band's home cases are the card bosses in their own arenas: the
 * guardians (stored witnesses, reports/proof/witnesses.json), the Sendas'
 * shadows and wounds (searched live, as their tests do). The Sima echoes,
 * the Sima's story bosses and the older bosses reused on gacha roads only
 * bound a factor from below: none of them may drop under its kill target.
 * Margins are measured on the current data and divided back by the current
 * factor, so a run on banded data gives the same table.
 *
 *   npx vite-node tools/nightmare-band.ts           print the table
 *   npx vite-node tools/nightmare-band.ts --write   rewrite data/nightmare-band.ts
 *   npx vite-node tools/nightmare-band.ts --jobs=4  parallel workers (default 6)
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import store from '../reports/proof/witnesses.json';
import type { Difficulty } from '../src/data/difficulty';
import { NIGHTMARE_CARD_HP } from '../src/data/nightmare-band';
import { bandFactors, type BandSample } from '../src/sim/band';
import { CARD_BOSSES, cardWorld, ECHO_BOSSES, fightIn, judgeCard, KNOWN_KILL_GAPS, proveCard, REUSED_BOSSES, SHADOW_BOSSES, SIMA_STORY_CASES, startsOf, WOUND_BOSSES, woundOnTier, type BossCase, type CardProof, type Witness } from '../src/sim/prove';

const TIER: Difficulty = 'nightmare';
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const cards = (store as { cards: Record<string, (Witness | null)[]> }).cards;

/** One case to measure: `stored` replays the witnesses under `key` (its home label), else a live search. */
interface Job {
  boss: BossCase;
  home: boolean;
  stored?: string;
}

const JOBS: readonly Job[] = [
  ...CARD_BOSSES.map((boss) => ({ boss, home: true, stored: boss.label ?? boss.species })),
  ...ECHO_BOSSES.map((boss) => ({ boss, home: false, stored: boss.label ?? boss.species })),
  ...REUSED_BOSSES.filter((r) => r.tiers.includes(TIER)).map((r) => ({ boss: r.boss, home: false, stored: r.boss.species })),
  ...SHADOW_BOSSES.map((boss) => ({ boss, home: true })),
  ...WOUND_BOSSES.map((w) => ({ boss: woundOnTier(w, TIER), home: true })),
  ...SIMA_STORY_CASES.map((boss) => ({ boss, home: false })),
];

const gap = (p: CardProof): boolean => KNOWN_KILL_GAPS.some((g) => g.boss === p.boss && g.tier === p.tier && g.card === p.card);

function measure(job: Job): BandSample[] {
  const fight = fightIn(cardWorld(job.boss, TIER, 0), job.boss.species);
  if (!fight) return [];
  const starts = startsOf(job.boss);
  return fight.cards.flatMap((card, index) => {
    if (card.survival) return [];
    const p = job.stored ? judgeCard(job.boss, TIER, index, starts, cards[`${job.stored}/${TIER}/${card.id}`] ?? []) : proveCard(job.boss, TIER, index, starts);
    if (!p.survivable) console.error(`  not survivable: ${p.boss} ${card.id} (${p.failures.join('; ')})`);
    const factor = NIGHTMARE_CARD_HP[card.id] ?? 1;
    return [{ card: card.id, home: job.home, margin: p.margin * factor, target: p.marginTarget, ...(gap(p) ? { gap: true } : {}), boss: p.boss } as BandSample];
  });
}

function runWorker(i: number, n: number, file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['vite-node', 'tools/nightmare-band.ts', `--worker=${i}`, `--of=${n}`, `--out=${file}`], { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`worker ${i} exited ${code}`))));
  });
}

/** Rewrites the table between the markers of data/nightmare-band.ts. */
function write(factors: Record<string, number>): void {
  const path = join('src', 'data', 'nightmare-band.ts');
  const text = readFileSync(path, 'utf8');
  const rows = Object.entries(factors).map(([id, f]) => `  '${id}': ${f},`);
  const next = text.replace(/( *\/\/ band:begin\n)[\s\S]*?( *\/\/ band:end)/, `$1${rows.map((r) => `${r}\n`).join('')}$2`);
  writeFileSync(path, next);
}

async function main(): Promise<void> {
  const worker = flag('worker');
  if (worker !== undefined) {
    const n = Number(flag('of'));
    const mine = JOBS.filter((_, i) => i % n === Number(worker));
    writeFileSync(flag('out')!, JSON.stringify(mine.flatMap(measure)));
    return;
  }
  const started = performance.now();
  const n = Number(flag('jobs') ?? 6);
  const files = Array.from({ length: n }, (_, i) => join('/tmp', `nightmare-band-${process.pid}-${i}.json`));
  await Promise.all(files.map((f, i) => runWorker(i, n, f)));
  const samples = files.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')) as (BandSample & { boss: string })[]);
  const { factors, capped } = bandFactors(samples, NIGHTMARE_CARD_HP);
  const homes = samples.filter((s) => s.home && !s.gap && Number.isFinite(s.margin) && s.margin > 0).map((s) => s.margin / (factors[s.card] ?? 1));
  console.log(`nightmare-band: ${samples.length} card samples (${samples.filter((s) => s.home).length} home) in ${((performance.now() - started) / 1000).toFixed(0)} s`);
  console.log(`  ${Object.keys(factors).length} cards raised; home margins after: min ${Math.min(...homes).toFixed(2)}, max ${Math.max(...homes).toFixed(2)}`);
  for (const [id, f] of Object.entries(factors)) console.log(`  ${id}: ×${f}${capped.includes(id) ? ' (capped by a case at its target)' : ''}`);
  for (const id of capped.filter((c) => !(c in factors))) console.log(`  ${id}: above the band, held at ×1 by a case at its target`);
  if (args.includes('--write')) write(factors);
}

void main();
