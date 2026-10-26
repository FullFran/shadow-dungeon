/**
 * `npx vite-node tools/degenerate-offense.ts [items] [tier]`: the offensive half of the
 * degenerate-build audit (odd/tasks/degenerate-builds.md B2). The perfect bot (four slots)
 * plays every fixed arena (guardians, mid-bosses, the Sima to floor 5) on Nightmare, seeds
 * 1-2, with each starter's full build at rank +2 and the given held items (comma list):
 * bosses won, median boss TTK and damage taken per fight. Compare a run without items to one
 * with every damage item at its cap to see whether stacking them trivialises a boss.
 */
import { DUNGEONS } from '../src/data/dungeons';
import type { ItemId } from '../src/data/items';
import type { MoveId } from '../src/data/moves';
import { FULL_BUILD, MAX_RANK } from '../src/data/tutor';
import { arenaFloors, runFloor } from '../src/sim/runner';
const items = (process.argv[2] ?? '').split(',').filter(Boolean) as ItemId[];
const tier = (process.argv[3] ?? 'nightmare') as 'nightmare';
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)]! : NaN; };
for (const sp of ['mimikyu', 'zorua', 'litwick', 'cubone'] as const) {
  const kit = FULL_BUILD[sp];
  const ranks = Object.fromEntries(kit.map((m) => [m, MAX_RANK])) as Partial<Record<MoveId, number>>;
  const ttks: number[] = [];
  let won = 0;
  let n = 0;
  let taken = 0;
  for (const d of DUNGEONS)
    for (const seed of [1, 2])
      for (const floor of arenaFloors(d.id, 5)) {
        const r = runFloor({ dungeon: d.id, tier, bot: 'perfect', party: 1, seed }, floor, { maxFloors: 5, slots: true, species: sp, loadout: kit, moveRanks: ranks, items });
        n++;
        taken += r.damage;
        if (r.bossTtkMs !== null) { won++; ttks.push(r.bossTtkMs); }
      }
  console.log(sp, 'won', won, '/', n, 'median ttk', (median(ttks) / 1000).toFixed(1), 's', 'taken/fight', Math.round(taken / n));
}
