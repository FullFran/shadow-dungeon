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
- [ ] T2 Rank effects (data + generic kinds + tests) + every move rankable + rank prices by tier.
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
- T1 (route: inline in this bounded writer; the parent delegated the whole feature to one writer): RED observed (tests/data/tutor-moves.test.ts failed to import core/move-power; tests/core/tutor.test.ts 2 of 11 failed; tests/town/leaderboard.test.ts 1 failed), then GREEN. core/move-power.ts: `damageRate`, `effectFactor` (a damage over time counts half its share, a crit bonus its expected extra), `slotBaseline`, `budgetRatio`, `costsOf` (recoil, HP, heavy cooldown, stamina ≥ 5/35/40 for fast/heavy/area, wind-up ≥ 1.25× the slowest kit move of the slot). data/tutor.ts: `MoveTier`, `TIER_BUDGET` (1 / 1.2 / 1.4), `HARD_CEILING` 1.75 (used by T2), `MASTER_MOVES` (13 Maestro moves, 7 locked behind the Crypt or the Misty Forest), `moveTier`, `unlockOf`, Maestro prices 450 / 800 / 600 / 950 (fast / heavy / boost / area). Maestro moves retimed to ×1.30–1.38 with two costs each (wood-hammer, double-edge, focus-punch, flare-blitz, fire-blast, sludge-bomb heavy; thunder, phantom-force, hyper-voice, fire-spin, ice-beam area: 660 ms wind-up + 40–45 stamina and a shorter cooldown); curse and belly-drum are the Maestro boosts (HP cost). Avanzado moves above ×1.0 without a cost were slowed (slash, night-slash, fire-punch) or given one (scorching-sands stamina 35). core/tutor.ts: `tutorLock`, `buyMove` refuses a locked Maestro move, `buildTag`; app/tutor.ts + main pass the cleared dungeons.
- T1 shrine decision: core/shrine.ts keeps `moveRanks` (still drops `upgrades`); app/game.ts no longer drops Mejoras in the pure dungeon; the Sima's score keeps `build` (town/leaderboard.ts, validated). GDD §Movimientos y maestro and §modo puro updated.
- T1 checks: npm test 193 files / 2276 tests passed; typecheck clean.
