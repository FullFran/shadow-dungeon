# Integrate the new adventure (starters + quiz + prologue)

## Objective
Merge `feat/starters`, `feat/personality-quiz` and `feat/prologue` onto `main` (which gained licensed music) and wire one new-adventure flow: first Play → prologue (if not seen) → quiz → result → loadout preselected with the quiz species → run.

## Scope
- Merges in order with `--no-ff`, conflicts resolved preserving every feature; `npm test` and `npm run build` after each.
- One source of truth for the starter: the `species` setting plus a `starterChosen` flag (no separate storage key).
- Pure routing function for the new adventure, tested.
- Styles that the parallel writers injected or inlined move to `index.html`.

## Tasks
- [x] M1 merge `feat/starters` (route: inline, conflicts limited to the CREDITS generator)
- [x] M2 merge `feat/personality-quiz` (route: inline)
- [x] M3 merge `feat/prologue` (route: inline)
- [x] W1 wire the new-adventure flow (route: inline single writer; delegated writer already)
- [x] M4 sync `main` (music track swap) before reporting

## Acceptance criteria
- First Play with fresh storage: prologue, quiz, result (no Mimikyu fallback text), loadout preselected with the quiz species, run.
- "Prólogo" title entry replays only the prologue and returns to the title.
- Settings "Repetir test" re-runs the quiz and updates the species.
- CREDITS regeneration keeps Font/Music/Audio sections (one mechanism, tested).
- `npm test`, `npm run build` green; no AI attribution in commits.

## Evidence
### M1 starters
Conflicts: `tools/sprite-lib.mjs`, `tools/fetch-sprites.mjs`, `tests/sprite-pipeline.test.ts`. Two mechanisms for keeping hand-written CREDITS sections: `mergeCredits` (main, music writer) and `preservedSections` (starters). Kept `mergeCredits` only: it is tested for idempotence, section order and a round trip of the real CREDITS.md; `preservedSections` and its tests were dropped. CREDITS.md auto-merged with the new species and all sections (Sprites, Font, Music, Audio). `npm test` 51 files / 520 passed; build passed.

### M2 personality quiz
Conflicts: `src/app/main.ts` (imports, starter hand-off, loadout, lobby species), `README.md`. Runs keep `settings.species` (starters); the quiz result also wrote the species setting so it reaches the run. README merged both paragraphs. `npm test` 54 / 545 passed; build passed.

### M3 prologue
Conflicts: `src/adapters/audio.ts` (main's licensed streaming voices vs the prologue cue player), `src/app/main.ts`. Audio: both imports; `playCue` stops music with `switchTo(null)` instead of the removed `stopMusic`; unlock plays a pending cue first, else `switchTo(wanted)`; `setMusic(context)` stops a cue for a non-null context, then main's logic. main.ts: newAdventure chains prologue → quiz → loadout. `npm test` 59 / 575 passed; build passed; both i18n JSON files parse.

### W1 new-adventure flow
- `src/app/adventure-route.ts` `nextAdventureScreen({ prologueSeen, starterChosen })` → `prologue | quiz | loadout`; `newAdventure` re-asks it after each step. Prologue title entry still returns to the title.
- `Settings.starterChosen` (default false, validated on load) and `withStarter(settings, species)`; the quiz result calls it. `src/app/starter-choice.ts` (own storage key, `playableStarter` Mimikyu fallback) and its test were removed; `quiz.notPlayable` text and key removed. A test enforces every quiz starter is playable.
- Styles: `.type-fire`/`.type-ground` badge fills, quiz CSS and prologue CSS moved to `index.html`; `TYPE_BADGE_FILLS` and `src/ui/style.ts` (`ensureStyle`) removed.
- TDD: RED observed (missing module, missing `starterChosen`/`withStarter`), then GREEN. `npm test` 59 / 580 passed; build passed.
- Screenshots (headless Firefox driven over WebDriver BiDi, `/tmp/integrate/`): title with Prólogo, prologue, quiz voice, quiz question, quiz result "¡Eres un Cubone!" (no fallback text), loadout preselected on Cubone, in-game Zorua, Litwick, Cubone. Stored settings after the quiz: `species: cubone, starterChosen: true`.

## Notes
- Users from `main` have no `starterChosen`, so their first Play after this runs prologue and quiz once.
- Audio flows not verified by ear (headless cannot unlock audio).

## Next step
Parent: review, decide PR slicing, playtest the full first-Play flow with sound.
