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
- [x] T1 A data+core: shiny sheets, gacha shiny roll and pity, core/shiny.ts, Nightmare challenge unlock, achievements, save fields, tests. Route: inline (bounded writer delegated by the parent). Commit 7b6e5e7.
- [x] T2 A UI+net: loadout and Phantump toggles, gacha reveal, player/remote/town sprites, protocol v4. Route: inline. Smoke: shiny gacha reveal (shiny Shinx, sparkle, «¡Shiny! ¡Shinx! (Común)») and the loadout portrait of a shiny Zorua.
- [x] T3 B personal echo: echoMimic, renderer/HUD name, lore lines, tests, GDD. Route: inline. Smoke: a Sima floor 10 as Zorua shows a dark red Zorua «Eco de Zorua · Anillo» and the log line.

## Acceptance
- typecheck, `npx vitest run --testTimeout=30000 --maxWorkers=4`, build, `npm run prove` green.
- Every playable species has a shiny sheet with Idle, Walk, Attack, Shoot, Charge, Hurt; a shiny changes no stat or move.
- Shiny pull rate and the 80-pull guarantee hold over seeds; every starter line unlocks by its Nightmare challenge.
- Every playable species renders as an echo; the echo's patterns do not depend on the mimicked species.

## Parity checklist
- [x] Species: every `PLAYABLE_SPECIES` sprite and spent sprite (Busted Mimikyu) has a shiny sheet with the same animation sources as its normal one, files on disk: tests/data/shiny-sprites.test.ts (20 cases); drawn in runs, remotes and the town: tests/adapters/shiny-presentation.test.ts. Every playable species renders as the echo in every pose: tests/core/echo-mimic.test.ts.
- [x] Lines: `SHINY_LINES` covers every playable species' line; gacha lines unlock by pull, the others (starters) by their own challenge; one `shiny-<line>` achievement each: tests/core/shiny.test.ts, tests/core/achievements.test.ts (witness per rule).
- [x] Cosmetic: every playable species plays an identical run with the skin on and off (mutation-checked: a +1 max HP on shiny fails it): tests/core/shiny.test.ts. The echo's fight is identical whoever it copies, for every playable species: tests/core/echo-mimic.test.ts.
- [x] Dungeons: the Nightmare unlock iterates every challenge, tier and outcome (tests/core/shiny.test.ts, tests/app/save.test.ts); the echo lives only in the Sima (no shrine trial uses it; `rg eclipse src/data/shrine.ts` empty).
- [x] Solo + co-op: skin in hello, roster entries (lobby/start), state `sh`, remote players and town walkers (tests/net/shiny-wire.test.ts); echo alternation by encounter over sorted ids, order-independent (tests/core/echo-mimic.test.ts); each peer computes it from the host's roster.
- [x] Save: `shinies`, `shinyWorn` (subset), `shinyPity` (capped under the guarantee) sanitized and round-tripped, no SAVE_VERSION bump: tests/app/save.test.ts.
- [x] Net: PROTOCOL_VERSION 3 -> 4 (tests/net/shiny-wire.test.ts).
- [x] i18n es/en: achievement family and texts, gacha «¡Shiny!» and stall line, loadout and Phantump rows, «Eco de {species}» and three echo lines; no em dashes (tests/i18n.test.ts green).
- [x] GDD: §3 Sima (Eco del Eclipse personal, alternation, name), §5 gacha shiny and «Aspectos shiny», §11 achievements table.
- [x] sim/prove: `npm run prove` green (166 cards survivable, 24/24 fights). It proves the card guardians' echoes, not the Eco del Eclipse; the Eco's patterns are species-independent by construction (`echoMimic` is presentation only, never read by core) and tests/core/echo-mimic.test.ts plays its fight with every playable species and checks it identical.

## Progress
- Branch created from 76beb88.
- T1: 21 shiny sheets fetched (`--only=shiny` keeps the other metas byte-identical); the shiny roll is the pull's third RNG draw, so a seed's species are unchanged. typecheck and the full suite green.
- T2: skin flag `PlayerState.shiny` (cosmetic, set from `WorldOptions.shiny`); `hello.shiny`, roster `shiny`, state `sh` (outside the positional player array); PROTOCOL_VERSION 3 -> 4. Phantump's window: one «Shiny de X» on/off row per unlocked line; loadout: «Aspecto shiny» row in the moves step.

- T3: `WorldState.echoMimic` set at floor entry in app/game.ts from the session roster (solo: the player); renderer and HUD read it; the Mimikyu echo now wears its disguised sheet when copying Mimikyu, Busted Mimikyu only when it copies nobody.

## Verification
- `npm run typecheck`, `npx vitest run --testTimeout=30000 --maxWorkers=4`, `npm run build`, `npm run prove`: see the final report.
- Smoke screenshots (scratchpad): shiny-gacha-reveal.png, shiny-loadout.png, echo-zorua.png, echo-haxorus.png (Haxorus not owned in that save, so the picker fell back to Mimikyu: «Eco de Mimikyu»).

## Pending
- Shiny skins bought with shards (docs/gacha-roster-plan.md §5.1 mentions it): the game has no shards yet; left pending, not dropped.
- A skin toggled in Phantump's window while in a room reaches teammates on the next species pick (repick), not at once.

## Next step
Owner review; PR slicing is the user's decision.
