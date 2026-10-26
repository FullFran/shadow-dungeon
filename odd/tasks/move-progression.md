# move-progression

## Objective
Buying moves at Smeargle's tutor must make a starter stronger: every move has a power tier (Básico, Avanzado, Maestro) with a budget relative to its slot/shape baseline, paid with real costs, and every move can be ranked up twice at the tutor, each rank adding a distinct designed effect besides the numbers.

## Problem
After odd/tasks/movepools.md every tutor move was capped at the best original move of its slot and shape (+25 % with recoil or a heavy cooldown), so a bought move was a side-grade at best ("¿para qué comprarlos?"), and only the starting kit could be ranked, with numbers only (+10 % damage / −10 % cooldown).

## Why
User feedback (2026-10-26): "hará falta poder tener movimientos más fuertes, si no ¿para qué comprarlos? Y las versiones más fuertes podrían añadir cosas además de pegar más y recargarse más rápido."

## Scope
- T1 Power tiers: Básico = starting kit (baseline ×1.0), Avanzado up to ×1.2, Maestro up to ×1.4 effective damage (damage over time and crit bonus counted), paid with costs (recoil, HP cost, a heavy cooldown, extra stamina, a longer wind-up); a move over ×1.0 needs one cost, over ×1.2 two; prices scale with tier; some Maestro moves unlock after clearing a dungeon. Tier-aware budget test plus a hard ceiling with full ranks.
- T2 Effect-based ranks: every move (kit and tutor) has ranks +1 and +2 at the tutor, each adding a distinct effect from a small set of generic kinds (crit, size, damage-over-time chance, mark + burst, split, weaken target, lingering zone, extra hit, return, chain, super-armor, i-frames, buff, drain, stagger, homing, heal), designed per move in data (`RANK_EFFECTS`), each kind tested; rank prices scale with tier.
- T3 UI: tutor window tier badge, per-rank effect text and next-rank preview; loadout rank stars; GDD tables (Spanish).
- T4 Balance: default vs best builds per species (`npm run balance -- --quick --slots`), full-investment boss TTK vs default; `src/sim/kill-gaps.ts` only if gaps close (never add).

## Constraints
- Allowed surfaces: odd/tasks/move-progression.md, src/**, tests/**, tools/**, index.html, README.md, docs/gdd.md, reports/**.
- Default loadouts and moves unchanged (golden digest unchanged); every existing test, the prove CI subset and the architecture test stay green.
- Enemy fairness untouched: the one-hit cap (reference HP) and telegraphs are enemy-side; this feature only changes player damage, plus effects that reduce damage taken.
- One work-unit commit per task, Conventional Commits, explicit paths, no AI attribution; no push/merge.
- PokeSurvivor: ideas only (move evolutions), no code or data.

## Decisions
- 2026-10-26 (user, via coordinator): the shrine (Santuario de los Juramentos: Reflejos, Desafíos, online trials) uses the player's learned moves, tiers and Mejora ranks. It is a farming game: progression counts everywhere. The old rule "Mejoras are dropped in shrine trials and pure runs" is removed. The Sima's "modo puro" is a property of the dungeon, not a separate toggle, so it no longer drops Mejoras either (it still drops Poochyena's shop upgrades, which this feature does not touch). Any ranking records the build (tiers/ranks) alongside the time instead of forcing stats flat.

## Delivery strategy
ask-on-risk; forecast ~2,500 authored changed lines (mostly data, effects and tests). One branch `feat/move-progression`, one commit per task; PR slicing is the user's decision.

## Tasks
- [x] T1 Power tiers + tier-aware budget test + prices + dungeon unlocks + shrine decision.
- [x] T2 Rank effects (data + generic kinds + tests) + every move rankable + rank prices by tier.
- [ ] T3 Tutor/loadout UI + GDD tables.
- [ ] T4 Balance + TTK comparison + report.

## Acceptance
- `npm test`, `npm run build` green; architecture test green; golden digest unchanged.
- Every move has a tier; budget test per tier with a hard ceiling; costs required above ×1.0 / ×1.2.
- Every move has two rank effects, each kind covered by a deterministic test.
- Shrine trials keep learned moves and ranks (test).

## Checks
npm test, npm run build, npm run balance -- --quick --slots (default and --build), prove CI subset (tests/sim).

## Progress
- Branch feat/move-progression from main 86b9fcb. Baseline: npm test 193 files / 2240 tests passed; `npm run balance -- --quick --slots` 0 failures, 42 warnings, 71 passes.
- T1 (route: inline in this bounded writer; the parent delegated the whole feature to one writer): RED observed (tests/data/tutor-moves.test.ts failed to import core/move-power; tests/core/tutor.test.ts 2 of 11 failed; tests/town/leaderboard.test.ts 1 failed), then GREEN. core/move-power.ts: `damageRate`, `effectFactor` (a damage over time counts half its share, a crit bonus its expected extra), `slotBaseline`, `budgetRatio`, `costsOf` (recoil, HP, heavy cooldown, stamina ≥ 5/35/40 for fast/heavy/area, wind-up ≥ 1.25× the slowest kit move of the slot). data/tutor.ts: `MoveTier`, `TIER_BUDGET` (1 / 1.2 / 1.4), `HARD_CEILING` (used by T2), `MASTER_MOVES` (13 Maestro moves, 7 locked behind the Crypt or the Misty Forest), `moveTier`, `unlockOf`, Maestro prices 450 / 800 / 600 / 950 (fast / heavy / boost / area). Maestro moves retimed to ×1.30–1.38 with two costs each (wood-hammer, double-edge, focus-punch, flare-blitz, fire-blast, sludge-bomb heavy; thunder, phantom-force, hyper-voice, fire-spin, ice-beam area: 660 ms wind-up + 40–45 stamina and a shorter cooldown); curse and belly-drum are the Maestro boosts (HP cost). Avanzado moves above ×1.0 without a cost were slowed (slash, night-slash, fire-punch) or given one (scorching-sands stamina 35). core/tutor.ts: `tutorLock`, `buyMove` refuses a locked Maestro move, `buildTag`; app/tutor.ts + main pass the cleared dungeons.
- T1 shrine decision: core/shrine.ts keeps `moveRanks` (still drops `upgrades`); app/game.ts no longer drops Mejoras in the pure dungeon; the Sima's score keeps `build` (town/leaderboard.ts, validated). GDD §Movimientos y maestro and §modo puro updated.
- T1 checks: npm test 193 files / 2276 tests passed; typecheck clean.
- T2 (route: inline): every move (87) has rank +1 and +2 in data/rank-effects.ts (`RANK_EFFECTS`), from 17 generic kinds folded into the move by core/rank-effects.ts `rankedMove` (memoized; rank 0 returns the plain object, so a plain run is byte-identical: golden digest green). New generic MoveDef fields any move may carry: `dotChance`, `mark`, `split`, `weaken`, `zone` (impact / self aftershock / line along a wave, armed after a delay, minor silent ticks), `rethrow`, `chain`, `ward` (super-armor = damage taken scaled: the player has no stagger to armor against), `iframes` (active phase; positional hits still land), `heal`. Enemy side: `EnemyState.mark` (bursts later, card floor holds), `weakened` (spawnShot and contact damage × factor). Rank prices by tier: Básico 150/350, Avanzado 250/500, Maestro 400/750; any known move can be ranked; save keeps ranks of kit + offer moves. Area moves no longer get −10 % cooldown per rank (only boosts do): their ranks add effects instead, under the hard ceiling. `HARD_CEILING` raised to 1.9 (full rank: ×1.2 damage and the effects' expected extra single-target damage, `extraShare`); boosts are capped at 1.9× their plain buff value. RED observed in development: 12 ceiling failures (ember, inferno, bonemerang, flamethrower, sludge-bomb, temper-flare, fire-punch, scorching-sands; nasty-plot, hone-claws, agility, focus-energy) fixed by the 1.9 ceiling, counting `dotChance` in `effectFactor` and smaller boost ranks; 5 of 16 kind tests failed first (three test set-ups, two real bugs: a ranked boomerang that ran out on its way home was never thrown again; the quake aftershock ring was smaller than the knockback, now 1.35× the range). Co-op limit: zones, splits, chains, marks and weakenings are host/solo only (a guest sees its own hit, not these).
- T2 checks: npm test 195 files / 2382 tests passed; typecheck clean.
