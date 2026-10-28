# First-run fixes (audit of the first-run flow)

## Objective

Fix the eight issues a read-only audit of the first-run flow found (evidence at `8de776b`), so a new player meets the story in order and a returning player is not treated as new:

- F1 (high) The villagers' pleas wait until the Crypt is first cleared (owner decision), then play on the next solo town arrival.
- F2 (high) The Sima's breaking point («lost», Phantump's explanation) plays on the first Sima run that ends lost or defeated, not only when lucidity runs out.
- F3 (medium) A player whose save already shows progress (a returning account on a new device) skips the prologue and quiz; the quiz never overwrites their species.
- F4 (medium) A Senda chapter's «before» cinematic plays in full once per chapter, then a short title card on retries.
- F5 (medium) Achievement toasts wait for the post-run cinematics (they show with the results); the boot catch-up toast never sits over the prologue.
- F6 (low) `simaScene` returns null without calling `onDone` when the scene was seen (no double `then` in `simaMoment`).
- F7 (low) After the pleas on arrival the player goes back where the town opened (the hub's spawn after a run), not left on the crater's rim.
- F8 (low) The cinematic stage scales to fit small viewports (fractional below 2x, crisp via `image-rendering`), whole numbers from 2x up.

## Why

A first-time player met villagers talking about the Sima Walkers and "your shadow" right after the quiz, before any of it is introduced; a player who always dies by HP in the Sima never learned what the Sima is; a returning account was sent through the prologue and quiz again and lost its species; retries replayed long cinematics; toasts covered cinematics; phones showed the cinematics tiny.

## Scope and constraints

- Allowed edit surfaces: `src/**`, `tests/**`, `index.html`, `docs/gdd.md`, this document.
- Co-op guests unchanged: they skip story and mouth cinematics, no pleas in rooms, no seen flags set by guests.
- Player text in `src/i18n/es.json` (peninsular Spanish) and `en.json`; GDD in Spanish.

## Tasks

- [x] F1+F7 Pleas after the first Crypt clear; after the arrival pleas, back to where the town opened. Route: inline (two small code sites in `town/scene.ts`, `town/plea.ts`, `app/main.ts`; context already read). Commit `43b81ff`.
- [x] F2+F6 Breaking point on the first lost or defeated Sima run; `simaScene` returns null without calling `onDone`. Route: inline (pure rule in `app/sima-cinematic.ts`, call sites in `app/main.ts`). Commit `44544ed`.
- [x] F3 Returning players with progress skip prologue and quiz. Route: inline (pure predicate in `app/adventure-route.ts`, wiring in `app/main.ts`). Commit `c74c624`.
- [x] F4 Story «before» cinematic in full once per chapter, then a title card. Route: inline (`app/story.ts` seen flags and short panels, `app/main.ts`). Commit `ee19e2f`.
- [x] F5 Achievement toasts held during cinematics. Route: inline (gate in `app/achievements.ts`, holds in `app/main.ts`). Commit `6f24c36`.
- [x] F8 Cinematic stage fit-to-viewport scale. Route: inline (pure scale in `ui/cinematic.ts`, used by `app/prologue.ts`). Commit `44b6973`.

Route note: this document is executed by one delegated worker (the parent delegated the whole feature); inside it each task is a small, already-mapped edit, so no further delegation.

## Parity checklist

- [x] Pleas: solo only (rooms never), legacy records (`clearedDungeons` counts a pre-flag victory in the first dungeon), old saves that cleared the Crypt and have not seen them get them on the next arrival; heading for the Sima still plays them if due.
- [x] Sima breaking point: solo only (shared runs unchanged), every non-victory, non-cut-short end (eclipse and defeat); text reads right after an HP death in es and en.
- [x] Returning players: progress predicate covers runs, victories, coins, earned, owned, story, achievements; quiz never runs for them.
- [x] Story cinematic: every Senda line and chapter (`STORY_QUESTS`), short card text exists in every language; guests still skip; gallery replays still full and mark nothing.
- [x] Toasts: post-run (every end path: story after, Sima scenes, plain results, trial end), boot catch-up vs prologue, stalls unaffected.
- [x] Cinematic scale: prologue, guardian, Sima, story and herald cinematics share the one player (`prologueScreen`); desktop sizes keep whole-number scales.
- [x] GDD updated for every rule change (pleas, Sima breaking point, prologue/returning players and cinematic scale, Senda «before», achievement notices); no new player text (F2 kept its lines, F4 reuses existing title keys), so no i18n changes.
- [x] Co-op guests unchanged: no pleas in rooms (`simaPlea` only on the solo town), the Sima end scenes and story cinematics stay behind `!shared.net`, no seen flag is written by a guest; save, net protocol and sanitize untouched (new flags are device-local keys, like the existing seen flags).
- [x] Sim/prove harnesses unaffected (`npm run prove` green).

## Checks

`npm run typecheck`, `npx vitest run --testTimeout=30000`, `npm run build`, `npm run prove`.

## Progress

Created 2026-10-28 on branch `feat/first-run-fixes`.

- F1+F7: RED observed (`tests/app/sima-plea-due.test.ts`: 3 failing, `pleaReady` missing, `ready:` and `opened` absent). GREEN: `pleaReady(cleared)` in `town/plea.ts` (the Crypt in the records' cleared set, legacy victories included); `pleaOnArrival` takes `ready`; the solo town passes `ready: () => pleaReady(cleared())`; heading for the Sima still plays them when due (unchanged); rooms never get `simaPlea` (only `townScreen` wires it). After the arrival pleas the walker goes back to where the town opened (`enterMap(opened.map, opened.walker)`): the hub's spawn after a run, the shrine or beacon tile when the town reopened there. Deliberate: the owner said "hub spawn"; returning to the place the town opened is the hub spawn in every post-run arrival and avoids teleporting a player who reopened the town at the shrine or beacon. GDD «Las súplicas» updated. Checks: focused vitest (sima-plea-due + tests/town) 223/223; typecheck clean.
- F2+F6: RED observed (`tests/app/sima-cinematic.test.ts`: 2 failing, `simaEndScene` and `simaSceneSkipped` missing). The new text guard (no «lucidez/lucidity/reloj/clock/0:00» in the breaking point, es and en) passed from the start: the lines speak of getting lost and falling, which reads right after an HP death, so no text changed. GREEN: `simaEndScene` (pure: `lost` on the first non-victory end, then `return`, then `return-short`; none when cut short) used after the run; `simaSceneSkipped` makes `simaScene` return null without calling `onDone`; both callers that depend on the callback (the run's end, the mouth) go on by themselves when it returns null; `simaMoment` already did. GDD Sima cinematics line and the data comment updated. Checks: vitest tests/app 333/333; typecheck clean.
- F3: RED observed (`tests/app/adventure-route.test.ts`: 2 failing, `hasProgress` and `withReturningPlayer` missing). GREEN: `hasProgress(save, records)` (runs, victories, coins, earned, owned, story, upgrades, learned, achievements); `withReturningPlayer` (starter counts as chosen, the records' last species when it is in the roster, a chosen starter untouched); `adoptReturningPlayer()` runs first in `playScreen` and `newAdventure` (marks the prologue seen, updates the settings), so the quiz never runs for such a player. Deliberate: a last species that has evolved since is not in the roster under its old id, so the current species stays (the player picks it in the loadout). GDD prologue paragraph updated. Checks: adventure-route 8/8; typecheck clean.
- F4: RED observed (`tests/app/story-cinematic.test.ts`: 3 failing, `hasSeenStoryBefore`/`markStoryBeforeSeen`/`storyBeforePanels` missing). GREEN: device-local seen flags under `mazmorra-sombria.storySeen` (`line:chapter`, like the guardians' and the Sima's flags, not progress); `storyBeforePanels` gives the full «before» the first time, then one 3.2 s title card on the first tableau with the Senda's and the chapter's names (existing keys `story.<line>.title`, `story.<line>.<n>.title`, so no new text). The «before» is marked seen when it ends or is skipped; the «after» is unchanged (it plays once, on the victory that closes the chapter). Guests still skip (`!shared.net`), the gallery still replays in full and marks nothing. The test iterates every Senda in `STORY_QUESTS` and chapters 1-3, both languages. Checks: story-cinematic + story-quests 32/32; typecheck clean.
- F5: RED observed (`tests/app/toast-gate.test.ts`: 5 failing, `toastGate` missing; one expectation of mine was then corrected: a hold takes down toasts already on screen, as designed). GREEN: pure `toastGate` (hold/release counted, queued in order, a toast on screen at a hold is taken down and shown again after, one closed by itself is not); `achievementToast` goes through it. The prologue holds and releases through a new `onClose` of the prologue player (runs on end, skip, or when another screen replaces it, so a hold never leaks). The run's end holds before its toast and `results()` releases right after the result screen, which covers every path (Senda «after», every Sima scene, plain results; a shrine trial returns before and never holds). Stalls (`settleOnClose`) and the boot catch-up toast are unchanged outside cinematics. Left as is: the post-run hold relies on `results()` running; a story or Sima cinematic replaced by another screen mid-way would leave the gate held (no such path exists today: the account's replace only redraws the title). GDD achievements paragraph updated. Checks: vitest tests/app 345/345; typecheck clean.
- F8: RED observed (`tests/ui/cinematic.test.ts`: 3 failing, `stageScale` missing). GREEN: pure `stageScale(viewW, viewH, stageW, stageH)` in `ui/cinematic.ts`: the largest whole number from 2x (desktop unchanged: 1920x1080 6x, 1366x768 4x, 800x600 2x), the exact fractional fit below (390 px portrait: 1.22x instead of 1x; tiny viewports no longer overflow); the prologue player uses it and floors the CSS size to whole pixels; `image-rendering: pixelated` was already on `.prologue-canvas` (index.html), so no CSS change. One player for every cinematic, so all of them get it. Not verified in a real browser on a phone (inference from the layout maths only). GDD prologue paragraph notes the scale rule. Checks: vitest tests/ui + tests/app 416/416; typecheck clean.
- Final gate (after all six commits): `npm run typecheck` exit 0; `npx vitest run --testTimeout=30000` 269 files / 3337 tests passed; `npm run build` built (chunk-size warning only, pre-existing); `npm run prove` 166 cards (166 survivable), 24/24 solver fights.
- Open for the owner: F7 returns the player to where the town opened rather than always the hub spawn (same thing after a run); a returning player's last species that evolved since is not adopted (they pick it in the loadout); F8 not checked on a real phone.
- Next: nothing pending in this feature (push, PR and deploy are the owner's call).
