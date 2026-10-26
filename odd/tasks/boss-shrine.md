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
- [ ] T1 Data, unlocks and records (route: inline; this writer is the delegated agent)
- [ ] T2 Rematch run setup and trial flow in the game (route: inline)
- [ ] T3 Gauntlets: sequencing, HP carry, pause (route: inline)
- [ ] T4 UI (shrine window, title entry, altar in the Refugio, result screen), i18n, docs, screenshots (route: inline)

## Acceptance criteria
- Tests first for unlock logic and migration, records reducer, rematch setup per boss/tier, gauntlet sequencing and HP carry.
- Title menu indices unchanged (entry appended at the end of the fixed entries).

## Checks
`npm test`, `npm run build`, screenshots in `/tmp/boss-shrine/`.

## Progress
Branch `feat/boss-shrine` from main 0e2b220.

## Next step
T1.
