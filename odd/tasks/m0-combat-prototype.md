# Feature: m0-combat-prototype

Locator: `odd/tasks/m0-combat-prototype.md` · Engram mirror: `odd/m0-combat-prototype/tasks`

## Objective
Build milestone M0 of Mazmorra Sombría: a single-player, single-room combat sandbox that runs locally in the browser and answers one question: does the souls-like combat feel good and hook?

## Problem / why
Combat is the highest-risk part of the design (`docs/gdd.md` §4). Dungeons, gacha, co-op and backend are worthless if the combat does not feel good, so it is validated first and in isolation.

## Scope (authorized)
- Mimikyu playable, with movepool and a 2-slot loadout chosen in a pre-run menu (slot count data-driven).
- Moves: fast slot Garra Umbría, Sombra Vil; heavy slot Carantoña, Bola Sombra (hold to charge).
- Roll with i-frames, stamina shared by roll and heavy moves, perfect dodge (slow-mo + next-hit buff).
- Passive Disfraz: first hit per room absorbed, visibly broken.
- Lock-on: hold Shift (toggle option), initial target nearest the cursor, wheel cycles clockwise/counter-clockwise by angle around the player with delta accumulation, re-lock by pointing, auto-release on death/range/off-screen; mouse movement never switches target.
- Enemies: Poochyena (telegraphed lunge), Gastly (floating, slow projectile). Boss: Aegislash with Shield phase (frontal block) and Blade phase (combos with openings).
- Type effectiveness on moves.
- Juice: hitstop, screen shake, damage numbers, distinct hit sounds optional.
- UI strings via i18n files, Spanish default, English option.
- Guest-only local state; no backend, no network.

Out of scope: dungeon generation, co-op/netcode, gacha, meta, backend, deploy.

## Constraints
- Stack: TypeScript (strict) + Vite + Canvas 2D, Vitest. No game engine.
- Hexagonal: `src/core` is pure TypeScript (no DOM), fixed timestep, deterministic given inputs + seed; adapters for render, input, assets, audio, storage, i18n.
- Sprites from PMDCollab SpriteCollab (CC BY-NC 4.0), fetched by a script, with generated per-artist `CREDITS.md`. Non-commercial fan project notice.
- Code, comments, identifiers, tests and commit messages in English; player-facing text in i18n files (es default, en).
- Conventional commits, no AI attribution lines.

## Delivery
- Strategy: `ask-on-risk`. Forecast: about 2,500 authored changed lines across the tasks, above the ~400 budget. No remote exists yet, so no PR is possible; the chain-strategy question is deferred until a remote is created. Work-unit commits stay on branch `feat/m0-combat-prototype`.
- RDD: off (global), so no native review lifecycle; ordinary checks only.

## Tasks
- [ ] T1 Scaffold: Vite + TS strict + Vitest, folder layout (`src/core`, `src/adapters`, `src/data`, `src/app`), i18n skeleton (es/en + missing-key test), fan-project notice, npm scripts (`dev`, `build`, `test`, `typecheck`). Route: delegated (writer batch 1).
- [ ] T2 Sprite pipeline: `tools/fetch-sprites` downloads species 778, 261, 92, 681 (+ form 0681/0001 if it is Blade) from SpriteCollab, converts AnimData.xml to JSON meta (frame size, durations, anchors, 8 directions), writes `CREDITS.md`. Route: delegated (batch 1).
- [ ] T3 Core simulation: fixed-timestep loop, movement, roll with i-frames, stamina, perfect-dodge detection. TDD. Route: delegated (batch 1).
- [ ] T4 Moves as data + combat resolution: slot model (data-driven count), wind-up/active/recovery, charge levels, hitboxes, damage, type chart, Disfraz. TDD. Route: delegated (batch 1).
- [ ] T5 Lock-on rules (pure). TDD. Route: delegated (batch 1).
- [ ] T6 Enemies Poochyena + Gastly state machines and room spawner. TDD. Route: delegated (batch 2).
- [ ] T7 Boss Aegislash two phases. TDD. Route: delegated (batch 2).
- [ ] T8 Adapters: canvas renderer with sprites/animations, input (mouse, keyboard, wheel), camera, HUD (HP, stamina, disguise), juice. Manual check. Route: delegated (batch 2).
- [ ] T9 Loadout menu + sandbox flow (start, die, restart, boss room). Manual check. Route: delegated (batch 2).

Route trigger evidence: every task touches 2+ non-trivial files (writer trigger) and needs preparation reading (preparation trigger).

## Acceptance criteria
- `npm test`, `npm run typecheck`, `npm run build` pass.
- `npm run dev` opens a playable room: Mimikyu moves, rolls, attacks with both slots, locks and switches targets, fights both enemies and Aegislash; Disfraz and perfect dodge are visible.
- Menu switches loadout; language toggles es/en.
- Core has unit tests for roll i-frames, stamina, move phases, charge, type effectiveness, Disfraz, lock-on ordering and switching, enemy and boss state transitions.

## Checks per task
`npm test`, `npm run typecheck`; plus `npm run build` from T1 on.

## Progress / evidence
(none yet)

## Next step
Launch writer batch 1 (T1-T5).
