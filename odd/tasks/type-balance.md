# type-balance

## Objective
Type advantage must stay meaningful without letting a player skip the spell cards: compress the type chart for the player's hits on enemies and give every spell card a minimum duration, both chosen by simulation first.

## Problem
Owner playtest (2026-10-26), Shrine reflections on Nightmare with Chandelure (Ghost/Fire, final stage, Maestro moves, Mejoras): Trevenant 0:33.9, Decidueye 0:43.0, Aegislash 0:58.4, Dhelmise 0:58.6 (Ghost bosses, ×2 on both STABs → ×3), while Aegislash's Nightmare timers sum to ~4–5 min. Nihilego (×1.5 best STAB) took 2:22.5 and felt "no difícil pero más razonable". The bosses' danmaku does not depend on the player's type, so type advantage is one-way and lets players skip the cards. Also: "la diferencia entre eso y el Mimikyu sin ascender es abismal" (progression spread).

## Why
Owner decision: do both (1) compress the type chart and (2) a minimum duration per spell card — "pero primero haz las simulaciones, estudia".

## Scope
- T1 Study: `tools/type-balance.ts` + `src/sim/type-balance.ts`, baseline report `reports/balance/type-chart-baseline.md` (never `latest.md`): every study species (starters' base forms, every final form) × default/full build × every card boss (guardians, mid-bosses, Sima echoes, Senda wounds) × Normal/Hard/Nightmare on the engine bot; calibration against the owner's times; outliers; candidates (charts A/B/C × floors 0/0.35/0.5/0.6) with proof margins; progression spread with its sources; recommendation.
- T2 Implementation: chosen chart rule (player → enemy only) and card floor as data; "aguanta" feedback (es/en); tests; proof/kill gaps kept (only shrink).
- T3 After: `reports/balance/type-chart-after.md`, `npm run balance -- --quick` comparison to a scratch dir, GDD note (Spanish).

## Constraints
- Allowed surfaces: src/**, tests/**, tools/**, reports/balance/**, reports/proof/**, docs/gdd.md, odd/tasks/type-balance.md.
- Enemy fairness untouched: only damage dealt TO enemies and card pacing change; enemy → player damage keeps the Gen 6+ chart.
- Survival cards and last-spell semantics unchanged; a card never lasts past its timer.
- Engine change generic (other agents are adding Senda bosses): every card boss, hosted cards, echoes, wounds and heralds read the same rule.
- No progression numbers changed beyond what the fix needs (spread: recommend only).
- Conventional Commits, explicit paths, no AI attribution, no push.

## Decisions
- 2026-10-26 (study, reports/balance/type-chart-baseline.md): chart B (x1.6, cap x2.2, resist x0.75, both x0.5, immunity x0.25, STAB x1.5) for the player's hits only; card floor 35 % on Normal/Hard/Nightmare, none on Easy. Floor mechanism: the segment keeps its last HP (`HOLD_HP`) until `share x timer` ("¡Aguanta!"), chosen over a descending pace line because the line also absorbed early bursts of players who would never finish early (false "aguanta").
- Proof: the compressed chart dropped Zorua's kill margin on 8 cards; tuned back with `hpScale` (Aegislash Normal 0.8, Hard 0.9; Decidueye Nightmare 0.95; Dhelmise Hard 0.84, Nightmare 0.9) instead of new known gaps.
- Progression spread: recommend only (no lever trimmed).

## Tasks
- [x] T1 Study tool + baseline report (route: inline; one module + one tool, already mapped). Commit 3f86994.
- [x] T2 Engine: chart rule + card floor + feedback + tests (route: inline; the change was mapped in T1). Commit d616ed6.
- [x] T3 After report, balance comparison, GDD note (route: inline). Commit: this one (see git log).

## Parity checklist
- [x] Card bosses with pattern cards (core/cards.ts `updateCardFight`): `holdCard` each step and at the declaration's end.
- [x] Hosted card bosses (`updateHostedCardFight`): same.
- [x] Heralds (core/herald/brain.ts): `holdBoss` in play and at the card's start; the hold is dropped on a new card and the awakening.
- [x] Sima echoes: the floor follows the echo's own (scaled) timer; echo kill margins checked by the proof.
- [x] Senda wounds: shared engine; tests/sim/wound-prove.test.ts 18/18 green under the new chart.
- [x] Co-op: host clamps (combat, sync claims, afflictions, rank-effect marks) all read `cardHpFloor`; `held` travels in the host snapshot (stripped on merge when absent); the host emits `cardHold` for claims too.
- [x] Player damage paths (strike, blocked chip, projectiles through `strikeEnemy`) pass `onEnemy`; Expert Belt reads `hitEffectiveness`; enemy contact and enemy shots keep `typeEffectiveness` (test over every playable species and type).
- [x] UI: move-info "effective against" reads the player's chart; damage-number colours unchanged in sign; "¡Aguanta!" / "It holds!" (`hud.cardHold`) with the blocked sound.
- [x] GDD (§9 rule 9, the table row, proof notes), proof report, kill gaps unchanged (23).

## Progress
- 2026-10-26: branch `balance/type-chart` from main b87190d.
- T1: 2016 engine-bot fights + 10 calibration fights; recommendation chart B + 35 % floor (reports/balance/type-chart-baseline.md).
- T2: engine change; 8 proof margin shortfalls (all Zorua's Dark x2 on the Ghost guardians) tuned back with hpScale; solver fights re-solved (24/24).
- T3: reports/balance/type-chart-after.md: outliers 814 → 0 cells, skipped cards 2943 → 0, prediction error 3–5 % of designed; quick balance comparison in the scratchpad (gate PASS before and after, 0 failures; warnings 39 → 39; the perfect bot at level 1 now dies in the isolated Nightmare Sableye arena, 2/2 felled → 0/2, because the fight can no longer be burst).

## Verification evidence
- `npm run typecheck`: exit 0.
- `npx vitest run --testTimeout=30000 --maxWorkers=4`: 250 files, 3115 tests passed.
- `npm run build`: exit 0.
- `npm run prove`: 166 cards (166 survivable), 24/24 solver fights cleared, exit 0; known kill gaps 23 (unchanged).

## Next step
Owner playtest on Nightmare reflections (Chandelure vs the Ghost guardians, a neutral species vs Nihilego) to check the human model (×1.9) and the "¡Aguanta!" readability; a full `npm run balance` before merging if the owner wants latest.md refreshed.
