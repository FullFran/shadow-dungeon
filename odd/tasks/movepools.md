# movepools

## Objective
Each starter (Mimikyu, Zorua, Litwick, Cubone) can learn the moves it learns in the original games, redesigned for real-time combat, bought from a move tutor NPC for Pokémonedas, together with "Mejoras" (ranks) of its starting moves, so that a good late build resembles the species' competitive build.

## Problem
Every starter has a fixed 7-move movepool (two moves per slot kind, one boost). There is nothing to spend Pokémonedas on beyond Poochyena's five upgrades, and no way to build towards the sets players know from competitive play.

## Why
User request (2026-10-26, priority): many more attacks, the canon learnsets, a tutor NPC, stronger moves and stronger versions of the starting ones.

## Scope
- T1 Learnsets: PokeAPI learnsets (level-up, TM/TR, tutor, egg) of the four starters; ~20–30 relevant moves per species; each designed for our combat (slot, shape, type, power, stamina, cooldown, timings, effects, VFX colour, juice); competitive references with URLs.
- T2 Moves as data + the few new generic effects (drain, recoil, DoT burn/poison, crit bonus, HP cost, lingering zone, homing, focus buff), tests per effect, a per-slot damage budget test, balance harness.
- T3 Move tutor NPC (Smeargle, sprites from PMDCollab SpriteCollab) in the Refugio: MD-style shop window per species (price tiers; starting moves free and known), Mejoras (2 ranks) of starting moves, save facade v2 (versioned migrate), loadout shows only learned moves per slot with a slot filter, and a recommended competitive build hint.
- T4 Docs: GDD "Movimientos y maestro" (Spanish) with per-species tables, README, balance before/after.

## Constraints
- Allowed surfaces: odd/tasks/movepools.md, src/**, tests/**, public/sprites/**, tools/**, CREDITS.md, index.html, README.md, docs/gdd.md, reports/**.
- Another writer edits the shrine (it reuses the loadout screen with a parametrised confirm) and net code: loadout changes additive, existing `LoadoutOptions`/`loadoutScreen` API kept.
- Default loadouts unchanged (golden digest unchanged); every existing test, `npm run prove` CI subset and the architecture test stay green.
- One work-unit commit per task, Conventional Commits, explicit paths, no AI attribution; no push/merge.
- PokeSurvivor (PolyForm Noncommercial): ideas and mechanics only, no code or data copied.

## Delivery strategy
ask-on-risk; forecast ~2,000 authored changed lines (mostly data + i18n). One branch `feat/movepools`, one commit per task; slicing into PRs is the user's decision.

## Tasks
- [x] T1 Learnsets and design (route: inline in this bounded writer; research done with PokeAPI + data.pkmn.cc).
- [ ] T2 Moves as data + new effects + tests + balance.
- [ ] T3 Move tutor NPC + save v2 + loadout filter + build hint.
- [ ] T4 Docs + balance before/after + screenshots.

## Acceptance
- `npm test`, `npm run build` green; architecture test green; golden digest unchanged.
- Every new move: valid slot/kind, in exactly the species movepools that learn it in canon, i18n es/en, an animation entry.
- New fast/heavy moves stay inside the per-slot damage budget of the starting moves (test).
- Tutor purchases persist (save v2), a v1 save migrates with nothing learned; unlearned moves never reach a run.

## Checks
npm test, npm run build, npm run balance -- --quick --slots, npm run prove (CI subset via tests/sim).

## Sources
- Learnsets: https://pokeapi.co/api/v2/pokemon/mimikyu-disguised, /zorua, /litwick, /cubone (all version groups, all learn methods); move data: https://pokeapi.co/api/v2/move/{id}.
- Competitive sets (Smogon analyses as exported by pkmn): https://data.pkmn.cc/sets/gen9.json, gen8.json, gen7.json. Smogon dex pages: https://www.smogon.com/dex/sv/pokemon/mimikyu/, https://www.smogon.com/dex/sm/pokemon/zorua/, https://www.smogon.com/dex/sv/pokemon/chandelure/, https://www.smogon.com/dex/sm/pokemon/cubone/.
  - Mimikyu (gen9 OU/UU, gen7 OU): Swords Dance / Play Rough / Shadow Claw / Shadow Sneak; gen8 BSS: … / Phantom Force; RU: Drain Punch.
  - Zorua (gen7 LC): Night Daze | Dark Pulse / Extrasensory / Nasty Plot / Knock Off | U-turn; gen9 LC Scarf: Knock Off / U-turn / Extrasensory / Sucker Punch. Zoroark (gen7 UU NP): Nasty Plot / Dark Pulse / Focus Blast / Sludge Bomb.
  - Litwick line (Lampent gen9 NFE, Chandelure gen9 RU/NU): Calm Mind / Fire Blast | Flamethrower / Shadow Ball / Energy Ball.
  - Cubone (gen7 LC): Bonemerang / Knock Off / Rock Slide / Fire Punch; Marowak (gen8 ZU): Swords Dance / Bonemerang / Earthquake / Knock Off.

## Borrowed ideas (PokeSurvivor, mechanics only)
Read ~/fullfran/game-analysis/notes/pokesurvivor-mechanics.md: of its ~23 move kinds we borrow the *ground zone* (a lingering area that re-hits on a period: Fire Spin, Smog) and *homing* (a shot that bends towards the nearest enemy: Swift, Shadow Ball's cousin Poltergeist does not); its *move evolution* ("Name +" at max level) inspired the Mejoras ranks (rank 2 shows as "+"), and its Kecleon TM shop inspired a tutor that sells moves for coins. Chain lightning, orbitals and turrets were not taken (no fitting canon move in these learnsets, or too far from the souls feel).

## Progress
- Branch feat/movepools from main fcdd3ba. Baseline: npm test 187 files / 2070 tests passed; `npm run balance -- --quick --slots` → 60 runs, 72 arena fights, 0 failures, 42 warnings, 71 passes (saved /tmp/movepools/balance-before.md).
- T1: learnsets fetched (88 / 84 / 72 / 96 distinct moves for Mimikyu / Zorua / Litwick / Cubone), move data for 59 new moves from PokeAPI; design tables are in docs/gdd.md "Movimientos y maestro" (T4) and the data in src/data/tutor-moves.ts (T2). Shadow Force stays on Mimikyu although canon Mimikyu does not learn it (it is an existing default-pool move; removing it would break saves).

## Next step
T2.
