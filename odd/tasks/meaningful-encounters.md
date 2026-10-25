# Meaningful encounters

## Objective
Fewer enemies that matter: rooms spend a threat budget on roles and form a readable combo of 1 to 3 enemies; some groups have a leader whose fall breaks its followers; some floors need a kill before the stairs open. XP still comes from killing and the total per floor stays about the same.

## Problem
Too many fodder enemies make clearing tedious, so players skip them and reach the deep floors and guardians under-levelled (user feedback 2026-10-25).

## Why
User decision 2026-10-25: "menos enemigos, pero que importen"; XP must keep coming from kills, and killing must sometimes be mandatory. docs/souls-difficulty-research.md P1 (roles and threat budget), P2 (roles per room by tier), P3 (behaviour elites).

## Scope
- T1 Roles for every spawnable species (`src/data/encounters.ts`), a per-room threat budget in each dungeon's spawn data that buys roles instead of raw counts, rest rooms, front/back placement by role, about 35-45 % fewer enemies per floor in every dungeon, XP per enemy and Pokémonedas per enemy raised so XP per floor stays about equal. The Easy golden digest moves on purpose.
- T2 Leaders: some groups get a leader (more HP, crown and aura, a rally cry that heals and hurries its followers, bonus XP); its fall breaks the followers by one rule per role; more leaders with depth.
- T3 Mandatory kills: at most one gate per floor (sealed stairs until a marked enemy dies, a locked stairs room whose key an elite carries, or the Sima's wave room), never on floor 1 or urgent floors; host-authoritative; an unreachable gate enemy for 60 s breaks the gate without reward.
- T4 Tuning and docs: per-dungeon numbers in data, GDD §3 "Encuentros con sentido", README; tests.

## Constraints
- Core pure and deterministic; architecture test green; `npm test` and `npm run build` green.
- Edits scoped to spawning, encounters and progression data plus the allowed adapters; additive.
- Protocol additions optional and back-compatible.
- One work-unit commit per task, Conventional Commits, explicit paths, no AI attribution, no push.
- About 400 authored lines per task is advisory only.

## Tasks
- [x] T1 Roles + threat budget + XP/coin parity (route: inline in this writer; RED: 4 existing tests pinned the old counts/XP/digest and failed, updated on purpose; new tests/core/encounters.test.ts)
- [ ] T2 Leaders and break rules (route: inline)
- [ ] T3 Floor gates (route: inline)
- [ ] T4 Tuning, docs, screenshots (route: inline)

## Acceptance criteria
- Every room of a generated floor holds 0 to 3 enemies, spends at most its budget, at most the tier's roles.
- Average enemies per generated floor 55-65 % of the pre-change average in every dungeon (pinned baseline, 150 seeds, Easy).
- Average XP per generated floor within ±15 % of the baseline in every dungeon.
- Leader fall applies its role's break rule; leader pays bonus XP; leader chance rises with depth.
- Gate never on floor 1, never urgent, at most one; stairs blocked until resolved; 60 s unreachable breaks it without reward; guest follows host state.

## Checks
`npm test`, `npm run build`.

## Baseline (main be4e833, Easy, 150 seeds, enemies / XP per generated floor)
- Crypt: 9.06 / 236 (f1 6.1/66, f2 6.0/93, f4 10.1/284, f5 14.0/502)
- Forest: 10.93 / 306
- Caves: 11.63 / 459
- Swamp: 10.88 / 438
- Sima (floors 1-24): 9.48 / 924

## After T1 (Easy, 150 seeds, enemies / XP per generated floor; ratio vs baseline)
- Crypt 5.42 / 232 (0.60 / 0.98); Forest 6.80 / 320 (0.62 / 1.05); Caves 7.38 / 442 (0.63 / 0.96); Swamp 6.67 / 424 (0.61 / 0.97); Sima 5.93 / 895 (0.63 / 0.97).

## Decisions
- Roles live in `src/data/encounters.ts` (`SPECIES_ROLE`); no species is a natural support, the leader's rally cry plays that part.
- Budget per room = base + perDepth × (depth − 1) + int jitter; max 3 bodies; roles per room by tier (2 up to Normal, 3 from Hard), the tier never adds bodies.
- XP parity through a per-role XP scale (`ROLE_XP_SCALE`) applied in `xpFor`; guardians and mid-bosses have no role and pay as before. Pokémonedas per enemy 1 → 1.65.
- Easy golden digest re-recorded on purpose ('bebcc214' → new value per task).

## Progress
- Branch `feat/meaningful-encounters` from be4e833.
