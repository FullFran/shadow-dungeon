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

- [x] F1+F7 Pleas after the first Crypt clear; after the arrival pleas, back to where the town opened. Route: inline (two small code sites in `town/scene.ts`, `town/plea.ts`, `app/main.ts`; context already read). Commit: see Progress.
- [ ] F2+F6 Breaking point on the first lost or defeated Sima run; `simaScene` returns null without calling `onDone`. Route: inline (pure rule in `app/sima-cinematic.ts`, call sites in `app/main.ts`).
- [ ] F3 Returning players with progress skip prologue and quiz. Route: inline (pure predicate in `app/adventure-route.ts`, wiring in `app/main.ts`).
- [ ] F4 Story «before» cinematic in full once per chapter, then a title card. Route: inline (`app/story.ts` seen flags and short panels, `app/main.ts`).
- [ ] F5 Achievement toasts held during cinematics. Route: inline (gate in `app/achievements.ts`, holds in `app/main.ts`).
- [ ] F8 Cinematic stage fit-to-viewport scale. Route: inline (pure scale in `ui/cinematic.ts`, used by `app/prologue.ts`).

Route note: this document is executed by one delegated worker (the parent delegated the whole feature); inside it each task is a small, already-mapped edit, so no further delegation.

## Parity checklist

- [x] Pleas: solo only (rooms never), legacy records (`clearedDungeons` counts a pre-flag victory in the first dungeon), old saves that cleared the Crypt and have not seen them get them on the next arrival; heading for the Sima still plays them if due.
- [ ] Sima breaking point: solo only (shared runs unchanged), every non-victory, non-cut-short end (eclipse and defeat); text reads right after an HP death in es and en.
- [ ] Returning players: progress predicate covers runs, victories, coins, earned, owned, story, achievements; quiz never runs for them.
- [ ] Story cinematic: every Senda line and chapter (`STORY_QUESTS`), short card text exists in every language; guests still skip; gallery replays still full and mark nothing.
- [ ] Toasts: post-run (every end path: story after, Sima scenes, plain results, trial end), boot catch-up vs prologue, stalls unaffected.
- [ ] Cinematic scale: prologue, guardian, Sima, story and herald cinematics share the one player (`prologueScreen`); desktop sizes keep whole-number scales.
- [ ] GDD updated for every rule change; i18n es/en for any new text.

## Checks

`npm run typecheck`, `npx vitest run --testTimeout=30000`, `npm run build`, `npm run prove`.

## Progress

Created 2026-10-28 on branch `feat/first-run-fixes`.

- F1+F7: RED observed (`tests/app/sima-plea-due.test.ts`: 3 failing, `pleaReady` missing, `ready:` and `opened` absent). GREEN: `pleaReady(cleared)` in `town/plea.ts` (the Crypt in the records' cleared set, legacy victories included); `pleaOnArrival` takes `ready`; the solo town passes `ready: () => pleaReady(cleared())`; heading for the Sima still plays them when due (unchanged); rooms never get `simaPlea` (only `townScreen` wires it). After the arrival pleas the walker goes back to where the town opened (`enterMap(opened.map, opened.walker)`): the hub's spawn after a run, the shrine or beacon tile when the town reopened there. Deliberate: the owner said "hub spawn"; returning to the place the town opened is the hub spawn in every post-run arrival and avoids teleporting a player who reopened the town at the shrine or beacon. GDD «Las súplicas» updated. Checks: focused vitest (sima-plea-due + tests/town) 223/223; typecheck clean.
