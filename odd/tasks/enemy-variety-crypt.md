# Enemy variety, first batch: the Crypt

Objective: spawn-model gates (difficulty, Sima strata, rare spawns), three new behaviour archetypes (boomerang, mimic, support) and the Crypt's five new species, woven into every pool and system they concern.
Branch `feat/enemy-variety-crypt` (from origin/main 5c76039 + `docs/enemy-variety-research`). Delivery: work-unit commits, no push. Runner: `npx vitest run`.

## Specs

- S1 Model (owner option 1(a)): "keep weighted pools + role budget AND add per-entry difficulty gates (minDifficulty) and per-stratum Sima pools". Plus the "rare-spawn flag" (research §4.3.3: weight about 0.2 and an arrival cue). Tests iterate every pool.
- S2 Difficulty (2(a)): "Hard/Nightmare add 1-2 species per biome via minDifficulty".
- S3 Support (3(a)): "introduce the support role, one support species per biome" (this batch: the Crypt's).
- S4 First batch (4(a)): "the Crypt's 5 proposed species + the boomerang, mimic and support archetypes" (research §4.2 Crypt table: Honedge, Bronzor, Yamask, Murkrow, Klefki).
- S5 Player-control effects (5(a)): "allowed, always telegraphed, the harshest only on Hard+".
- S6 Per species: "sprites (normal and shiny via tools/fetch-sprites.mjs the way the repo already does), names es/en, lore lines, threat costs, pools (main Crypt, challenge/Senda roads based on the Crypt, Sima strata where they fit), co-op sync, GDD bestiary entries".
- S7 "Other biomes stay listed as pending in the feature document."

## Tasks

- [x] T1 S1 S2 Model: `minDifficulty` (pools, Sima pool, floor events), Sima `bands` weights, `rare` flag. Route: inline (no writer reason). Commit `933b311`. RED: tests/core/spawn-gates.test.ts 9 failing before the code; GREEN after.
- [x] T2 S3 S4 S5 Archetypes: boomerang (Honedge), support (Bronzor), mimic (Yamask's disguise + cursed shot), alarm (Klefki), diver (Murkrow), species registration, sprites, names. Route: inline. Commit `c1889f1`. Tests tests/core/crypt-enemies.test.ts written right after the code (no RED observed for T2; 5 of 12 failed on first run and drove two real fixes: ward armor did not travel without an elite trait, a cut channel restarted at once).
- [x] T3 S4 S6 Species in pools (Crypt, Crypt-based Senda roads, Sima Crypt stratum and squads), rare arrival cue, lore, GDD. Route: inline. Commit `6d811d0`.

## Parity checklist

- [x] Every pool (DUNGEONS + CHALLENGES + Senda roads + tutorial + Sima) validated by tests/core/spawn-gates.test.ts (`it.each` over every pool and tier).
- [x] Main Crypt pool: all five (`CRYPT_SPAWNS`; Murkrow normal+, Klefki hard+ and rare).
- [x] Challenges / Senda roads based on the Crypt: `ROAD_EXTRAS.crypt` (Honedge, Yamask, Bronzor) on every road whose base is the Crypt; test iterates CHALLENGES + SENDA_ROADS (palette = Crypt ⇔ has them). Challenge 70 % neutral test still green.
- [x] Sima strata: every main-dungeon species carries its bands (test iterates ENDLESS_POOL against DUNGEONS); each stratum ≥ 40 % own biome mid-band; Crypt wave in the Crypt stratum; squads Bronzor+Golett (6), Honedge+Dusclops (9).
- [x] Floor events respect `minDifficulty` (`floorEventPool(def, floor, tier)`, test over every pool and the Sima).
- [x] Solo and co-op: guest contacts for spin and dive (Murkrow steals on the guest's own player), ward armor and curse on the wire (crypt-enemies tests round-trip through `encodeMessage`/`decodeMessage`), named pass resets guest contact (`sameAttack` compares `ai.attack`).
- [x] Save/migrate/sanitize: no change; enemies are not saved and `src/app/save.ts` holds no run/player state (`cursedMs` is transient like `stolen`).
- [x] Net protocol: projectile gains an optional trailing `curseMs`; the elite slot carries `*` armor without a trait. Older peers ignore the extra slot.
- [x] i18n es/en: `species.*` x5, `dungeon.crypt.lore.3`, `floor.rare.klefki` (content, i18n and guardians tests green).
- [x] Sprites normal via `node tools/fetch-sprites.mjs --add=honedge,bronzor,yamask,murkrow,klefki` (CREDITS regenerated). Shiny: see Pending.
- [x] GDD (§3 Encuentros con sentido, Cripta bestiary table, Sima enemies and squads, challenges).
- [x] `npm run prove`: 166/166 cards survivable, 24/24 fights cleared.
- [x] Elites: new kinds draw from the common traits (`fittingTraits`; volley stays caster-only, Yamask is a caster).
- [x] Tutorial: unchanged on purpose (its pool is its own teaching pair).

## Pending (not this batch)

- Shiny sheets for the five: the repo fetches shiny only for playable species (`PLAYABLE` in tools/fetch-sprites.mjs) and no enemy ever wears one, so following "the way the repo already does" they were not fetched. Listed, not dropped: needs the owner's call if enemy shinies are wanted.
- Research's Murkrow "steals coins from the richest player": runs have no coin pickups, so it borrows the last held item (Sableye's rule, core/stolen.ts) from whoever it hits.
- Encounters table in GDD §3 (enemies/XP per floor "ahora") not re-measured; the encounters test bounds hold (Sima XP 807 vs 924 baseline, within 15 %).

- Misty Forest: Bellsprout, Sewaddle, Seedot, Morelull, Cottonee (sweep, tether, mimic swarm, pace support, push).
- Flooded Caves: Staryu, Barboach, Carvanha, Horsea, Corsola, Binacle (wall-bouncer, burrow, terrain swarm, ink, heal support, wall ambush).
- Toxic Swamp: Trubbish, Roselia, Toxel, Gulpin, Seviper.
- Sima abyss: Solrock + Lunatone, Unown, Natu, Elgyem, Sigilyph; abyss-only band cast.
- Research §4.3.4 (Sima elite traits on Hard/Nightmare) and §4.3.5 (one new species per Senda line of other biomes).

## Log

- L1 (2026-11-12, coordinator brief, verbatim excerpt): "enemy variety, first batch: the Crypt (branch `feat/enemy-variety-crypt`) ... Do in this order: the model changes (minDifficulty, per-stratum Sima weights, rare-spawn flag) with tests over every pool; then the three archetypes in the brain/enemies code; then the Crypt's 5 species with sprites (normal and shiny via tools/fetch-sprites.mjs the way the repo already does), names es/en, lore lines, threat costs, pools (main Crypt, challenge/Senda roads based on the Crypt, Sima strata where they fit), co-op sync, GDD bestiary entries. Other biomes stay listed as pending in the feature document."
- L2 (2026-11-12) Decision: Klefki gated to Hard+ (and rare) so the Crypt meets exactly one more species on Hard/Nightmare than on Normal (S2), Murkrow normal+ per the research table.
- L3 (2026-11-12) Sima XP per floor fell to 773 with the first squads (Bronzor+Pawniard+Honedge, Honedge+Yamask); squads changed to Bronzor+Golett and Honedge+Dusclops and new Sima weights halved: 807 (bound 785). Band factors 3/0.5 kept (2.5/0.5 and 2/0.6 changed nothing material).
- L4 (2026-11-12) Golden Easy digest re-recorded on purpose ('d0d94354' → '6434cee9'): the Crypt pool changed; the suite was green with the old digest at `c1889f1`.
- L5 (2026-11-12) Checks: typecheck clean; full vitest 426 files / 6100 tests passed (one `onTaskUpdate` timeout notice, every test passed); build ok; prove 166/166, 24/24.
