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
- 2026-10-26 (user, during T4): materials differ by difficulty. A material's tier is the difficulty its challenge was cleared on (Normal, Difícil, Pesadilla; Fácil pays coins only). Save shape `materials[lineRoot][tier]` (SAVE_VERSION stays 3; an early flat count reads as Normal). Stage 1 costs 3 Normal + 2 Difícil, the final stage 3 Difícil + 2 Pesadilla; a higher tier never stands in for a lower one, so the final evolution is impossible without clearing at Pesadilla. Coins unchanged; a clear pays 3 of its tier.
- 2026-10-26 (user, during T5): the gacha stall NPC is Mimikyu ("para que haga amigos"), pulls only; evolution is Phantump's own window. Audit follow-up: the Phantump is the existing Lago oracle (data/world.ts, same `TownNpc` and scene, so `opens: 'evolve'` costs nothing); its "Pronto" line (`world.npc.oracle.1` + `town.soon`) is replaced by evolve lines, `world.npc.oracle.2` is kept and `world.npc.oracle.1` stays in the catalogs unused for the lore pass.
- 2026-10-26 (T4): challenge dungeons are `CHALLENGES` in data/dungeons.ts (not in `DUNGEONS`, so the main select, shrine, sweeps and prove never list them); `dungeonById` resolves both. Each borrows a main dungeon's spawns, palette and music and one of its arenas as the boss: Abra/Crypt/Sableye, Piplup/Caves/Lanturn, Shinx/Forest/Trevenant, Axew/Swamp/Salazzle.
- 2026-10-26 (T3): committed before T2 because the gacha pool needs the species ids. Kits: one move per slot, all equipped, every damaging one at or under the starters' budget (`budgetRatio <= 1`). New: a `dragon` type (no enemy has it) and six Básico moves in `data/line-moves.ts` (Water Gun, Bubble Beam, Surf, Spark, Dragon Claw, Dragon Pulse). Evolved forms keep HP and speed; the stage bonus (+6 % / +12 % HP and damage) lives in `data/player-evolutions.ts`, capped at 15 % solo and 8 % in a party (`core/evolution.ts` `stageBonus`, applied in `createPlayer` and `playerStats`). Evolution keeps the Mejoras (moved to the new form).

## Delivery strategy
single branch `feat/gacha-evolutions`, one commit per task; forecast ~2,000–2,500 authored lines; PR slicing is the user's decision.

## Tasks
- [x] T1 Roster seam + save v3 (owned species, gacha pity, per-species stage, materials) + net fallback. Route: delegated.
- [x] T2 Gacha core + data + tests. Route: delegated.
- [x] T3 Species and evolution lines: sprites, kits, stage stats/moves, i18n, budget/ceiling tests. Route: delegated.
- [x] T4 Challenge dungeons + material reward (then tiered by difficulty). Route: delegated.
- [x] T5 UI: stall, evolve, loadout; GDD section. Route: delegated.

## Acceptance
- typecheck, `npx vitest run --testTimeout=30000`, build, `npm run prove` green.
- A fresh save can pull Abra, play it (solo and co-op), clear its challenge dungeon and evolve it to Kadabra, then Alakazam.

## Progress / evidence
- T1: `core/collection.ts` `rosterOf` (starters + owned); save v3 (`owned`, `materials`, `pity`; v1/v2 migrate; learned/ranks kept for every playable species); `loadSettings(..., roster)`, loadout picker and tutor window cycle the roster; `core/tutor.ts` keyed by `SpeciesId`; net decode maps an unknown/unplayable species in hello/start/lobby/state to Mimikyu. RED observed (save v3, roster, settings roster, protocol fallback), then GREEN. typecheck ok; vitest 209 files / 2529 tests ok; build ok; prove 166 cards survivable, 24/24 fights. Commit 6d0ff48.
- T3: 12 playable forms (Abra, Piplup, Shinx, Axew lines) with PMDCollab sprites (fetch-sprites: only additions, CREDITS regenerated), `PLAYER_EVOLUTIONS`, pure `canEvolve`/`evolve`/`stageBonus`/`lineOf`/`stageOf`, save keeps one form per line and materials by first form. RED observed (missing core/evolution), then GREEN. typecheck ok; vitest 210 files / 2569 tests ok (fairness, boosts, sprites and anims now also cover the 12 forms); build ok; prove 166 cards survivable, 24/24 fights (unchanged). Commit 202aded.
- T2: `data/gacha.ts` (100 P, rare 15 %, hard pity 10, duplicate refund 40; Piplup and Shinx common, Abra and Axew rare) and pure seeded `core/gacha.ts` `pull(collection, rng) -> { result, state, rng } | null` (null without the Pokémonedas; a duplicate is any owned form of the line). RED observed (missing core/gacha), then GREEN; the pity sweep (500 seeds x 200 pulls) fails when the pity is disabled (mutation checked). typecheck ok; vitest 211 files / 2577 tests ok; build ok; prove 166 cards survivable, 24/24 fights. Commit 0bac607.

- T4: `CHALLENGES` (4 dungeons: 3 generated floors + a borrowed arena boss), `core/challenge.ts` (`challengeOpen`, `openChallenges`, `challengeReward`), `earnChallengeReward` in app/save.ts called next to `earnCoins` in `onEnd` (every peer, own save, only if it owns the line); fairness-floors expected-level tests now also iterate the challenges. RED observed (missing core/challenge), then GREEN. typecheck ok; vitest 212 files / 2585 tests ok; build ok; prove 166 cards survivable, 24/24 fights. Commit 172c428.
- T4b (user scope change): tiered materials (`MaterialTier`, per-tier costs, per-tier `canEvolve`/`evolve`, reward of the run's difficulty, Easy pays none, flat v3 counts read as Normal). Tests updated first for the new shape; mutation checks: dropping the Easy guard fails challenge.test, summing tiers instead of per-tier fails evolution.test. typecheck ok; vitest 212 files / 2587 tests ok; build ok; prove 166 cards survivable, 24/24 fights. Commit 4d8858d.

- T5: `app/gacha.ts` (Mimikyu's stall: balance, price, rates per rarity, pulls to a sure rare, Pull row disabled without coins, 1.5 s reveal in the rarity colour that a tap or the next pull ends, duplicate refund in the text; saved per pull), `app/evolve.ts` (the Lago oracle Phantump: owned forms, next form, P and per-tier materials owned/needed named by difficulty, Evolve; saved per evolution; the selected species follows its evolution through `withSpecies`), town NPC `opens: 'gacha' | 'evolve'`, a `townWindow` overlay helper, "Retos" header group in the dungeon select (with the drop hint per difficulty) and the owned lines' challenges in the town exit (solo and room); the select now also shows when only challenges add a choice. Loadout already lists `rosterOf` (verified). Dev hooks `?screen=gacha|evolve&coins=N`. GDD §5 section with the real numbers and the three user decisions. RED observed for tests/app/gacha-stall.test.ts (missing module); tests/app/evolve.test.ts was written with the split after the Mimikyu/Phantump decision (no RED observed). Smoke (headless Firefox via tools/mobile/bidi.mjs, 390x844): fresh save, coins 3000, Pull -> reveal "El disfraz tiembla..." then "¡Piplup! (Común)", save owned [piplup], pity 1, coins 2900; evolve window with tiered materials -> Prinplup -> Empoleon, coins 1700, materials spent; no horizontal overflow, no tap target under 44 px; dungeon select shows "Retos | Reto de Piplup". typecheck ok; vitest 214 files / 2595 tests ok; build ok; prove 166 cards survivable, 24/24 fights. Commit ccfe4c9.

## Next step
Feature complete pending review: a real-play check of a challenge clear on Normal/Hard/Nightmare in co-op (peers own/not own the line), and the lore pass for `world.npc.oracle.1`.

## Open decisions
- Luxray and Empoleon unlock Maestro moves (Thunder, Ice Beam) by evolving, without the tutor's dungeon lock; evolving already costs a challenge dungeon's materials.
- Gacha and evolution numbers (rates, pity, refund, costs, +6 %/+12 % stage bonus, caps 15 %/8 %) are provisional.
