# Enemy shots as learnable moves (issue #67)

Objective: every moving enemy shot names a learnable `MoveId` and is drawn exactly as the player's use of that move (`projectileCue(move.type, move.id)`), with the honest hitbox core on top; patterns, timings, power, speed and radii unchanged. Branch `feat/enemy-shots-as-moves` (from origin/main 8223b60a). Delivery: work-unit commits, no push (owner publishes). Runner: `npx vitest run --testTimeout=30000`.

## Specs

- S1 Owner (2026-11-12): "los patrones de las cartas no cambian nada!!! solo cambia el sprite del proyectil!!! por ejemplo me gustaba mucho que antes los de fuego fuesen las mismas llamas que las nuestras"
- S2 Owner, Design note 2 (2026-11-13): "seria chulisimo si fuesen sprites de ataques que los pokemons puedan aprender!" — "**every enemy shot is a move a Pokémon can learn**, drawn exactly as when the player uses it. An enemy Ember is our Ember; a Lanturn bubble ring is made of Bubble Beam; a Nihilego downpour is Sludge Bomb drops; a Gengar curl is Shadow Ball."
- S3 Data: "enemy shots carry a `move: MoveId` (a learnable move: `src/data/moves.ts` or `src/data/line-moves.ts`). Its type comes from the move, so the two cannot disagree. Every regular enemy attack, every spell card shot, Senda bosses, Sima heralds and echoes, and the Shrine." AC: "Every enemy shot definition names a `MoveId`; a test iterates every enemy, every spell card on every tier, every Senda boss, herald generator output and Shrine fight, and fails on a shot without a move."
- S4 Draw: "the renderer draws an enemy shot with `projectileCue(move.type, move.id)`, the same baked effect as the player's, rotated to its velocity, at the shot's radius. The hitbox stays readable (core overlay sized to the hitbox, or the effect scaled so its solid part matches; to be measured on the bullet gallery page)." AC: "An enemy shot and the player's use of the same move draw the same baked effect (test against `projectileCue`)."
- S5 Choice per card: "each card picks moves that fit its boss (its learnset first, `src/data/learnsets.ts`, then same-type moves), and a card named after a move uses that move."
- S6 Wire: "shots on the net carry the move id instead of only the type (protocol version bump, guest draws the same look)." AC: "Net protocol carries the move; co-op guests see the same look."
- S7 Fallback: "a move whose effect does not read as a dense danmaku bullet gets a size-class variant of its own effect, never the anonymous orb; listed here."
- S8 AC: "Bullet gallery page shows each enemy shot next to the player's move."
- S9 AC: "Hitbox still readable (core at least 4 px on the smallest phone) and no frame-time regression on the mobile bench card scenes."
- S10 AC: "GDD «Balas enemigas», `odd/tasks/bullet-art.md` and i18n (if a card is renamed after its move) updated."
- S11 Owner decision (2026-11-24, via coordinator): "Owner chose (a): keep the Flying damage on litwick-drifblim and axew-dragonite shots and draw them as Swift (normal, the star shot). Record it as the one listed exception to 'type comes from the move' (feature doc, GDD, bullet-art.md), with a test that pins it so it cannot spread silently. Ground-born hazards (spore clouds, puddles, roots, landing embers): keep their looks and list them as pending in the report, as you proposed."
- S12 Brief: gate `npm run typecheck`, `npx vitest run --testTimeout=30000`, `npm run build`, `npm run prove`, `npm run test:proofs` all green; bench before/after numbers. Do NOT push, open a PR, deploy, touch `preprod`/`main`, or edit the issue.

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S3 S5 S11 | inline | done | `tests/data/enemy-shot-moves.test.ts` RED (3 failed) then GREEN (4 passed); `MovingShotDef.move` required by the type; defaults per type in `src/data/shot-moves.ts`; Easy golden digest unchanged with `shotMove` projected out |
| T2 | S3 S6 | inline | done | `tests/net/shot-move-wire.test.ts` RED (2 failed) then GREEN; snapshot `shotMove` (enemy shots), trailing wire slot after the curse, `PROTOCOL_VERSION` 6 → 7; `tests/net` 346 passed |
| T3 | S4 S7 S9 | inline | done | `tests/adapters/enemy-shot-look.test.ts` (projectile move = `projectileCue`, other moves = `moveCue`, held frames never blank, held art centred); RED 3 failed then GREEN 7; atlas core cell (`paintCore`, `drawCore` at `CORE_OVER_ART_ALPHA` 0.5); renderer `moveShot`; `tests/adapters` + `tests/ui` 1785 passed; typecheck clean |
| T4 | S8 | inline | done | `tools/bullet-gallery.html` section «Disparos enemigos como movimientos»: every move an enemy shot is drawn as (24), the enemy shot through the renderer's path at its radii next to the player's use, with damage types and sources; loaded headless in Firefox, all 24 baked, no errors |
| T5 | S5 S10 S11 | inline | done | GDD «Balas enemigas como movimientos» + protocol 7 note; bullet-art.md L10; S5 named cards (`src/data/story/card-moves.ts`, test RED 2 failed then GREEN) |
| T6 | S9 S12 | inline | done | typecheck 0; vitest 459 files / 6555 passed; build 0; prove 217/217 cards, 24/24 fights; test:proofs 13 files / 1713 passed; bench L8 |

Route evidence: one behaviour with one owner and the dispatch forbids helpers; no Writer trigger, all inline. Forecast ~700 authored lines (data edits are many one-word additions).

## Parity checklist

- [x] Every regular enemy of every dungeon (main dungeons, challenges) and tier: moving shots name a move (test iterates `SPECIES` × `DIFFICULTIES` through `behaviourFor` and `behaviourAt` with a 4-player party; `tests/data/enemy-shot-moves.test.ts`).
- [x] Every card boss, every spell card on every tier (Aegislash, Decidueye, Sableye, Trevenant, Lanturn, Dhelmise, Salazzle, Nihilego, old and new cards): same walk, sources checked by name.
- [x] Every Senda boss (`STORY_FIGHTS`), Flying exception pinned to Drifblim and Dragonite; cards named after a move use it (`tests/data/story-card-moves.test.ts`, 78 cards; 42 not drawable listed as pending).
- [x] Sima: herald generator output (seeds × tiers), Eclipse echo, evolved (gacha line) enemies.
- [x] Shrine: its reflections, gauntlet stops and heralds walked (`shrine`, `shrine-herald` sources).
- [x] Shadow (player-move mirror) shots carry the move they copy (`src/core/shadow.ts`).
- [x] Solo and co-op: snapshot + net protocol carry the move (protocol 7, `tests/net/shot-move-wire.test.ts`); the guest's renderer reads the same `shotMove`.
- [x] Hitbox core ≥ 4 px on the smallest phone (radii unchanged, `tests/adapters/bullet-art.test.ts` «a core of at least 4 px»); core cell = hitbox (`paintCore` tests).
- [x] Bullet gallery page (`/tools/bullet-gallery.html`, section «Disparos enemigos como movimientos»).
- [x] GDD «Balas enemigas» + protocol note, `odd/tasks/bullet-art.md` L10; i18n untouched (no card renamed).
- [x] sim/prove harnesses unchanged in outcome (render-only plus a data field): prove 217/217 survivable, 24/24 solver fights; digest unchanged.
- [x] Save/migrate/sanitize: the profile save holds no shots; the reload-resume snapshot stores the world whole (`shotMove` included) and discards a snapshot from another build (`src/app/run-resume.ts`), so no migration.

## Log

- L1 (2026-11-24, coordinator brief, verbatim task line): "Task: implement GitHub issue #67 of FullFran/shadow-dungeon (Mazmorra Sombría): "feat(vfx): enemy shots look like the player's moves again". ... Patterns, timings, power, speed and hitbox radii DO NOT change; only the look (and the move id the shot carries)."
- L2 Exploration: player shots draw `projectileCue(type, moveId)` through `fx.drawLoop` (renderer `bakedShot`); enemy shots draw the bullet atlas (renderer `enemyShot`). No Flying move exists (0 of 120 moves); dark, fairy, fighting, bug and rock have only melee/dash moves (S7 fallback). Ground's Earth Power draws as eruptions and Bonemerang as a hand-drawn bone. Shot types in use: all 18.
- L3 Baseline bench (Firefox headless, this machine, `node tools/mobile/bench.mjs --only=boss-card,card-decidueye,card-lanturn --seconds=8`), render p50/p95 ms: card-decidueye landscape 3.64/5.16, portrait 2.38/3.64; card-lanturn landscape 3.00/4.38, portrait 2.20/3.48 (47 and 58 bullets). boss-card shows 0 bullets (not usable).
- L4 (2026-11-24) Asked the coordinator about Flying; answer recorded as S11.
- L5 (2026-11-25) T1: the Easy golden digest (tests/core/difficulty-tiers.test.ts) moved only by the new `shotMove` field; projected out like `referenceLevel`, it gives '5011c078' again (play unchanged).
- L6 (2026-11-25) T3, measured on the bullet gallery: a move whose own effect is a swing, blow or burst flew blank between flashes when looped as a shot, so it is held (`heldFrames`: only frames at least 60% of the fullest, centred on the shot, larger side = the shot's size class). Held moves (S7 list): x-scissor (double-slash), shadow-sneak (thrust), iron-head (blunt-hit), focus-punch (crit-hit), dark-pulse (plasma-explosion), dazzling-gleam (sunburst), rock-slide (earth-spike). An opaque hitbox-sized core hid the art's head (the fireball read as a white ball with a trail), so the core over art is drawn at alpha 0.5: the art shows through, the outlined edge still marks the hitbox. Fallback order: move art + core, then the type's atlas bullet while the art bakes, then the plain orb.
- L7 (2026-11-25) S5 audit: 78 Senda cards are named after a learnable move («Signo <move> «...»»); they now draw their shots of that move's type as it (`src/data/story/card-moves.ts`, applied in kit.ts `fightOf`; damage types untouched). 42 named cards cannot be drawn as their move without changing play (status moves, a move of a type the card never fires, Bonemerang's hand-drawn bone): listed in `tests/data/story-card-moves.test.ts` `NOT_DRAWN`, pending the owner (rename or keep). Held moves grew to 28 (claws, fangs, punches, slashes, quakes); held art now spans `HELD_SCALE` = 2 times a flying shot's box (fx/director.ts `enemyShotSize`), as swing art is sparse. Outrage (`melee/heavy-cleave`, a thin dark arc) still reads faint at shot size: pending visual item.
- L8 (2026-11-25) Bench after (same command, two passes), frame p50/p95 ms unchanged (17.06/17.10, vsync-bound; lanturn 0.00/17.08 as before). Render p50/p95: card-decidueye landscape 4.26/5.94 and 4.24/6.00 (before 3.64/5.16), portrait 2.66/3.34 and 2.62/3.22 (before 2.38/3.64); card-lanturn landscape 3.06/4.82 and 3.08/4.86 (before 3.00/4.38), portrait 1.94/4.14 and 1.94/4.12 (before 2.20/3.48). Decidueye's arrows are Shadow Sneak, a held move: +0.6 ms render p50 in landscape, reproducible, well inside the 16.7 ms frame. boss-card (0 bullets) moved 5.62 -> 3.90 between runs, so single-run noise is of that order.
