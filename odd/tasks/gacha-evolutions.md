# gacha-evolutions

## Objective
Players obtain new Pokémon from a simple gacha at Phantump's stall, evolve them with Pokémonedas plus a material, and earn that material in a short challenge dungeon per evolution line. Any owned species is playable everywhere.

## Problem
The roster is four hardcoded starters (`PLAYABLE_SPECIES`, `StarterId` in learnsets.ts and quiz.ts). The gacha is only a placeholder NPC (src/data/town.ts:204).

## Why
User request (2026-10-26): more Pokémon via gacha (Abra, Piplup...), evolutions and challenge dungeons to improve characters. User constraint: "debe ser simple y limpio".

## Scope (deliberately small)
- Roster seam: playable = starters + owned species from the save.
- Gacha: 100 P per pull, two rarities (common / rare), a hard pity for rare, a duplicate refunds Pokémonedas. Pure `pull(state, rng)`; one data table drives logic and UI.
- Species (bases in the gacha): Abra, Piplup, Shinx, Axew. Kits use only existing mechanics and the starters' budget.
- Evolutions: Abra→Kadabra→Alakazam, Piplup→Prinplup→Empoleon, Shinx→Luxio→Luxray, Axew→Fraxure→Haxorus. Each stage: own sprite, a fixed HP/damage bonus under a tested ceiling, one extra move unlocked. Cost: Pokémonedas + N line materials.
- Challenge dungeons: one data-driven short dungeon per line (3 floors + boss) reusing existing rooms/enemies, unlocked by owning the species, listed apart from the main dungeons; clearing it gives that line's material.
- UI: stall window (rates and pity visible, short skippable reveal), evolve option at the same NPC or a second NPC, loadout lists owned species.

Out of scope: banners, spark, shards, shiny skins, vitamins, mints, server-side gacha.

## Constraints
- Allowed surfaces: odd/tasks/gacha-evolutions.md, src/**, tests/**, tools/**, public/sprites/**, CREDITS.md, index.html, README.md, docs/gdd.md.
- Existing starters, default loadouts and golden digest unchanged; tests, `npm run prove`, architecture test green. Enemy fairness untouched.
- Net: unknown species from a peer falls back to a default instead of crashing.
- Keep it simple: no new abstractions beyond what these features need.
- One work-unit commit per task, Conventional Commits, explicit paths, no AI attribution; no push/merge.

## Decisions
- 2026-10-26 (user): progression counts everywhere, co-op included (bonus capped in co-op).
- 2026-10-26 (user): simple and clean; backend later in Go (PocketBase as a Go framework), so keep the gacha core pure and portable.
- 2026-10-26 (T1): the save keeps owned gacha species as their *current form* (`owned: ['kadabra']`); an evolution replaces the id, so the stage is implied by the form and can never disagree with it. Materials are keyed by the line's first form; `pity` counts pulls since the last rare. Starters are always owned and never stored.
- 2026-10-26 (T1): `STARTER_SPECIES` (the 4 starters) and `PLAYABLE_SPECIES` (starters + every gacha form). Starter-specific tests and `npm run prove` iterate the starters; generic ones (slots, boosts, upgrades, fairness, sprites) iterate every playable species.
- 2026-10-26 (T3): committed before T2 because the gacha pool needs the species ids. Kits: one move per slot, all equipped, every damaging one at or under the starters' budget (`budgetRatio <= 1`). New: a `dragon` type (no enemy has it) and six Básico moves in `data/line-moves.ts` (Water Gun, Bubble Beam, Surf, Spark, Dragon Claw, Dragon Pulse). Evolved forms keep HP and speed; the stage bonus (+6 % / +12 % HP and damage) lives in `data/player-evolutions.ts`, capped at 15 % solo and 8 % in a party (`core/evolution.ts` `stageBonus`, applied in `createPlayer` and `playerStats`). Evolution keeps the Mejoras (moved to the new form).

## Delivery strategy
single branch `feat/gacha-evolutions`, one commit per task; forecast ~2,000–2,500 authored lines; PR slicing is the user's decision.

## Tasks
- [x] T1 Roster seam + save v3 (owned species, gacha pity, per-species stage, materials) + net fallback. Route: delegated.
- [ ] T2 Gacha core + data + tests. Route: delegated.
- [x] T3 Species and evolution lines: sprites, kits, stage stats/moves, i18n, budget/ceiling tests. Route: delegated.
- [ ] T4 Challenge dungeons + material reward. Route: delegated.
- [ ] T5 UI: stall, evolve, loadout; GDD section. Route: delegated.

## Acceptance
- typecheck, `npx vitest run --testTimeout=30000`, build, `npm run prove` green.
- A fresh save can pull Abra, play it (solo and co-op), clear its challenge dungeon and evolve it to Kadabra, then Alakazam.

## Progress / evidence
- T1: `core/collection.ts` `rosterOf` (starters + owned); save v3 (`owned`, `materials`, `pity`; v1/v2 migrate; learned/ranks kept for every playable species); `loadSettings(..., roster)`, loadout picker and tutor window cycle the roster; `core/tutor.ts` keyed by `SpeciesId`; net decode maps an unknown/unplayable species in hello/start/lobby/state to Mimikyu. RED observed (save v3, roster, settings roster, protocol fallback), then GREEN. typecheck ok; vitest 209 files / 2529 tests ok; build ok; prove 166 cards survivable, 24/24 fights. Commit 6d0ff48.
- T3: 12 playable forms (Abra, Piplup, Shinx, Axew lines) with PMDCollab sprites (fetch-sprites: only additions, CREDITS regenerated), `PLAYER_EVOLUTIONS`, pure `canEvolve`/`evolve`/`stageBonus`/`lineOf`/`stageOf`, save keeps one form per line and materials by first form. RED observed (missing core/evolution), then GREEN. typecheck ok; vitest 210 files / 2569 tests ok (fairness, boosts, sprites and anims now also cover the 12 forms); build ok; prove 166 cards survivable, 24/24 fights (unchanged).

## Next step
T1–T3 in one writer pass (data and core), then T4–T5.
