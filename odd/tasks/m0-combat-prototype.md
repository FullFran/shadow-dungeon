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
- [x] T5 Lock-on rules (pure). TDD. Route: delegated (batch 1).
- [x] T6 Enemies Poochyena + Gastly state machines and room spawner. TDD. Route: delegated (batch 2).
- [x] T7 Boss Aegislash two phases. TDD. Route: delegated (batch 2).
- [x] T8 Adapters: canvas renderer with sprites/animations, input (mouse, keyboard, wheel), camera, HUD (HP, stamina, disguise), juice. Manual check. Route: delegated (batch 2).
- [x] T9 Loadout menu + sandbox flow (start, die, restart, boss room). Manual check. Route: delegated (batch 2).

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
- T4 `c0fd95b` feat(core): moves as data + combat. RED: `npx vitest run` on damage/loadout/content/combat -> 23 failed on "not implemented" stubs (content tests passed: they check data written first). First GREEN run: 2 failures, both test expectations made stale or too strict by design: the T3 "hurt" test now meets Disguise first (test breaks the disguise beforehand), and the exact 4x damage ratio did not survive integer rounding (now checked to rounding). One timing test was widened by one tick before running GREEN because tick rounding left it inside the active phase. `npm test`: 10 files, 62 tests passed. `npm run typecheck`: clean. `npm run build`: built.
- T5 `07803be` feat(core): lock-on. RED: `npx vitest run tests/core/lockon.test.ts` -> 13 failed (11 on "not implemented" stubs, 2 simulation tests because the lock was not wired into `step`). One fixture was corrected before GREEN: the "offscreen" enemy was also out of range, so it did not isolate the screen check. GREEN on the first implementation run. `npm test`: 11 files, 75 tests passed. `npm run typecheck`: clean. `npm run build`: built.
- T6 `aa3ae75` feat(core): enemies. RED: `npx vitest run tests/core/enemies.test.ts` -> 10 failed / 3 passed; two passes were vacuous (stagger, obstacle), so both tests were tightened (assert the telegraph was reached; assert the dog got around the block) and re-run: 12 failed / 1 passed (dormant guard, passes by construction). One fixture fixed before GREEN: the "backs away" Gastly started at 116 px, so it would back off 4 px and then stop to telegraph; moved to 76 px. GREEN on the first implementation run for the new file; one old test (charged Shadow Ball) then failed because a live Gastly fired back, so player-system fixtures in combat/lockon tests now spawn dormant enemies. `npm test`: 12 files, 88 tests passed. `npm run typecheck`: clean. `npm run build`: built.
- T7 `da71eeb` feat(core): Aegislash. Shared enemy helpers were first extracted to `src/core/brain.ts` (pure refactor, 88 tests still green). RED: `npx vitest run tests/core/boss.test.ts` -> 10 failed on "not implemented" stubs; the generic stagger test in `combat.test.ts` was moved from Aegislash to Poochyena because the boss now has super armour. GREEN on the first run, which was suspicious, so the tests were mutation-checked: setting the block arc to 0, the turn rate to 7500 deg/s, `combosPerStance` to 99, `hitstunScale` to 1, or making `onBossDamaged` a no-op all survived at first (exactly-frontal fixture, bound scaled with the mutated rate, fixtures derived from the mutated value, hitstun read after it expired, stance changing by the time limit inside a 20 s wait). Tests rewritten (off-axis frontal hit, absolute "still facing away" check, one-hit-short and one-combo-short fixtures, hitstun read on the hit tick, 1 s bound); each of those mutations, plus "transform still blocks" and "recover never ends", now fails at least one test. `npm test`: 13 files, 99 tests passed. `npm run typecheck`: clean. `npm run build`: built.
- T8 `77bceee` feat(adapters): renderer, input, HUD and juice. Pure pieces were unit-tested after writing them (no test-first: the DOM/canvas parts are not unit-testable and the pure helpers were written together with them): `tests/adapters/presentation.test.ts`, 18 tests (direction rows, frame timing and HitFrame/ReturnFrame alignment, animation choice, interpolation, camera, screen->world, pixel scale, input mapping, wheel normalisation, juice, bar fill); flipping the direction-row formula fails 3 of them. `npm test`: 14 files, 117 tests passed. `npm run typecheck`: clean. `npm run build`: built (58.5 kB JS). Manual: the Playwright MCP browser is not installed (Chrome missing), so the preview was captured with the system Firefox in headless mode (`--screenshot`, throwaway profile in the session scratchpad, a delayed wrapper page so the game had time to load): sandbox room, Mimikyu, Poochyena, Gastly with its ball, pillar, HUD and crisp pixel art render as intended. Not verified by hand: feel of hitstop/shake, lock marker, telegraph shapes, input (headless screenshots cannot press keys).
- T9 `3e40c13` feat(app): menu, settings and end screens. RED: `npx vitest run tests/app` -> 7 failed on "not implemented" stubs (storage port, settings); the "no localStorage" case was then made hermetic (stubbed to `undefined`) because the Node runtime may provide its own `localStorage`. GREEN on the first run. `npm test`: 15 files, 124 tests passed. `npm run typecheck`: clean (one TS2590 "union too complex" from the DOM helper's generic props, fixed by typing props as plain strings). `npm run build`: built. `npx vite preview --port 4173` + `curl -s localhost:4173 | head`: served `index.html`. Headless Firefox screenshot of the menu: title, language buttons, both slot selects with only valid moves, lock mode select, controls, goal, Start and the fan notice. Not verified in a browser: clicking through menu -> game -> exit -> boss -> end screens (headless screenshots cannot click); the game screen itself was seen in T8.

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
- Lock-on input is part of `PlayerInput`: `lock` (Shift level), `wheel` (DOM deltaY since last tick, negative = up) and `view` (camera rect in world coords, for the on-screen rule). Range 340 px, wheel threshold 90 (one mouse notch ~100); the accumulator keeps the remainder after a switch and resets when the wheel changes direction. Hold mode acquires only on the press edge, so after an automatic release (range/off-screen) the player must press again; a dead target hands over to the enemy nearest the cursor. Toggle mode is `createWorld({ lockMode: 'toggle' })`, to be fed from settings.
- Enemy hit reaction: hitstun (`hitstunMs`, enemies act only at 0 — T6) plus ease-out knockback away from the hit origin; both run at the slow-mo time scale.
- `CREDITS.md` credits every author in each folder's `credits.txt` (current and former, `CUR`/`OLD`), mapped through `credit_names.txt`.
- Enemy AI lives in `src/core/enemies.ts` as explicit per-species state machines over a shared `AiState` (`mode`, `modeMs`, `modeDurationMs`, `attackDir`, `contact`, `cooldownMs`, `strafeSign`); tuning (incl. every telegraph duration) lives in `src/data/enemies.ts`. `step` runs `updateEnemies` after combat. Enemies emit `enemyTelegraph` (with `durationMs`) and `enemyAttack` for the renderer/audio.
- Poochyena: idle -> approach (circles at `stalkRange` while the lunge recharges) -> telegraph (tracks the player, direction committed when it fires) -> attack (straight lunge, one contact) -> recover. A lunge that connects recovers in 450 ms; a missed or rolled-through one leaves it exposed for 1100 ms (the punish window).
- Gastly: idle -> reposition (keeps a 120-230 px band, strafes) -> telegraph -> attack (casts a 95 px/s ball, slower than the 140 px/s player) -> recover. It floats: obstacles do not stop it, walls do.
- A stagger (`hitstunMs` > 0) cancels a wind-up or attack in progress; the enemy resumes approaching afterwards. Enemies do not collide with the player or with each other in M0.
- `spawnEnemy(..., { dormant: true })` makes a training dummy that never acts; tests of player systems use it to stay isolated from enemy behaviour.
- Obstacles: `Arena.obstacles` (rectangles). Walkers (player, Poochyena, later Aegislash) are pushed out of them and slide sideways along them; floaters and projectiles ignore them. Poise per species (`hitstunScale`, `knockbackScale`) scales incoming stagger and knockback.
- Rooms are data (`src/data/rooms.ts`): sandbox (960x640, two pillars, 3 Poochyena + 2 Gastly, exit on the east wall leading to `boss`) and the boss room. `loadRoom` = `enterRoom` (Disguise reset) + arena + player start + spawns; `atExit` requires the room to be cleared.
- Aegislash (`src/core/boss.ts`, tuning `AEGISLASH` in `src/data/enemies.ts`): super armour (`hitstunScale` 0, knockback x0.15). Shield stance: walks at 35 px/s, turns at 75 deg/s, blocks hits whose origin (player for melee, projectile position for shots) lies inside a 130 deg frontal arc, and bashes (700 ms telegraph, 110 px dash) when the player is in front within 85 px. Blocked hits deal `chipFactor` 0 damage, emit `hitBlocked`, cause no stagger and keep the perfect-dodge buff; a blocked projectile is spent. Blade stance: 100 px/s, turns fast, three-blow combo (telegraphs 480/260/420 ms, frontal arcs, short forward steps that stop at body contact), then a 1400 ms recovery (the opening).
- Stance change rule: Shield -> Blade after 10 s or 120 damage taken in Shield; Blade -> Shield after 2 combos or 9 s. Checked only between attacks. The change is a 900 ms `transform` mode, telegraphed with `enemyTelegraph` `attack: 'transform'`; it neither blocks nor attacks. On completion `bossStance` is emitted and the stance counters reset.
- `bossBar(state)` gives the HUD the first living boss (`hp`, `maxHp`, `stance`).
- Adapters: `sprite-anim.ts` (pure animation choice; rows follow `SPRITES.directions`; attack sheets are stretched over the move phases so the sheet's HitFrame lands on the first active tick and ReturnFrame on recovery), `view.ts` (interpolation, camera clamped to the arena, screen->world, integer pixel scale), `input.ts` (DOM listeners record raw state; `toPlayerInput` is the pure mapping; RMB context menu prevented; wheel normalised to pixels), `juice.ts` (pure, fed by core events: hitstop 50/90 ms, 70 ms when hurt; shake on heavy or super-effective hits and on taking damage; floating numbers coloured by effectiveness, "Blocked!" label; perfect-dodge and broken-Disguise flashes), `hud.ts`, `renderer.ts`, `assets.ts`.
- Mimikyu sheets per move: Shadow Claw `Attack`, Shadow Sneak `Strike`, Play Rough `Charge` then `Double`, Shadow Ball `Charge` then `Shoot`; roll `Hop`. Enemies: telegraph `Charge`, attack `Attack`/`Shoot` (Blade `Swing`), transform `Rotate`, hitstun `Hurt`, defeated `Faint` (fades out). Aegislash switches between the Shield and Blade sheets halfway through the transformation.
- View: 512x320 world px at the largest integer scale that fits the window, `imageSmoothingEnabled = false` and `image-rendering: pixelated`. Rendering interpolates positions by `alpha` = accumulator / step; the camera follows the interpolated player.
- Hitstop is presentation-side: the game loop stops stepping the (unchanged, deterministic) simulation while it lasts and drops the backlog. Perfect-dodge slow-mo is shown as a violet tint over the world.
- Telegraph visuals: Poochyena lane of its lunge length filling up, Gastly shrinking ring + short aim lane, Aegislash bash lane, Blade combo arc, transformation ring, and a permanent blue arc for the Shield guard so flanking is readable.
- The game loop (`src/app/game.ts`) already carries the room flow (exit -> boss room, defeat at 0 HP, victory when the boss room is cleared) because it is the session itself; T9 adds the menu, end screens and settings around it.
- Settings (`src/app/settings.ts`): language, lock mode and loadout, stored as one JSON value under `mazmorra-sombria.settings` through the `KeyValueStore` port (`src/adapters/storage.ts`; the browser adapter wraps `localStorage` in try/catch and silently skips persistence when it is missing or throws). Each stored field is validated on load and falls back on its own (the loadout through `validateLoadout`).
- Flow (`src/app/main.ts`): menu -> Start -> sandbox -> east exit (opens once the room is cleared) -> boss room (`loadRoom` resets Disguise) -> defeat screen at 0 HP or victory screen when Aegislash falls (after a 700 ms beat); both offer retry and back to menu. The run seed is `Date.now()`. The fan notice stays visible on every screen (smaller in game).

## Next step
M0 tasks T1-T9 done. Next: play it by hand (`npm run dev`) and tune feel (enemy speeds, telegraphs, boss stance thresholds, hitstop/shake); decide the chain/PR strategy once a remote exists.
