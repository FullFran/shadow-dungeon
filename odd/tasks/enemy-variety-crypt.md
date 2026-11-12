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

- [ ] T1 S1 S2 Model: `minDifficulty` (pools, Sima pool, floor events), Sima `bands` weights, `rare` flag. Route: inline.
- [ ] T2 S3 S4 S5 Archetypes: boomerang, support, mimic (+ thief-light dive and alarm for Murkrow/Klefki). Route: inline.
- [ ] T3 S4 S6 Species: Honedge, Bronzor, Yamask, Murkrow, Klefki with data, sprites, i18n, lore, pools, GDD. Route: inline.

## Parity checklist

- [ ] Every pool (DUNGEONS + CHALLENGES + Senda roads + Sima) validated by the model tests.
- [ ] Main Crypt pool.
- [ ] Challenges / Senda roads based on the Crypt.
- [ ] Sima strata (band weights).
- [ ] Floor events (nest, ambush, monster house, waves) respect `minDifficulty`.
- [ ] Solo and co-op (guest contacts, sync fields).
- [ ] Save/migrate/sanitize: enemies are not saved (no change expected; verify).
- [ ] Net protocol (enemy snapshot fields).
- [ ] i18n es/en (names, lore, cues).
- [ ] Sprites (normal; shiny see Pending).
- [ ] GDD bestiary (docs/gdd.md, Spanish).
- [ ] sim/prove harnesses green.
- [ ] Elites (`fittingTraits`) for the new kinds.

## Pending (not this batch)

- Misty Forest: Bellsprout, Sewaddle, Seedot, Morelull, Cottonee (sweep, tether, mimic swarm, pace support, push).
- Flooded Caves: Staryu, Barboach, Carvanha, Horsea, Corsola, Binacle (wall-bouncer, burrow, terrain swarm, ink, heal support, wall ambush).
- Toxic Swamp: Trubbish, Roselia, Toxel, Gulpin, Seviper.
- Sima abyss: Solrock + Lunatone, Unown, Natu, Elgyem, Sigilyph; abyss-only band cast.
- Research §4.3.4 (Sima elite traits on Hard/Nightmare) and §4.3.5 (one new species per Senda line of other biomes).

## Log

- L1 (2026-11-12, coordinator brief, verbatim excerpt): "enemy variety, first batch: the Crypt (branch `feat/enemy-variety-crypt`) ... Do in this order: the model changes (minDifficulty, per-stratum Sima weights, rare-spawn flag) with tests over every pool; then the three archetypes in the brain/enemies code; then the Crypt's 5 species with sprites (normal and shiny via tools/fetch-sprites.mjs the way the repo already does), names es/en, lore lines, threat costs, pools (main Crypt, challenge/Senda roads based on the Crypt, Sima strata where they fit), co-op sync, GDD bestiary entries. Other biomes stay listed as pending in the feature document."
