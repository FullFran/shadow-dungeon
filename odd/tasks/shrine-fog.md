# Shrine fog walls, and the lost shadow's scene on arrival

## Objective

1. The Santuario de los Juramentos' trials meet each boss like everywhere else: an antechamber without music behind a fog wall; crossing it plays the cinematic or name card, then the boss music with the fight. Solo and co-op (owner decision 2026-10-28: the group gathers before the fight).
2. Lore fix: the lost shadow's scene («la sombra de alguien», `sima.scene.someone*`) plays on arrival at the antechamber, before the player decides whether to cross (the text addresses the undecided player; the shadow is optional, with stairs past it). Own shadow and herald scenes stay after the fog; the shadow's boss music still starts only after crossing.

## Findings

- Trials load each arena in `core/shrine.ts` (`startTrial`, `nextArena`) and progress with `progressTrial` / `progressSharedTrial`; `game.ts` skipped `withFogWall` for trials and the gather rule (`gather`, `watchLeave`) was off in trials.
- Trial time is `tally.playedMs`, ticked every step (`tallyStep` in `game.ts`).
- The fog crosses in co-op through the host snapshot (`core/sync.ts`: `fogWall: true` dropped -> `crossFogWall` on the guest), generic for any world.
- `simaMoment` in `game.ts` (feat/sima-fog-bonfires T1) moved the stray's scene to the crossing.

## Decisions

- Every trial arena (mid-bosses, guardians, the herald) opens behind its fog, the first and each next one after the pause. The party crosses with the same prompt and gather rule as a run; a guest crosses on the host's snapshot.
- Trial time (the record's best time) does not run behind the fog: waiting to gather costs nothing.
- No bonfire and no respawn in the shrine (unchanged): a trial is one attempt, pure; a full wipe ends it as a defeat and records how far it got.

## Tasks

- [x] T1 Shrine trials behind a fog wall (core trial loading and crossing, game wiring, trial time, tests, GDD). Route: delegated (single writer: `core/shrine.ts`, `app/game.ts`, tests). Commit `26fe121`.
- [x] T2 The lost shadow's scene on arrival again (game sequence, test, GDD line). Route: delegated (same writer; one mechanical code change plus test and doc). Commit `58c7278`.

## Parity checklist

- [x] Every shrine stop (`SHRINE_BOSSES` and the herald stop) has fog, no music before, its track after. Evidence: `tests/core/boss-music.test.ts` "every shrine trial arena"; `tests/core/shrine-fog.test.ts`.
- [x] Gauntlets: each next arena also opens behind its fog (`shrine-fog.test.ts`, «Todos los juramentos»).
- [x] Co-op: host crosses on the gather rule (`gather`/`watchLeave` now active at a trial's fog; `agreed` passed to `progressSharedTrial`); a guest never crosses on its own and follows the host snapshot (tested with `hostSnapshot`/`applyHostSnapshot`); catching up lands behind the fog (a stale fog from the previous arena is dropped in `nextArena`).
- [x] Trial records: time behind the fog not counted (`trialStepMs`, tested; `game.ts` tally).
- [x] Net protocol / save: no new fields (the fog syncs as before).
- [x] i18n: no new lines (the fog prompt texts `leave.fog.*` are shared).
- [x] GDD: fog rule (shrine included, "pendiente" note removed), no-bonfire reason for the shrine, shrine «Reflejos» line, stray line restored («sale al llegar a la antesala, antes de decidir»), Sima cinematics line.
- [x] Sim/prove harnesses unaffected; `npm run prove` 166/166 cards, 24/24 fights.

## Checks

`npm run typecheck`, `npx vitest run --testTimeout=30000`, `npm run build`, `npm run prove`.

## Progress

Created 2026-10-28.

- T1: RED observed (7 failing in `shrine-fog.test.ts` and the new `boss-music.test.ts` case). GREEN: `startTrial`/`nextArena` apply `withFogWall`; `progressTrial` crosses on `agreed` or (harness) touching the fog, never for a guest; `trialStepMs`; `game.ts` gather/prompt and tally. Existing `tests/core/shrine.test.ts` and `tests/net/shrine-room.test.ts` now cross the fog (or read the boss behind it) before fighting. Checks: typecheck clean; vitest 266 files / 3313 tests passed; build ok; prove 166/166 cards, 24/24 fights.
- T2: RED observed (`tests/app/sima-scene-due.test.ts`: module missing). GREEN: `src/app/sima-scene-due.ts` (pure timing rule) used by `simaMoment`; the lost shadow's scene plays on arrival behind its fog again; the first herald's and own-shadow scenes stay after the crossing; the stray's music still starts only after crossing (`floorMusic`). Checks: typecheck clean; vitest 267 files / 3318 tests passed; build ok; prove 166/166 cards, 24/24 fights.
- Next: nothing pending in this feature (deploy is the owner's call).
