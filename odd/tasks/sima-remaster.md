# Sima del Eclipse remaster

## Objective
Remaster the endless dungeon (Sima del Eclipse, `eclipse-chasm`, the stream mode) to the bar of the Crypt remaster: a look that changes as you descend, special rooms and events on some floors, an original bullet-hell boss of its own, and clearer pacing.

## Problem
Every Sima floor looks and plays the same: one palette, generated rooms, stairs, a guardian echo every fifth floor. Nothing marks the descent, nothing to decide on a floor but "go down", and no boss of its own.

## Why
User request 2026-10-25: "remasteriza la Sima del Eclipse también… más variedad… jefes tipo bullet hell".

## Scope
- T1 Atmosphere and depth bands: bands of 10 floors (1-10 Crypt palette and candles, 11-20 Forest palette, 21+ the abyss: floating rock islands over the void, falling red light); the eclipse on a parallax backdrop (growing with depth) and distant silhouettes behind every Sima floor; a band-change card (name, Touhou-style subtitle, "♪") on the first floor of each new band; per-band lore lines on the floor card.
- T2 Floor events (data-driven, seeded): treasure vault (guarded, an item offer once its guards fall), eclipse shrine (pact: a blessing for a curse, 3 floors), monster house (a room full of sleeping enemies that wake together), time crystal (+20 s if reached before it fades), merchant echo (spend run coins on a berry or an item). Weights by depth, at most one per floor, shown on the minimap once seen; host-authoritative in co-op (optional snapshot field).
- T3 New Sima-only boss "Eco del Eclipse" on every 10th floor (guardian echoes keep 5, 15, 25...): Mimikyu's busted form as a corrupted shadow (full SpriteCollab sheet set, verified), named bullet-hell spell cards (rings with a gap, spiral, lanes with a gap, mirrored spirals), one more card per Sima band, a safe path in every volley, a projectile cap, a short name card only.
- T4 Pacing and clarity: a few seconds of clock grace on every new floor, a clearer time-gain popup (bigger, with its reason), the events taken listed on the end screen, difficulty hooks (`atLeast(worldDifficulty(state), ...)`: an extra boss card on hard, a stronger curse on nightmare); easy unchanged otherwise; GDD and README.

Out of scope: leaderboards per difficulty, records, coin multipliers (difficulty writer); the forest remaster; dungeons 3 and 4 (their enemies and guardians join the Sima pool and echo list as data at integration).

## Constraints
- Core pure and deterministic; architecture test green; `npm test`, `npm run build` green.
- Shared files edited additively; new i18n keys in one contiguous block per language (appended at the end).
- Pools and echo lists stay plain data lists (appendable).
- Conventional Commits, one work-unit commit per task, explicit paths, no AI attribution, no push.
- About 400 authored lines per task is advisory only.

## Tasks
- [x] T1 Atmosphere and depth bands (route: inline writer, this agent; data, core helper, adapters, game wiring)
  - Data `src/data/sima.ts` (`SIMA_BANDS`: crypt 1-10 with the Crypt palette and candles, forest 11-20 with the Forest palette, abyss 21+ with `ABYSS_PALETTE`; name, subtitle and 4-5 lore keys each), linked from `ENDLESS.bands` (optional `EndlessDef.bands`). Core `src/core/sima.ts`: `simaBandIndex`, `simaBandAt`, `bandStartsAt` (11, 21: never floor 1), `bandLoreKey` (in turn from the band's first floor), `simaPalette`.
  - Presentation `src/adapters/sima-backdrop.ts`: the eclipse (black disc, pulsing red corona, radius 14 px on floor 1 growing to 60 px by floor 61, `eclipseRadius`) and two parallax layers of spires and drifting rocks drawn where the void was; abyss: wall tiles become void with the islands' rocky undersides, red rims on floor edges, falling red streaks. Renderer: `RenderFrame.sima` (optional), three small hooks. Game: palette, decoration and look from the band; the band card (name, subtitle, lore line) replaces the floor card on 11 and 21 and shows the "♪ title" note again; the floor card's lore line comes from the band.
  - Evidence: `tests/core/sima-bands.test.ts` (5) RED first (modules missing), then GREEN. Screenshots `/tmp/sima-remaster/t1-floor3.png` (crypt band), `t1-band11.png` (band card), `t1-floor23.png` (abyss islands, eclipse, spires, falling light, under Niebla), `t1-floor25.png` (echo arena with falling light). `npm test` 107 files / 1023 tests passed; typecheck ok.
- [ ] T2 Floor events (route: same; core, data, app overlays, minimap, net snapshot)
- [ ] T3 Eclipse Echo boss (route: same; data, core behaviour, renderer look)
- [ ] T4 Pacing, clarity, difficulty hooks, docs (route: same)
- [ ] T5 Tougher, not more (user feedback 2026-10-25 via the coordinator: "es mejor poner enemigos más duros"). Per-room counts stay low (cap 3, packs on top); depth brings harder species earlier, Sima elites (tinted, one extra trait: faster recovery, an extra projectile, armor on the first hit, enrage at low HP), mixed packs that combine roles; HP/damage scaling moderate. Data-driven and Sima-scoped (`ENDLESS.elites`) so the difficulty writer's elites can be unified at integration. (route: same; done right after T1, before T2)

## Acceptance criteria
- Band of a floor: 1-10, 11-20, 21+; the band card shows only on a band's first floor.
- Event selection is a pure function of (seed, floor, generated floor): at most one, never on floor 1, echo or urgent floors, never in the start room; weights respect `minDepth`.
- Pact: effects while `floorsLeft > 0`, gone after 3 floors; nightmare curse stronger.
- Monster house: every enemy of the room wakes as soon as a player enters it.
- Time crystal: +20 s once if touched before it fades; nothing after.
- Eclipse Echo: every volley leaves a gap wider than the player; enemy projectiles never exceed the cap; cards = 2 + band (+1 on hard), at most 4.
- Easy runs unchanged except the new Sima content.

## Checks
`npm test`, `npm run build`, `git log --format=%B -n 5 | grep -ic co-authored` = 0, headless silent screenshots in `/tmp/sima-remaster/`.

## Forecast
About 1800 authored lines over 4 tasks (T1 ~400, T2 ~700, T3 ~450, T4 ~250). Above the ~400 slice budget; the delivery decision stays with the parent.

## Progress
Created 2026-10-25 on `feat/sima-remaster` from `main` 043cb02. Engram mirror: pending (writer has no Engram session; parent owns it).
