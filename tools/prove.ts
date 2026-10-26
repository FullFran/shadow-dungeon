/**
 * `npm run prove`: the beatability proof (src/sim/prove.ts, docs/gdd.md
 * "Garantía de que todo se puede pasar"). Finds a walk-only witness for
 * every card of every card boss (and Sima echo variant) on every tier from
 * every start, and the solver bot's whole fights on Nightmare, and stores
 * them in reports/proof/witnesses.json (committed: the tests replay every
 * witness on the engine, so CI checks the proof without searching). Writes
 * the table to reports/proof/latest.md.
 *
 *   npm run prove                    keep the witnesses that still replay, search the rest
 *   npm run prove -- --fresh         search everything again
 *   npm run prove -- --boss=dhelmise only one boss (or echo label)
 *   npm run prove -- --jobs=4        parallel workers (one per boss; default 6)
 *   npm run prove -- --judge         no search: judge the stored witnesses again
 *
 * Exits 1 when a card has no witness or misses its punish or kill target.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROOF_CASES, FIGHT_SEEDS, fightIn, findWitness, judgeCard, judgeFight, proofFailures, renderProofs, solveFight, startsOf, cardWorld, type CardProof, type FightRun, type Witness } from '../src/sim/prove';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const outDir = join('reports', 'proof');
const storePath = join(outDir, 'witnesses.json');

interface Store {
  cards: Record<string, (Witness | null)[]>;
  fights: Record<string, string>;
}

const load = (): Store => (existsSync(storePath) && !args.includes('--fresh') ? (JSON.parse(readFileSync(storePath, 'utf8')) as Store) : { cards: {}, fights: {} });

/** One boss (or echo variant), every tier: keeps what still replays, searches the rest. */
function work(label: string, store: Store): Store {
  const c = PROOF_CASES.find((x) => (x.case.label ?? x.case.species) === label)!;
  const out: Store = { cards: {}, fights: {} };
  for (const tier of c.tiers) {
    const fight = fightIn(cardWorld(c.case, tier, 0), c.case.species);
    if (!fight) continue;
    const starts = startsOf(c.case);
    fight.cards.forEach((card, index) => {
      const key = `${label}/${tier}/${card.id}`;
      const old = store.cards[key] ?? [];
      const witnesses = starts.map((start, i) => {
        const kept = old[i] ?? null;
        if (kept && judgeCard(c.case, tier, index, [start], [kept]).survivable) return kept;
        const t0 = performance.now();
        const found = findWitness(c.case, tier, index, start);
        console.error(`${key} start ${i}: ${found ? found.mode : 'NONE'} in ${Math.round(performance.now() - t0)} ms`);
        return found;
      });
      out.cards[key] = witnesses;
    });
    if (c.fights.includes(tier)) {
      for (const seed of FIGHT_SEEDS) {
        const key = `${label}/${tier}/${seed}`;
        const kept = store.fights[key];
        if (kept && judgeFight(c.case, tier, seed, kept).cleared) {
          out.fights[key] = kept;
          continue;
        }
        const t0 = performance.now();
        const run = solveFight(c.case, tier, seed);
        console.error(`${key} fight: ${run.cleared ? 'cleared' : 'NOT cleared'} in ${Math.round(performance.now() - t0)} ms`);
        out.fights[key] = run.moves;
      }
    }
  }
  return out;
}

function runWorker(label: string, file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['vite-node', 'tools/prove.ts', `--worker=${label}`, `--out=${file}`, ...(args.includes('--fresh') ? ['--fresh'] : [])], { stdio: ['ignore', 'inherit', 'inherit'] });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`worker ${label} exited ${code}`))));
  });
}

async function main(): Promise<void> {
  const worker = flag('worker');
  if (worker) {
    writeFileSync(flag('out')!, JSON.stringify(work(worker, load())));
    return;
  }
  mkdirSync(outDir, { recursive: true });
  const store = load();
  const only = flag('boss');
  const labels = PROOF_CASES.map((x) => x.case.label ?? x.case.species).filter((l) => !only || l === only);
  const jobs = Number(flag('jobs') ?? 6);
  const started = performance.now();
  // `--judge`: no search, only the stored witnesses judged again (after a change to the judge or the report).
  const queue = args.includes('--judge') ? [] : [...labels];
  await Promise.all(
    Array.from({ length: Math.min(jobs, queue.length) }, async () => {
      for (let label = queue.shift(); label; label = queue.shift()) {
        const file = join('/tmp', `prove-${process.pid}-${label}.json`);
        await runWorker(label, file);
        const part = JSON.parse(readFileSync(file, 'utf8')) as Store;
        Object.assign(store.cards, part.cards);
        Object.assign(store.fights, part.fights);
      }
    }),
  );
  writeFileSync(storePath, `${JSON.stringify(store, null, 0)}\n`);
  // Judge everything from the stored witnesses (what the tests do).
  const proofs: CardProof[] = [];
  const runs: FightRun[] = [];
  for (const c of PROOF_CASES) {
    const label = c.case.label ?? c.case.species;
    for (const tier of c.tiers) {
      const fight = fightIn(cardWorld(c.case, tier, 0), c.case.species);
      if (!fight) continue;
      fight.cards.forEach((card, index) => proofs.push(judgeCard(c.case, tier, index, startsOf(c.case), store.cards[`${label}/${tier}/${card.id}`] ?? [])));
      if (c.fights.includes(tier)) for (const seed of FIGHT_SEEDS) runs.push(judgeFight(c.case, tier, seed, store.fights[`${label}/${tier}/${seed}`] ?? ''));
    }
  }
  writeFileSync(join(outDir, 'latest.md'), renderProofs(proofs, runs));
  const fails = proofFailures(proofs);
  console.log(`prove: ${proofs.length} cards (${proofs.filter((p) => p.survivable).length} survivable), ${runs.filter((r) => r.cleared).length}/${runs.length} solver fights cleared in ${((performance.now() - started) / 1000).toFixed(0)} s → ${join(outDir, 'latest.md')}`);
  for (const f of fails) console.log(`  FAIL ${f}`);
  process.exitCode = fails.length ? 1 : 0;
}

void main();
