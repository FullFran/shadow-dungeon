# achievements-missions

## Objective
Achievements (logros) and a PMD job-board of missions (misiones) at the town notice board, both generated from the content lists so new species and dungeons get them with no hand edits.

## Problem
Runs end with Pokémonedas and records only; nothing tracks long-term goals, and the notice board only reads records.

## Why
User request (2026-10-26): "implementa logros y demás", "también podemos implementar misiones". Simple and clean.

## Scope
- Pure core `src/core/achievements.ts` + data `src/data/achievements.ts`: families generated from `DUNGEONS` + `CHALLENGES`, `DIFFICULTIES`, `PLAYABLE_SPECIES`, `PLAYER_EVOLUTIONS`, `SIMA_BANDS`, `GACHA_POOL`. Evaluated from run-end reports and the save (never per frame). Some pay a few Pokémonedas; none give power.
- Pure core `src/core/missions.ts` + data `src/data/missions.ts`: a daily board of 3 to 5 missions seeded by the UTC day plus one weekly, accept up to K, progress from run-end reports, claim at the board. Rewards: Pokémonedas, sometimes evolution materials of a tier at most the mission's, never Pesadilla.
- Run report: `RunSummary` gains kills per type, guardian floor no-hit and co-op; `src/core/run-report.ts` builds the pure report.
- Save v4: `achievements` (id -> UTC date), `earned` (lifetime Pokémonedas), `missions` (accepted with progress, claimed); migrate/sanitize.
- UI: unlock toast, achievements window (title menu and notice board), mission board window at the notice board. Phone friendly (reuses the stall window layout).

## Constraints
- Allowed surfaces: odd/tasks/achievements-missions.md, CLAUDE.md, src/**, tests/**, docs/gdd.md, index.html.
- Self-contained: new modules + thin wiring (parallel branches feat/coop-flow, feat/roster-parity, feat/backend-v1).
- No new dungeon mechanics; no power from achievements; no Pesadilla materials from missions.
- One Conventional Commit per task, explicit paths, no AI attribution, no push/merge.

## Decisions
- 2026-10-26: mission ids carry their period (`d:YYYY-MM-DD:i`, `w:YYYY-MM-DD:0` with the week's Monday); the body is regenerated from the id, so the save stores only ids and progress and expiry is a key comparison.
- 2026-10-26: every mission has a minimum tier; progress only counts from runs at that tier or above. Material rewards use tier min(mission tier, Difícil) and only from Normal up.
- 2026-10-26: SAVE_VERSION 3 -> 4 (new optional fields; a v3 save reads with none).

## Delivery strategy
single branch `feat/achievements-missions`, one commit per task; forecast ~1,500 authored lines; PR slicing is the user's decision.

## Tasks
- [x] T1 Achievements core + data + run report + save v4 + tests. Route: inline (single worker, already delegated).
- [ ] T2 Achievements UI: toast, window, title entry, wiring at run end and stalls; i18n.
- [ ] T3 Missions core + data + save + tests.
- [ ] T4 Missions UI: board window at the notice board; i18n.
- [ ] T5 GDD section + parity evidence.

## Parity checklist
- [ ] Every dungeon (`DUNGEONS` non-endless + `CHALLENGES`) has clear achievements on every tier and a flawless-guardian one; iterated in tests.
- [ ] The Sima (endless) has depth achievements per `SIMA_BANDS` band; iterated in tests.
- [ ] Every `PLAYABLE_SPECIES` has a clear-with achievement; every `PLAYER_EVOLUTIONS` entry an evolve one; gacha first pull and full collection from `GACHA_POOL`.
- [ ] Missions draw dungeons from `DUNGEONS` + `CHALLENGES`, species lines from `PLAYABLE_SPECIES`, types from the dungeons' enemy pools; tests check every one can appear over a range of days.
- [ ] Solo and co-op (each peer its own report and save).
- [ ] Save migrate/sanitize; i18n es/en; GDD.
- [ ] Net protocol: nothing to send (each peer evaluates its own run).
- [ ] Sim/prove harnesses: untouched (no combat change); prove still green.

## Acceptance
- typecheck, `npx vitest run --testTimeout=30000`, build, `npm run prove` green.

## Progress / evidence
- T1: `data/achievements.ts` (generated families), `core/achievements.ts` (`achieved`, `newlyUnlocked`, `unlockAll`, `familyProgress`), `core/run-report.ts` (`tallyKills`, `runReport`); `RunSummary` gains `kills`, `guardianNoHit` (victory only, no hit on the last floor entered), `coop`; save v4 (`achievements`, `earned`; `earnCoins` counts the lifetime total). RED observed (missing modules, save v4 asserts), then GREEN; mutation: dropping `CHALLENGES` from `clearableDungeons` fails the parity test. typecheck ok; vitest 216 files / 2616 tests ok.
