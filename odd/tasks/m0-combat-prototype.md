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
- [x] T1 Scaffold: Vite + TS strict + Vitest, folder layout (`src/core`, `src/adapters`, `src/data`, `src/app`), i18n skeleton (es/en + missing-key test), fan-project notice, npm scripts (`dev`, `build`, `test`, `typecheck`). Route: delegated (writer batch 1).
- [x] T2 Sprite pipeline: `tools/fetch-sprites` downloads species 778, 261, 92, 681 (+ form 0681/0001 if it is Blade) from SpriteCollab, converts AnimData.xml to JSON meta (frame size, durations, anchors, 8 directions), writes `CREDITS.md`. Route: delegated (batch 1).
- [x] T3 Core simulation: fixed-timestep loop, movement, roll with i-frames, stamina, perfect-dodge detection. TDD. Route: delegated (batch 1).
- [x] T4 Moves as data + combat resolution: slot model (data-driven count), wind-up/active/recovery, charge levels, hitboxes, damage, type chart, Disfraz. TDD. Route: delegated (batch 1).
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
- T1 `5a61920` feat(app): scaffold. `npm test`: 2 files, 8 tests passed. `npm run typecheck`: clean (app + DOM-free core config; a probe using `window` in `src/core` failed typecheck as intended). `npm run build`: built. `npm run dev` served `index.html`.
- T2 `1f14a86` feat(tools): sprite pipeline. `node tools/fetch-sprites.mjs`: 5 sprite folders (52 sheets, 1.1 MB), 6 artists. `npm test`: 3 files, 13 tests passed. `npm run typecheck`: clean. `npm run build`: built.
- T3 `4572cd6` feat(core): simulation. RED: `npx vitest run tests/core` -> 18 failed on "not implemented" stubs (rng test passed, it was written with its implementation). First GREEN run had 3 failures that were arithmetic errors in the tests (exact 50 ms = 3 steps, stamina regenerating during a denied roll, regen capped at max); tests corrected, code unchanged. `npm test`: 6 files, 32 tests passed. `npm run typecheck`: clean. `npm run build`: built.
- T4 (commit recorded with T5) feat(core): moves as data + combat. RED: `npx vitest run` on damage/loadout/content/combat -> 23 failed on "not implemented" stubs (content tests passed: they check data written first). First GREEN run: 2 failures, both test expectations made stale or too strict by design: the T3 "hurt" test now meets Disguise first (test breaks the disguise beforehand), and the exact 4x damage ratio did not survive integer rounding (now checked to rounding). One timing test was widened by one tick before running GREEN because tick rounding left it inside the active phase. `npm test`: 10 files, 62 tests passed. `npm run typecheck`: clean. `npm run build`: built.

## Decisions taken by the writer
- Core purity is enforced twice: `tsconfig.core.json` compiles `src/core` + `src/data` without DOM lib, and `tests/architecture.test.ts` rejects imports of adapters/app/i18n/node built-ins or bare packages from those layers.
- Commit hashes for task N are recorded in the feature document by the commit of task N+1 (a commit cannot contain its own hash).
- Sprite form 0681/0001 is Aegislash **Blade** form (SpriteCollab `tracker.json`: subgroup `0001` name "Blade"; the base folder is the Shield form). Both are fetched.
- Missing sheets use fallbacks recorded as `source` in the meta: Faint falls back to Hurt for Mimikyu, Gastly and Aegislash (only Poochyena has a real Faint). Extra sheets fetched: Strike, Swing, Double, Hop, Rotate where present. Aegislash `Special0` is listed in credits but has no AnimData entry, so it is skipped.
- Ground anchor per animation = centroid of the opaque pixels of the first frame ("down" row) of its `-Shadow.png`, decoded by a minimal PNG reader in `tools/sprite-lib.mjs` (no image dependency).
- Perfect dodge = a hit absorbed by i-frames within `perfectDodge.windowMs` (120 ms) after the i-frames start. Slow-mo is "witch time": only enemies and their projectiles are slowed (`enemyTimeScale`), the player keeps full speed to punish; the slow-mo timer runs in real time. The next-hit buff (x1.5) expires after 3 s if unused.
- "Cannot roll without stamina" = a roll needs at least `roll.staminaCost`; a denied roll emits `rollDenied` for UI feedback. Rolls commit their direction (WASD at start, else facing) and cannot be chained while rolling.
- `step()` is pure (returns a new state, never mutates input) to keep rollback/prediction possible later (gdd §12). Per-step `events` feed renderer juice.
- All tunables live in `src/data/tuning.ts`.
- Type chart: standard Gen 6+ multipliers for normal/ghost/fairy/dark/poison/steel; immunities (x0) are softened to `combat.immunityMultiplier` = 0.25 so no attack does nothing in real time. Damage = power x 0.2 x STAB 1.5 x effectiveness x charge x buff, rounded, minimum 1 (no levels/stats in M0).
- Fast moves cost no stamina (GDD: stamina is shared by roll and the heavy slot). Heavy moves pay stamina on press, charge while held (walking at 40% speed), fire on release, then wind-up/active/recovery; charge levels at 0/450/900 ms scale damage x1/1.4/1.9, size x1/1.25/1.5, projectile speed x1/1.3/1.6. Other move phases root the player; no roll during a move and no move during a roll (no cancels in M0).
- Slot inputs are level-triggered (`input.slots[i]` held); press/release edges are derived in the core from the previous tick. Roll stays edge-triggered.
- Aim is committed at wind-up start (heavy moves track the cursor while charging). `aimDirection()` in `combat.ts` is the hook for lock-on.
- One hit per target per swing; a player projectile hits the first enemy it touches and disappears. An enemy projectile that the player rolls through keeps flying (it remembers the player in `hitIds`) and can trigger a perfect dodge once.
- Disguise absorbs the first damaging hit that actually lands (dodged hits do not spend it) and sets `player.disguiseBroken`; `enterRoom()` resets it.
- Enemy hit reaction: hitstun (`hitstunMs`, enemies act only at 0 — T6) plus ease-out knockback away from the hit origin; both run at the slow-mo time scale.
- `CREDITS.md` credits every author in each folder's `credits.txt` (current and former, `CUR`/`OLD`), mapped through `credit_names.txt`.

## Next step
Launch writer batch 1 (T1-T5).
