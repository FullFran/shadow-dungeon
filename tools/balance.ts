/**
 * `npm run balance`: runs the balance sweep headless (src/sim) and writes
 * reports/balance/latest.md (committed: diff it before and after a
 * rebalance) and reports/balance/latest.json (ignored: every floor result).
 *
 *   npm run balance                 full sweep (about 3–4 min)
 *   npm run balance -- --quick      the CI subset (about 15 s)
 *   npm run balance -- --seeds=1,2  other seeds
 *   npm run balance -- --dungeon=crypt-of-the-sword-king --tier=nightmare
 *   npm run balance -- --quick --slots  the perfect/average bots also use boost and area (four-slots)
 *   npm run balance -- --quick --slots --species=zorua  another starter with its default loadout
 *   npm run balance -- --quick --slots --build=zorua    a starter with its recommended tutor build (data/tutor.ts)
 *
 * Exits 1 when a fairness invariant fails beyond the known violations.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDifficulty } from '../src/data/difficulty';
import { isPlayable } from '../src/data/species';
import { RECOMMENDED_BUILD } from '../src/data/tutor';
import type { StarterId } from '../src/data/learnsets';
import { DUNGEONS, type DungeonId } from '../src/data/dungeons';
import { evaluate, failures } from '../src/sim/bands';
import { renderJson, renderMarkdown } from '../src/sim/report';
import { CI_SWEEP, FULL_SWEEP, runSweep, type SweepConfig } from '../src/sim/sweep';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];

let config: SweepConfig = args.includes('--quick') ? CI_SWEEP : FULL_SWEEP;
const seeds = flag('seeds');
if (seeds) config = { ...config, seeds: seeds.split(',').map(Number) };
const dungeon = flag('dungeon');
if (dungeon) {
  if (!DUNGEONS.some((d) => d.id === dungeon)) throw new Error(`unknown dungeon ${dungeon}: ${DUNGEONS.map((d) => d.id).join(', ')}`);
  config = { ...config, dungeons: [dungeon as DungeonId] };
}
const tier = flag('tier');
if (tier) {
  if (!isDifficulty(tier)) throw new Error(`unknown tier ${tier}`);
  config = { ...config, tiers: [tier] };
}
if (args.includes('--slots')) config = { ...config, options: { ...config.options, slots: true } };
const species = flag('species') ?? flag('build');
if (species) {
  if (!isPlayable(species)) throw new Error(`unknown starter ${species}`);
  const loadout = flag('build') ? { loadout: RECOMMENDED_BUILD[species as StarterId] } : {};
  config = { ...config, options: { ...config.options, species, ...loadout } };
}
const outDir = flag('out') ?? join('reports', 'balance');

const started = performance.now();
const sweep = runSweep(config);
const checks = evaluate(sweep);
const elapsed = (performance.now() - started) / 1000;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'latest.md'), `${renderMarkdown(sweep, checks)}\n`);
writeFileSync(join(outDir, 'latest.json'), renderJson(sweep, checks));

const fails = failures(checks);
console.log(`balance: ${sweep.runs.length} runs, ${sweep.arenas.length} arena fights in ${elapsed.toFixed(1)} s → ${join(outDir, 'latest.md')}`);
console.log(`balance: ${fails.length} failures, ${checks.filter((c) => c.status === 'warn').length} warnings, ${checks.filter((c) => c.status === 'pass').length} passes`);
for (const f of fails) console.log(`  FAIL ${f.band} ${f.scope}: ${f.value} (target ${f.target})`);
process.exitCode = fails.length ? 1 : 0;
