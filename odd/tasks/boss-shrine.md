# Boss shrine: Santuario de los Juramentos (Sanctum of Oaths)

## Objective
Re-fight any boss already beaten («Reflejos», like Sekiro's Reflections of Strength) and run boss gauntlets («Desafíos»), from an altar in the Refugio del Ocaso and from the title menu. Reuse the existing boss rooms and fight code.

## Problem
A boss can only be met again by replaying its whole dungeon. There is no way to practise one fight or to chain fights as a challenge.

## Why
User request 2026-10-26: a quick, solid boss rematch plus boss rush modes with an epic name.

## Scope
- Name: «Santuario de los Juramentos» — "Donde los guardianes vuelven a jurar" (EN: "Sanctum of Oaths" — "Where the guardians swear again").
- Reflejos: every boss beaten at least once on any tier (mid-bosses and guardians), plus heralds already met (by seed, from the bestiary). Pick boss and tier (any tier), fight its room at the expected level of that floor (`expectedLevel`, the same yardstick as `referenceLevel`), no items, no shop upgrades. On the end, back to the shrine with time, captures and no-hit.
- Desafíos: «Guardianes» (Aegislash → Decidueye → Dhelmise → Nihilego) and «Todos los juramentos» (the 8 bosses in dungeon order). HP carries over with a 30 % heal and a short pause. Unlocked when every boss of it is beaten. «Eco infinito» is skipped.
- Unlocks derive from the existing dungeon records (migration-free): a guardian is beaten when its dungeon is cleared, a mid-boss when its dungeon is cleared or its best floor went past the mid-boss floor.
- Records (own key `mazmorra-sombria.shrine`): best time per boss per tier and per gauntlet per tier, clears, no-hit flag ("Sin rasguños"), best captures. Shown in the shrine window and one notice-board line.
- Coins: 0 for reflections; a fixed reward on the first clear of each gauntlet per tier (no farming).
- Co-op: solo only (the altar says so in a room).
- Dev: `?screen=shrine`.

## Constraints
- Core stays pure; architecture test, `npm test` and `npm run build` green.
- One work-unit commit per task, Conventional Commits, explicit paths, no AI attribution, no push.
- About 400 authored lines per task is a planning heuristic only.

## Tasks
- [x] T1 Data, unlocks, records and the trial core (route: inline; this writer is the delegated agent) — commit 471f0c0
  - `src/data/shrine.ts` (gauntlets, heal 30 %, pause 2.5 s, rewards 150/300), `src/core/shrine.ts` (`SHRINE_BOSSES`, `startTrial`, `progressTrial`, `atLevel`, `trialHurt`), `run.ts` exports `enterRunFloor`, `src/town/shrine-records.ts` (`beatenBosses`, `gauntletUnlocked`, `recordTrial`, parse/read/save, board line).
  - Gauntlet sequencing and HP carry live in the core with the rematch setup, so they landed here rather than in T3.
  - Tests: `tests/core/shrine.test.ts` (41: every boss × tier setup, herald, pause, carry, 8-boss gauntlet), `tests/town/shrine-records.test.ts`. RED observed as a missing module before `core/shrine.ts` existed.
- [x] T2 Trials in the game loop (route: inline) — commit bc96b5d
  - `GameOptions.trial`; start via `startTrial`, `progressTrial` replaces `progressRun`, "Siguiente juramento" line on the pause, no-hit tracking, no run coins, no floor restarts, `RunSummary.trial`.
- [x] T3 Shrine window, altar, title entry, results, rewards (route: inline) — commit eb35506
  - `src/app/shrine.ts`, `main.ts` (`shrineScreen`, `playTrial`, `trialEnd`: trials never call `saveRun`), title entry appended after Shop (index 7), Refugio statue at (21,12) with reading point (22,15.5), board line, i18n es/en, CSS, `?screen=shrine&view=`.
- [x] T4 Docs, HUD coin fix, screenshots (route: inline)
  - GDD §3 «El Santuario de los Juramentos» + §9 Récords note, README. HUD coins read 0 in a trial. Best-time and «Sin rasguños» on separate lines. Dev `?trialSkip=1`.
  - Screenshots in `/tmp/boss-shrine/` (shrine reflections and gauntlets, Aegislash rematch, gauntlet pause and next arena, result, town altar).

## Decisions
- Name: «Santuario de los Juramentos» / "Sanctum of Oaths"; Reflejos/Reflections, Desafíos/Trials.
- No per-boss flags: unlocks derive from dungeon records (guardian = dungeon cleared; mid-boss = cleared or best floor past its arena), so no migration is needed.
- Any tier is allowed; level = `expectedLevel(dungeon, floor, tier)`; shop upgrades are dropped in trials.
- Coins: 0 for reflections; a gauntlet pays its reward × tier multiplier once per tier. Heralds are fightable but not recorded.
- Solo only (the altar says so in a room). «Eco infinito» skipped.
- Gauntlet time includes the 2.5 s pauses between arenas (simulated play time).

## Acceptance criteria
- Tests first for unlock logic and migration, records reducer, rematch setup per boss/tier, gauntlet sequencing and HP carry.
- Title menu indices unchanged (entry appended at the end of the fixed entries).

## Checks
- `npm test`: 187 files, 2070 tests passed.
- `npm run build`: ok.
- `npm run prove -- --judge`: 166 cards survivable, 24/24 solver fights.

## Next step
Human review; merge is the user's decision. Engram mirror pending (worker did not write it).
