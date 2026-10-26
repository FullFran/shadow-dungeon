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

## Tasks
- [ ] T1 Study tool + baseline report (route: inline; one module + one tool, already mapped).
- [ ] T2 Engine: chart rule + card floor + feedback + tests (route: inline).
- [ ] T3 After report, balance comparison, GDD note.

## Parity checklist
- [ ] Card bosses with pattern cards (core/cards.ts `updateCardFight`).
- [ ] Hosted card bosses (`updateHostedCardFight`).
- [ ] Heralds (core/herald/brain.ts).
- [ ] Sima echoes (echo timers scale; floor follows the echo's own timer).
- [ ] Senda wounds (shared engine; wound proof test).
- [ ] Co-op: host clamps (combat, sync claims, afflictions, rank-effect marks all read `cardHpFloor`).
- [ ] Every player damage path (strike, blocked chip, projectiles via strike) uses the compressed chart; enemy hits keep the raw chart.
- [ ] UI: move-info effectiveness, damage-number colours, "aguanta" text i18n es/en.
- [ ] GDD (Spanish), proof report, kill gaps.

## Progress
- 2026-10-26: branch `balance/type-chart` from main b87190d.

## Verification evidence
(pending)

## Next step
Run the study, choose the candidate.
