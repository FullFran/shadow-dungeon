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
- [x] T2 Achievements UI: toast, window, title entry, wiring at run end and stalls; i18n.
- [x] T3 Missions core + data + save + tests.
- [x] T4 Missions UI: board window at the notice board; i18n.
- [x] T5 GDD section + parity evidence.

## Parity checklist
- [x] Every dungeon (`DUNGEONS` non-endless + `CHALLENGES`) has clear achievements on every tier and a flawless-guardian one; iterated in tests (tests/core/achievements.test.ts, mutation-checked).
- [x] The Sima (endless) has depth achievements per `SIMA_BANDS` band after the first; iterated in tests.
- [x] Every `PLAYABLE_SPECIES` has a clear-with achievement; every `PLAYER_EVOLUTIONS` entry an evolve one; gacha first pull and full collection from `GACHA_POOL`; every achievement has a witness that unlocks it (test).
- [x] Missions draw floor goals from `DUNGEONS`, clear goals from `DUNGEONS` + `CHALLENGES`, species lines from `PLAYABLE_SPECIES`, types from the dungeons' enemy pools, materials from `PLAYER_EVOLUTIONS` lines; tests check every one appears over 400 days.
- [x] Solo and co-op: each peer builds its own report (`RunSummary.kills/guardianNoHit/coop`) and settles it on its own save in `onEnd`; guests too. Missions open at the board in the hub and in a room's town.
- [x] Save migrate/sanitize (v4; tests), i18n es/en (text tests iterate every achievement and 120 days of missions in both languages), GDD §11 "Logros" and "Misiones".
- [x] Net protocol: nothing to send (each peer evaluates its own run).
- [x] Sim/prove harnesses: untouched (no combat change); prove green (166/166 cards, 24/24 fights).
- [ ] Pending (not cut, outside this branch): shrine trials do not count as runs for achievements or missions (they never count as runs elsewhere either); starter evolutions from feat/roster-parity will get evolve achievements automatically once they are in `PLAYER_EVOLUTIONS` (check after merge).

## Acceptance
- typecheck, `npx vitest run --testTimeout=30000`, build, `npm run prove` green.

## Progress / evidence
- T1: `data/achievements.ts` (generated families), `core/achievements.ts` (`achieved`, `newlyUnlocked`, `unlockAll`, `familyProgress`), `core/run-report.ts` (`tallyKills`, `runReport`); `RunSummary` gains `kills`, `guardianNoHit` (victory only, no hit on the last floor entered), `coop`; save v4 (`achievements`, `earned`; `earnCoins` counts the lifetime total). RED observed (missing modules, save v4 asserts), then GREEN; mutation: dropping `CHALLENGES` from `clearableDungeons` fails the parity test. typecheck ok; vitest 216 files / 2616 tests ok.
- T2: `core/achievements.ts` `settleAchievements` (stamps the UTC day, pays rewards into coins and the lifetime count, chains a milestone a reward reaches; RED observed then GREEN); `app/progress.ts` (`recordRun`, `recordSave`); `app/achievements.ts` (texts from i18n templates filled with content names, toast, window by family); `main.ts`: run end settles each peer's own report (shrine trials excluded, they never count as runs), gacha and evolve windows settle on close, title entry "Logros" (appended after the shrine); CSS in index.html. Text tests iterate every achievement in es and en (no raw keys, placeholders or em dashes). typecheck ok; vitest app/i18n/town/ui 375 tests ok.
- T3: `data/missions.ts` (board numbers), `core/missions.ts` (daily board seeded by the UTC day, weekly by its Monday, ids regenerate the mission, `missionProgress` gated by tier, accept/advance/claim/prune, `payMissionReward`); save `missions` (sanitize: real ids, unique, progress clamped, limit); `app/progress.ts` run end advances missions, `acceptAt`/`claimAt`. RED observed (missing module, save asserts), then GREEN; mutation: letting Pesadilla materials through fails the reward test. Tests iterate 400 days: every main dungeon is a floor goal, every winnable dungeon (challenges too) a clear goal, every playable line a species goal, every enemy type of the dungeons a defeat goal, every material line a reward.
- T4: `app/board.ts` (mission board window: rows with state Aceptar / progress / ¡Cobrar! / Cobrada, the cursor's mission told beside the list, "Logros" row opens the achievements in its place); `core/missions.ts` `missionStatus`; `town/scene.ts` `openBoard` (the board's records dialog, then the window; hub and room towns); `main.ts` `townBoard`, dev screens `?screen=board` and `?screen=achievements`; i18n es/en; CSS. Text tests iterate 120 days of boards in es and en. Smoke (headless Firefox, muted, 844x390 and 390x844): both windows render, rows and states as expected; screenshots in the session scratchpad (`smoke-board-*.png`, `smoke-achievements-*.png`). The page scrolls vertically a little on phones (like the other stall windows). vitest app/town/i18n/missions/architecture 330 tests ok; typecheck ok.
- T5: GDD §11 "Logros" and "Misiones" (Spanish), save v4 note. Final gate: typecheck ok; `npx vitest run --testTimeout=30000` 220 files / 2644 tests passed (the default worker count hit 2 vitest RPC "onTaskUpdate" timeouts under a host load average of ~30 from parallel agents, with every test passing; `--maxWorkers=4` ran clean); build ok; prove 166 cards (166 survivable), 24/24 fights.
