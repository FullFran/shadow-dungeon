# shiny-echo

## Objective
A. Shiny skins (docs/gacha-roster-plan.md §5.1): every playable species has a shiny sheet; a skin is per line, cosmetic only, won at the gacha (2.5 % per pull, sure at 80 pulls without one) or, for the starters, by clearing the line's challenge on Pesadilla; each unlock is an achievement; toggled per line in the loadout and Phantump's window; seen by teammates in co-op and the town lobby; the gacha reveal shows it with a sparkle and "¡Shiny!".
B. Personal Sima echo: the Eco del Eclipse becomes a corrupted copy of the player's current species ("Eco de <especie>"), alternating among the party's species in co-op (deterministic by echo index and sorted player ids).

## Problem
Owner: shiny skins are planned in the gacha plan and never dropped (CLAUDE.md). Owner: "el eco del abismo sea una versión corrompida de ti, no solo de Mimikyu; en cooperativo que se alternen".

## Why
Parity rule: a new system reaches every playable species, solo and co-op, save, net, i18n, GDD, sim/prove.

## Scope
- Sprites: a shiny form per playable sprite (PMDCollab `<dex>/<form>/0001/`, local `public/sprites/<dex>/<form>/0001/`), the Busted Mimikyu too; sprite-meta and CREDITS regenerated (`node tools/fetch-sprites.mjs --only=shiny`).
- Data/core: `GACHA.shinyRate` 0.025, `GACHA.shinyPity` 80, separate `shinyPity` counter; `core/shiny.ts` (lines, unlock, wear toggle, Nightmare challenge unlock for the lines outside the gacha pool, data-driven from `CHALLENGES`); achievements family `shiny`, one per line.
- Save: optional `shinies`, `shinyWorn`, `shinyPity` (sanitized); no SAVE_VERSION bump (optional fields, like roster-parity).
- UI: loadout moves step and Phantump's window toggle per line; gacha reveal sparkle + "¡Shiny!".
- Net: `hello.shiny`, roster entry `shiny`, state `sh`; PROTOCOL_VERSION 4. Town lobby walkers wear it.
- Echo: `core/eclipse-echo.ts` `echoMimic(floor, party)`; `WorldState.echoMimic` (presentation only); renderer and HUD name; "Eco de <especie>" and lines es/en.

## Constraints
- Allowed surfaces: odd/tasks/shiny-echo.md, src/**, tests/**, tools/**, public/sprites/**, CREDITS.md, docs/gdd.md, index.html.
- Another agent works on `feat/accounts-client` (cloud save adapter + account UI): save changes are optional fields only, self-contained.
- English code/commits; i18n es (peninsular, no em dashes) / en; GDD in Spanish. One Conventional Commit per task, explicit paths, no AI attribution, no push/merge.

## Delivery strategy
single branch `feat/shiny-echo` from main 76beb88, one commit per task; forecast ~1,200 authored lines (sheets and sprite-meta are generated); PR slicing is the user's decision.

## Tasks
- [ ] T1 A data+core: shiny sheets, gacha shiny roll and pity, core/shiny.ts, Nightmare challenge unlock, achievements, save fields, tests. Route: inline (bounded writer delegated by the parent).
- [ ] T2 A UI+net: loadout and Phantump toggles, gacha reveal, player/remote/town sprites, protocol v4. Route: inline.
- [ ] T3 B personal echo: echoMimic, renderer/HUD name, lore lines, tests, GDD. Route: inline.

## Acceptance
- typecheck, `npx vitest run --testTimeout=30000 --maxWorkers=4`, build, `npm run prove` green.
- Every playable species has a shiny sheet with Idle, Walk, Attack, Shoot, Charge, Hurt; a shiny changes no stat or move.
- Shiny pull rate and the 80-pull guarantee hold over seeds; every starter line unlocks by its Nightmare challenge.
- Every playable species renders as an echo; the echo's patterns do not depend on the mimicked species.

## Parity checklist
- [ ] Species: every `PLAYABLE_SPECIES` (and Busted Mimikyu) has a shiny sheet.
- [ ] Lines: every line (gacha via pull, starters via challenge) can unlock its skin; achievement per line.
- [ ] Dungeons: the Nightmare challenge unlock iterates `CHALLENGES`; the echo applies in the Sima (the only eclipse floor).
- [ ] Solo + co-op: skin in hello/roster/state and town lobby; echo alternation deterministic.
- [ ] Save: sanitize/round-trip of the new fields.
- [ ] Net: protocol version bump.
- [ ] i18n es/en.
- [ ] GDD.
- [ ] sim/prove.

## Progress
- Branch created from 76beb88.

## Next step
T1.
