# Bullet art: one visual language per type, hitbox-honest core, one baked atlas

Objective: every moving enemy shot gets its type's pixel-art bullet from one baked atlas, with a bright core exactly the size of its hitbox. Branch `feat/bullet-art` (from origin/main + `docs/boss-pattern-research`). Delivery: work-unit commits, no push. Runner: `npx vitest run`.

## Specs

- S1 Design source: `docs/research/boss-patterns.md` §5 (bullet sprite redesign) and `docs/pixelfx-vfx.md` / `odd/tasks/pixelfx-vfx.md` pending streak types (Bug/Ghost/Grass/Flying/Steel); "10 types share one tinted plasma shot with no hitbox cue".
- S2 Owner-approved: "3(a) the bright core is exactly the hitbox, the glow is harmless; 5(c) all types in one pass with one baked atlas."
- S3 "a visual language per Pokémon type (shape, colour, glow), three size classes plus a "hanging" state, a minimum 4 px core on phones".
- S4 "one prebaked atlas (no per-frame cost growth; measure frame time with ?perf=1 before/after)".
- S5 "drawing that reads the projectile's real radius so the core matches the hitbox (test: for every type and size class the drawn core radius equals the hitbox radius)".
- S6 "enemy vs player shots still distinguishable, telegraphs unchanged".
- S7 "Original pixel art (repo skill .claude/skills/pixel-craft/SKILL.md)."
- S8 "Extend the existing effects gallery (tools/fx-gallery.html) or add a bullets page so the owner can review every type side by side, and report its URL path."
- S9 "Another worker adds new bullet kinematics in parallel (src/core); you own rendering in src/adapters and assets only."

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S2 S3 S5 S7 | inline | done | 5afd938; RED: module missing (import fails), GREEN 13/13 `tests/adapters/bullet-art.test.ts` |
| T2 | S4 S5 S6 | inline | done | f679f39; move-feel test updated (moving shots → null look) |
| T3 | S8 | inline | done | c2a8d85; `/tools/bullet-gallery.html` |
| T4 | S4 | inline | done | L4 |
| T5 | all | inline | done | GDD «Balas enemigas», pixelfx pending item closed, gate L5 |

Route evidence: no Writer trigger (one unit of behaviour, single owner); tasks run inline.

## Parity checklist

- [x] Every `PokemonType` (18) has a bullet shape and palette (test iterates `POKEMON_TYPES`).
- [x] Every size class S/M/L and the hanging state, for every type (test iterates types × classes).
- [x] Every enemy shot source: dungeon enemies, card bosses (every dungeon boss, hosted cards), Senda bosses, heralds (Sima), shrine; all go through `enemyShot` in the renderer (one path: every enemy projectile is spawned by `core/brain.ts spawnShot` or rebuilt from the host snapshot in `core/sync.ts`).
- [x] Every enemy shot radius in the data reads ≥ 4 px on a 568×320 phone (test scans every enemy behaviour).
- [x] Solo and co-op guest: guests draw host snapshots through the same path (no protocol change).
- [x] Player shots unchanged (their pixelfx looks), so enemy and player shots stay distinguishable.
- [x] Telegraphs unchanged (`danmaku-vfx.ts`, `herald-vfx.ts` untouched).
- [x] Save/migrate/sanitize, net protocol, i18n: not touched (render-only; no new player-facing text).
- [x] GDD (`docs/gdd.md`) describes the bullet language.
- [x] sim/prove: unchanged engine; `npm run prove`: 166 cards (166 survivable), 24/24 solver fights cleared.

## Log

- L1 (2026-11-12, coordinator brief, verbatim task): "Task: bullet art redesign for every type in one pass (branch `feat/bullet-art`) ... Do: a visual language per Pokémon type (shape, colour, glow), three size classes plus a "hanging" state, a minimum 4 px core on phones, one prebaked atlas (no per-frame cost growth; measure frame time with ?perf=1 before/after), drawing that reads the projectile's real radius so the core matches the hitbox (test: for every type and size class the drawn core radius equals the hitbox radius), enemy vs player shots still distinguishable, telegraphs unchanged. Original pixel art (repo skill .claude/skills/pixel-craft/SKILL.md). Extend the existing effects gallery (tools/fx-gallery.html) or add a bullets page so the owner can review every type side by side, and report its URL path. Another worker adds new bullet kinematics in parallel (src/core); you own rendering in src/adapters and assets only."
- L2 Baseline perf: the bench `boss-card` scene shows 0 bullets (Decidueye's roost only wakes the boss when the player walks in). Added `card-decidueye` and `card-lanturn` scenes (`?spawn=<boss>&card=N`, Nightmare): 87 and 68 bullets. Before (this machine, Firefox headless, dpr 3), render p50/p95 ms: decidueye landscape 2.84/5.80, portrait 1.52/3.32; lanturn landscape 2.94/5.86, portrait 2.66/5.42.
- L3 Hanging: core has no hold field yet (E5 is not in the approved first batch). The renderer marks a shot as hanging when it was seen moving and is now still; an optional hold timer is read through one seam (`hangProgress`).
- L4 Perf after (same bench, same machine): render p50/p95 ms decidueye landscape 2.68/4.40 (before 2.84/5.80), portrait 1.74/2.68 (1.52/3.32); lanturn landscape 2.50/4.10 (2.94/5.86), portrait 2.14/3.04 (2.66/5.42): within noise, no growth. Gallery `?stress=160` (draw loop only, Firefox headless): atlas p50 1.44 ms / p95 2.30 ms vs the hand-drawn orb 3.86 / 5.74 ms. Baking every type at radii 4, 6, 9 (54 blocks, 2 pages of 1024²) took ~250 ms in total; in a fight only its types are baked, on first sight.
- L5 Visual pass: first bake had a near-white core that hid the types; core is now the type glow lightened 45 %, the light rim only on the lit side, hanging ring white/dark ticks.
- L6 Gate: typecheck exit 0; vitest 425 files / 6026 tests passed; build exit 0; prove 166/166 survivable, 24/24 cleared.
