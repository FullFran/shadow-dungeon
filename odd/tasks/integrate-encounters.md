# Integrate meaningful encounters

Branch: `feat/integrate-encounters` from main `b2dc2d7` ("chore(merge): integrate fix/fairness-floors"), later synced with main `44c1661` (feat/guardians-touhou). Engram mirror `odd/integrate-encounters/tasks`: pending (writer worktree has no Engram session).

## Objective
Merge `feat/meaningful-encounters` (e8e70a2, a5af1cb, 048aa66, 7dc9184, from be4e833) into main's newer work (balance harness, out-of-bounds fix, spell cards, fairness floors) as one coherent game: the fairness yardstick reads the new spawns, the gates' safety and the bounds net agree, the golden digest is checked on purpose, the harness is rerun, and the new events have sounds.

## Constraints
- Core pure and deterministic; `npm test` and `npm run build` green.
- `KNOWN_VIOLATIONS` may only lose entries that are now fixed.
- Conventional Commits, no AI attribution, no push; edits inside src, tests, tools, reports, docs/gdd.md, README.md, odd/tasks.

## Tasks
- [x] T1 Merge and resolve conflicts (route: inline; mechanical "keep both"). Commit bb81222.
- [x] T2 One coherent out-of-bounds set: bounds net vs gate 60 s rule vs wave failsafe (route: inline; RED for the locked-room test observed by reverting the fix). Commit e3c8243.
- [x] T3 Fairness reads the encounters spawns and XP rule (route: inline; RED observed with main's fairness.ts). Commit d3221cc.
- [x] T4 Easy golden digest checked on purpose (in T3's commit: comment only, value unchanged).
- [x] T5 Sounds for rally cry, leader fall, gate open, key drop (route: inline; RED: 6 mapping tests failed first). Commits 9a00935, ebcb02e (GDD).
- [x] T6 Sync main (guardians-touhou). Commit 74bd650.
- [x] T7 Harness rerun, report committed, `KNOWN_VIOLATIONS` reviewed (route: inline). Commits 010ab07 (bots open gates; RED: key-gate floor timed out with the old bot), dd6b996 (report + two entries removed).
- [x] T8 Silent screenshots.

## Conflicts and resolutions (T1)
- `src/core/state.ts`: EnemyState keeps `strayMs`/`warpMs` (bounds) and `leader`/`band`/`broken` (encounters); WorldState keeps `capture` (cards) and `gate`.
- `src/core/run.ts` `enterFloor`: one line sets `referenceLevel` (fairness) and clears `simaEvent` and `gate`.
- `src/core/step.ts`: host pipeline `keepEnemiesInBounds(updateGate(simaEventStep(updateLeaders(updateEnemies(...)))))`: the bounds net stays last; guests `breakBands(guestEnemyContacts(...))`.
- `src/core/enemies.ts`: `pace = clockScale × elite × band` feeds the telegraph floor (`effectiveTelegraphMs`), and `ems` keeps main's multiplication order (`dtMs × clockScale × elite × band`) so band 1 is bit-identical.
- `src/adapters/renderer.ts`: both `warpPoof` and `leaderMarks`.
- `src/i18n/{en,es}.json`: Aegislash spell names + gate HUD lines (and Decidueye cards at the main sync).
- Semantic conflict: `tests/core/out-of-bounds.test.ts` sweep failed on seed 7 floor 26 because that floor now holds a key gate; removing every enemy removed the key bearer, the gate broke and reopened its doors, and the test's reachability map (taken with the doors shut) went stale. The bare test floor now drops the gate and opens its doors up front.

## T2 decisions
- Found while resolving: the bounds net labelled the floor with every wall shut, so enemies waiting in a key gate's locked stairs room were "cut off" and snapped out of it on the first step. The net now opens the gate's door tiles (as it already did for a sealed wave room) when it labels reachability.
- Gates keep their own 60 s unreachable break; walkers are snapped back by the net every step, so in practice that rule only fires for what the net cannot move (a floater out of reach, a key dropped over a wall). Test: a walking seal target thrown off the map is back in reach and the gate's `stuckMs` stays 0.
- The Sima's wave gate opens when the wave room's 60 s failsafe ends the room (`outcome: 'cleared'` → gate `opened`). Test: 55 s stalled keeps the stairs shut, 61 s opens them (mutation: `waveStallMs` 600000 fails it).

## T3 decisions
- New `src/core/floor-spawns.ts` `generatedFloor`: generator + Sima squads + leaders, shared by `enterFloor` and `fairness.ts` so the yardstick cannot drift from the run again.
- `expectedFloorXp` prices each enemy with `xpFor` (species × role scale × depth) × `LEADER.xp`; the gate's ×1.5 marked kill and set pieces stay out (estimate errs low, cap errs protective).
- Expected level per floor (easy; nightmare identical since tiers add no bodies), stale formula on the merged spawns → new: Crypt 1 2 3 5 7 9 → 1 2 4 5 8 10; Forest 1 2 3 5 6 8 10 10 → 1 2 4 6 7 10 10 10; Caves 1 2 3 5 7 8 10.. → 1 2 4 6 9 10..; Swamp 1 2 4 5 7 8 10.. → 1 3 5 7 9 10..; Sima 1 2 3 5 6 8 9 10.. → 1 3 4 6 7 9 10...
- Tests (`tests/core/fairness-floors.test.ts`): exact match with the XP of the enemies a run places on the reference seeds (regular dungeons, easy and nightmare); within one level of 16 other real seeds floor by floor in every dungeon. With main's fairness.ts both fail (Crypt F2 62.4 vs 94.0; Forest F6 8 vs 10); without the leader bonus the exact test fails (86.7 vs 94.0).

## T4 golden digest
`PRE_TIER_DIGEST` stays `530cec91` (encounters' re-recording). Recomputed after the merge and after the main sync: unchanged, because `plain()` strips `referenceLevel` (whose value now changes) and no scripted Easy Crypt hit is changed by the cap; the gate state is part of the world and was already in encounters' value.

## T5 sounds
`soundFor` (src/adapters/audio.ts): `leaderRally` cry → `rallyCry` (two horn blasts; the wind-up stays visual), `leaderFell` → `leaderFall` (crown clatter + falling notes), `gateOpened` (opened or broken) → `gateOpen` (bolt, grinding stone, bright chord), `keyDropped` → `keyDrop` (two metallic bounces). Procedural recipes like the rest. Not heard by a human (silent session).

## Harness (T7)
Before = main's committed full report (b2dc2d7, before encounters and before guardians-touhou); after = full sweep on this branch after the main sync and the bot fix (960 runs, 1920 arena fights, 284.5 s).

- Gate: PASS both. Known fairness violations 50 → 39; performance warnings 94 → 85; passes 176 → 196. Quick (CI subset): 0 failures, 47 warnings / 66 passes on main → 39 / 74 now.
- First full sweep after the merge exposed a harness gap, not a game one: 240 floor timeouts (from 14), because the bots never picked up a key gate's dropped key nor hunted a seal's marked enemy. Fixed in src/sim (bots get the gate as the game shows it: marked enemy on the minimap, key on the floor); the observer's wind-up clock now also uses a band's pace. After the fix: 42 timeouts.
- Max simultaneous wind-ups per dungeon (easy/normal/hard/nightmare): Crypt 5/4/5/4 → 4/5/4/3; Forest 5/8/6/5 → 4/5/5/4; Caves 6/6/7/5 → 5/7/6/4; Swamp 5/4/5/3 → 3/3/3/3; Sima 4/4/5/4 → 5/4/4/4. Fewer bodies cut the Forest fog peak (8 → 5) and the Swamp; the band (≤ 2, ≤ 3 nightmare) is still missed everywhere (attack tokens, P5.3, still pending).
- Clears out of 48 runs per tier (easy/normal/hard/nightmare): Crypt 36/28/9/1 → 46/21/0/0; Forest 47/45/11/1 → 44/35/2/0; Caves 47/40/11/0 → 47/44/26/5; Swamp 42/30/12/0 → 44/37/17/1; Sima 41/34/11/3 → 33/26/19/5. Easy got easier where it was weakest (Crypt 36 → 46, average bot solo 2/3 → 3/3); Crypt and Forest on hard collapsed (leaders ×1.6 HP and their rally on level-1-ish bots); Caves and Sima got easier on hard.
- Boss TTK, average bot, solo, easy (isolated arena): unchanged (Sableye 47 s, Aegislash 13 s, Trevenant 24 s, Decidueye 14 s, Lanturn 16 s, Dhelmise 16 s, Sima Aegislash 10 s); Salazzle now felled (– → 41 s). Arenas do not use the encounter generator, so this was expected.
- `KNOWN_VIOLATIONS` removed: unseen-threats toxic-swamp, unseen-threats eclipse-chasm (no longer measured in the full sweep; CI subset passes without them). None added.
- Remaining Sima timeouts (40, all seed 2 floor 7, every tier): a wave-gate floor where a Clauncher at 1 HP stays in the wave room's top corner and the bot does not land the last hit; the wave room's 60 s failsafe ends it (seen in isolation: the floor clears at 135 s), but the Sima clock runs out in floor-by-floor runs. Not a soft-lock; follow-up: why the bot cannot hit that Clauncher (bot reach vs corner or game hitbox).

## Screenshots (T8)
Headless Firefox over WebDriver BiDi, profile `user.js` `media.volume_scale` 0.0, settings `muted: true` in localStorage before load, dev server `?screen=run&dungeon=crypt-of-the-sword-king&floor=N&seed=S`, item offer dismissed with key 1:
- `/tmp/integrate-encounters/leader-group.png` (seed 255, F5): crowned leader with its gold ring, the seal diamond over it, a follower beside; HUD "Escalera sellada".
- `/tmp/integrate-encounters/sealed-stairs.png` (seed 225, F2): seal gate HUD line under the floor card, marked leader on screen (the stairs themselves are off screen; the minimap marks them).
- `/tmp/integrate-encounters/key-door.png` (seed 688, F4): barred doorway of the locked stairs room and the "Puerta cerrada" HUD line.

## Checks
- `npm test`: 154 files, 1521 tests passed (after the main sync and every task).
- `npm run build`: built.
- `npm run balance -- --quick`: 0 failures, 39 warnings, 74 passes.
- `npm run balance` (full): 960 runs, 1920 arena fights in 284.5 s; 0 failures, 124 warnings, 196 passes.
- Native review / RDD: not run by this writer (parent's decision).

## Unverified
- Sounds not listened to; leader/gate timing not playtested by hand.
- Before metrics come from main's committed report (b2dc2d7), which predates guardians-touhou; boss TTK deltas for Decidueye/Aegislash mix both features.
