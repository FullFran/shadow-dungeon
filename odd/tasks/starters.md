# Playable starters: Zorua, Litwick, Cubone

## Objective
Add three playable starters approved by the user on 2026-10-25, next to Mimikyu: Zorua (Dark, fast melee, passive Illusion), Litwick (Ghost/Fire, ranged, passive Flash Fire) and Cubone (Ground, guard/bruiser, passive Battle Armor = hyper armor during heavy windups).

## Problem
Mimikyu is the only playable species; the species is a hardcoded constant in the app, the loadout picker, the settings and the sprite selection.

## Why
The starter pick is the first choice of a run (the isekai arrival) and each starter must change how you play (GDD §4 "El kit de cada Pokémon").

## Scope
- Sprites for Zorua (0570), Litwick (0607), Cubone (0104), and Mimikyu Busted (0778/0001) for the broken Disguise look, through `tools/fetch-sprites.mjs`; CREDITS.md regenerated keeping the hand-written sections (Font, Music).
- Kits: 2 fast-slot and 2 heavy-slot moves per species, official Spanish move and ability names, passives in the core with behaviour tests, base stats per species in data.
- `species` as a run setting (default mimikyu), used by solo and shared runs; the hello/join message carries the species so remote players render with their own sprite.
- Picker: choose the species (cursor list with sprite preview, type badges, passive text), then its moves; the choice persists. HUD and log name the species.

Out of scope: status conditions (Burn), the gacha, alternates (Absol, Misdreavus, Honedge), new enemies with Fire attacks.

## Constraints
- `src/core` stays pure and deterministic; architecture test green.
- Other writers work in parallel (music, quiz, prologue): no reformatting of shared files; new i18n keys in one contiguous block.
- One Conventional Commit per task, no AI attribution.

## Tasks
- [x] T1 Sprites: fetch the three species and Mimikyu Busted; credits regenerated with Font/Music kept (route: inline single writer)
- [ ] T2 Kits: species data, moves, passives in core with tests, types fire/ground, species setting, net species (route: inline single writer)
- [ ] T3 Picker: species step then moves, persisted; HUD/log species names; docs (route: inline single writer)

Route note: this whole feature runs inside one delegated bounded writer (the parent delegated it); tasks run inline within that writer.

## Acceptance criteria
- Each starter can be picked, starts a run with its own sprite, kit and passive; the choice survives a reload.
- Passives have deterministic core tests (RED then GREEN).
- A guest playing Zorua is drawn as Zorua on the host and vice versa.
- `npm test` and `npm run build` pass.

## Checks
`npm test`, `npm run build`, `git log --format=%B -n 4 | grep -ic co-authored` = 0; optional headless screenshots in `/tmp/starters/`.

## Progress
Created 2026-10-25. Forecast ~1000 authored lines (excluding generated sprite sheets and sprite-meta.json); delivery strategy `ask-on-risk` (the parent decides PR slicing).

### T1 Sprites (inline)
- `tools/fetch-sprites.mjs` targets Zorua 0570, Litwick 0607, Cubone 0104 and Mimikyu Busted 0778/0001, and requests the optional `SpAttack` sheet. Existing sheets came back byte-identical; `sprite-meta.json` only gained entries.
- Fix: the generator rewrote CREDITS.md from scratch and would have dropped the Font section (and any Music section from the music branch). New `preservedSections` in `tools/sprite-lib.mjs` keeps every `## ` section after `## Sprites`; RED observed (2 failing tests, missing export), then GREEN.
- Animation availability (resolved `CopyOf` aliases): Litwick Shoot and SpAttack are copies of Charge, Cubone Shoot is a copy of Charge, Zorua Strike is a copy of Attack and SpAttack a copy of Shoot. All four have Hop, Double, Strike, Swing, Rotate.
- Credits: 9 artists (adds Emmuffin, Sceptile, Some_Shinx; CHUNSOFT gains Cubone, baronessfaron gains Zorua and Mimikyu Busted).
- Checks: `npm test` 49 files / 430 tests passed.
