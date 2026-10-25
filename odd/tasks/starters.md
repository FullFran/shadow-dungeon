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
- [x] T2 Kits: species data, moves, passives in core with tests, types fire/ground, species setting, net species (route: inline single writer)
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

### T2 Kits (inline)
Kits (official Spanish names in es.json; power official, timings provisional):

| Species (HP, speed) | Fast | Heavy | Passive |
|---|---|---|---|
| Zorua, Dark (90, x1.12) | Golpes Furia (Normal 18, 5 hits; Dark coverage), Finta (Dark 60, dash) | Pulso Noche (Dark 85, 360° ring), Juego Sucio (Dark 95, charged lunge, x1.5 on an enemy in telegraph/attack) | Ilusión: sleeping enemies only notice you by touch; first hit is a crit; breaks on hitting or being hurt; back each room |
| Litwick, Ghost/Fire (85, x0.95) | Ascuas (Fire 40, fast bolt), Impresionar (Ghost 30, point-blank, big stagger) | Infortunio (Ghost 65, slow bolt, x2 on a staggered enemy), Infierno (Fire 100, slow big orb, 40 stamina) | Absorbe Fuego: Fire hits heal 25% of their damage instead of hurting and power the next heavy x1.5; a perfect dodge of a Fire hit also counts |
| Cubone, Ground (115, x0.92) | Hueso Palo (Ground 65, staggering swing), Ataque Óseo (Ground 25, 3 hits while dashing 30 px) | Huesomerang (Ground 50, out and back, hits on both passes), Pataleta (Ground 75, 360° stomp, x2 after a missed melee move) | Armadura Batalla: frontal hits deal half while a heavy move charges or winds up |

Neutral-target DPS at level 1 (uncharged): Mimikyu fast 64 / heavy 35; Zorua 48-50 / 34-37 (+ crit opener, faster walk); Litwick 32-40 at range / 30-35 (Hex 59 on staggered); Cubone 46-51 / 27-47 (Tantrum 54 after a miss), with the most HP.

Decisions:
- Status conditions do not exist, so the kit sketch's Burn became stagger: Hex doubles on a hitstunned enemy (Ember/Astonish set it up). Foul Play's "target mid-attack" reads the enemy AI mode.
- Feint Attack is a plain dash (no blink behind the target); Inferno is a big slow orb without the fire-ring burst.
- Player hits never interrupt the player in this engine, so Battle Armor's "cannot be interrupted" is already true for everyone; it only halves frontal damage.
- Flash Fire is inert with today's enemies (Poochyena Dark, Gastly Ghost, Aegislash Steel/Ghost: no Fire attacks). It needs a Fire enemy or boss pattern to matter.
- New generic move fields: `multiHit` (active window split in parts, claim ids carry the part), `bonus` (attacking / staggered / afterMiss), projectile `boomerang` (turns back at half life, pierces, second-pass claim id `<id>r`). New player fields `illusionBroken`, `flashFire`, `lastMoveMissed`; `IncomingHit` gains `type` and `from`; event `passiveTriggered`.
- Player HP now comes from the species (Mimikyu stays 100). Walking speed scales by `speedScale`.
- Net: the hello and player snapshots already carried the species; added `hidden` (Illusion) to the player snapshot so the host's sleeping enemies ignore a hidden guest Zorua. Wire: optional trailing `1` after the projectile list.
- `settings.species` (default mimikyu); the stored loadout is validated against it (falls back to that species' default). Used by solo, `?net=local` and room-code runs.
- Types Fire and Ground added to the chart (Gen 6+ values among the game's types). Type badge colours for them land in T3.

TDD: RED observed for the starter core tests (missing exports), the log lines, the settings species and the protocol `hidden` flag (reverted the protocol change to watch it fail). The lobby/loopback species tests passed on first run because the protocol already carried species; the presentation sprite tests were written after the adapter change.

Checks: `npm test` 50 files / 473 tests passed; `tsc` (both configs) clean.
