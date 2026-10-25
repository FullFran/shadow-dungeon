# Prologue cinematic

## Objective
Open the game with a ~60–75 s prologue that feels like the opening of Dark Souls (slow mythic narration as on-screen text, still tableaux fading in from darkness, gravitas), drawn in the Mystery Dungeon pixel style, and ending on "…¿Me oyes? ¿Puedes oírme?" that hands over to the personality quiz.

## Problem
The game starts straight at the title menu with no premise. The Crimson Eclipse, the Shadow Dungeons and the Sword King exist only as names in docs; the player never learns why the world is dark.

## Why
A short, skippable prologue sets the tone for the stream (Rocío's audience sees it once), gives the eclipse backdrop a meaning and sets up the personality quiz the same way the Mystery Dungeon games do.

## Scope
- Original narration (Spanish first, neutral peninsular register; English translation) in 6–8 panels; a short provisional lore section in `docs/gdd.md`.
- A data-driven timeline (panel duration, fade in/out, text reveal speed, camera pan/zoom) played on a low-res canvas scaled pixelated, with code-drawn backdrops (eclipse forming from a sun, ring pulse, embers) and dark silhouettes from the sprite sheets already in `public/sprites` (Aegislash, Mimikyu, Poochyena, Gastly).
- Skippable: hold Esc/Enter, or click "Saltar" (shown after 1 s). Plays automatically on the first "Play" and from a title entry "Prólogo"; remembers it was seen.
- A slow procedural prologue track (drones, bell and choir-like pads, timpani at the eclipse reveal) with a manifest hook so a licensed recording can replace it.
- `onDone` callback (and the route name `prologue`) for the next screen; the quiz is built elsewhere.

Out of scope: the personality quiz, new sprites, voice acting, the licensed track itself.

## Constraints
- Necrozma is never shown or named; only hints (a light being devoured, a crystalline shard glint).
- No phrase copied from Dark Souls or any game.
- Other writers work in parallel (starters, personality quiz, licensed music): new modules, one small hook in `src/app/main.ts`, new i18n keys in one contiguous block; no dependency on `src/data/music.ts`.
- `index.html` is outside the edit surface: prologue styles are injected by its own module.
- "Seen" is stored through the storage port under its own key (not a new `Settings` field) so the parallel writers editing `settings.ts` do not conflict.
- Architecture test green (core/data stay pure); no AI attribution in commits.

## Tasks
- [x] T1 Script: narration in i18n (es, en), 8 panels; provisional lore section in `docs/gdd.md` (route: inline, single writer worktree).
- [x] T2 Cinematic player: pure timeline (panel at t, alpha curves, text reveal, camera, skip), scenes renderer, player screen, title entry, first-play hook, seen flag (route: inline in this writer).
- [ ] T3 Music: procedural prologue score in the audio adapter, manifest hook for a licensed file (route: inline in this writer).

## Acceptance criteria
- Total length between 60 and 75 s; every narration key exists in es and en.
- Panel lookup, alpha curves, text reveal and skip rules covered by unit tests.
- First "Play" plays the prologue, later ones go straight on; title entry replays it.
- Skip works by holding Esc/Enter or clicking "Saltar" after 1 s.
- Eclipse reveal has a timpani hit in the score; a licensed file can replace the score by setting one field.
- `npm test` and `npm run build` pass.

## Checks
`npm test`, `npm run build`, headless Firefox screenshots of 3–4 panels in `/tmp/prologue/`, `git log --format=%B -n 3 | grep -ic co-authored` = 0.

## Progress
Created 2026-10-25 on branch `feat/prologue`. Forecast ~900 authored lines (T1 ~120, T2 ~550, T3 ~250). Delivery strategy: ask-on-risk (the parent decides slicing).

### T1 Script
Narration in `src/i18n/{es,en}.json` (`prologue.*` block, 8 panels, 15 lines); lore section "Prólogo y trasfondo" in `docs/gdd.md` §3, flagged provisional. Checks: `npm test` green.

### T2 Cinematic player
Route: inline (single writer; delegation trigger not applicable inside a delegated writer).
- Pure timeline `src/ui/cinematic.ts` (panelAt, panelAlpha eased fades, revealedChars, cameraAt, skip rules); panel data `src/data/prologue.ts` (8 panels, 74 s, eclipse reveal at 27.9 s).
- Scenes `src/adapters/prologue-scenes.ts` on a 320×180 stage: light, hunger (light sinking, crystal glint), dimming (moon slides over the sun), eclipse (black, flash, ring via the shared `drawEclipse` now exported from `src/ui/eclipse.ts`), dungeons, shadows, king (Aegislash shield form, shaded silhouette), voice (black).
- Player `src/app/prologue.ts` (`prologueScreen`, `PROLOGUE_ROUTE`, `onDone`); styles injected by the module; first frame drawn in a microtask so it never flashes black.
- Seen flag `src/app/prologue-seen.ts` (own storage key). `main.ts`: Play goes through `newAdventure` (prologue first time), title entry "Prólogo" (index 4), dev `?screen=prologue&at=ms`.
- RED observed (modules missing), GREEN: 19 new tests. `npm test`: 52 files, 447 tests passed. `npm run build`: passed.
- Screenshots (headless Firefox 1280×720) in `/tmp/prologue/`: light, hunger, eclipse, shadows, king. Fixes made from them: figures and the crystal moved above the text band; Aegislash switched from a flat silhouette (unreadable blob) to a shaded one; text raised off the fan notice.
