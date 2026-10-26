# roster-parity

## Objective
Every playable species gets what the others have: the starters evolve like the gacha lines (Mimikyu awakens instead) with their own challenge dungeons, and the gacha lines get full movepools like the starters (canon learnsets, tutor offers, tiers, rank effects, builds). A challenge is the line's own trial, playable only with a form of its line, reached from one shared challenges menu.

## Problem
User feedback (2026-10-26):
1. "A los Pokémon nuevos no les has puesto todos los movimientos como a los que ya estaban": the 12 gacha forms have one move per slot plus a stage move, and no tutor offer.
2. "No has añadido evoluciones de los Pokémon antiguos, solo de los nuevos": the starters have no player evolution and no challenge dungeon.
3. (via coordinator) A challenge dungeon can only be played with a form of its line, solo and co-op.
4. (via coordinator) Mimikyu does not evolve but awakens twice, like a three-form line ("Despertar" / "Awaken").
5. (via coordinator) With 8 challenges the dungeon select is crowded: one "Desafíos" entry opens a shared challenges menu, also reachable from Phantump's window.
6. (via coordinator) Each challenge is the species' own trial (lore per floor, boss and victory lines), with a mixed enemy pool its line can hurt.

## Why
Parity with existing content (repo CLAUDE.md "Integration rule"). User constraint: simple and clean.

## Scope
- Starter evolutions: Zorua -> Zoroark, Litwick -> Lampent -> Chandelure, Cubone -> Marowak (Kanto, 0105). Same rules as the gacha lines: P + tiered materials (stage 1: 3 Normal + 2 Difícil; final: 3 Difícil + 2 Pesadilla; a single-step line's only evolution is the final one), stage bonus under the existing caps, one stage move each, Mejoras and bought moves carried over.
- Mimikyu's awakening: two steps at the same prices and bonuses, same id and sprite, each makes a Maestro move known; stage stored in the save (`awakened`).
- One challenge per line (8): own lore, mixed enemy pool, a boss the line can hurt (the gacha lines keep the four mid-bosses, the starters face the four guardians).
- Challenge entry rule: only a form of the line may play it (solo: the loadout for a challenge lists only the line's forms and the challenges menu greys out the others; co-op: the host cannot start it while a participant plays another line, and a dialog names who).
- Challenges menu: one "Desafíos" entry in the dungeon select and the town exit, plus a button in Phantump's window; one shared module.
- Save: an evolved starter's current form is stored in `owned` (it replaces the starter in the roster), its line's materials under the starter's id, Mimikyu's steps in `awakened`. No SAVE_VERSION bump (optional fields only).
- Gacha lines' full movepools: canon learnsets (PokeAPI, latest version group with data), tutor offers (tiers, prices, Maestro locks), rank effects for every move, recommended and full builds; evolved stages share the line's movepool.

## Constraints
- Allowed surfaces: odd/tasks/roster-parity.md, CLAUDE.md, src/**, tests/**, tools/**, public/sprites/**, CREDITS.md, docs/gdd.md.
- Starters' base data, default loadouts, golden digest and `npm run prove` (iterates `STARTER_SPECIES` base forms) unchanged.
- Another agent works on `feat/coop-flow` (net/core/app co-op flow): net touched minimally (no protocol change; the start check reads the existing roster species).
- English code/commits; i18n es (peninsular) / en, no em dashes. One Conventional Commit per task, explicit paths, no AI attribution, no push/merge.
- Out of this feature (coordinator): shiny skins and the Sima echo change (a later feature).

## Delivery strategy
single branch `feat/roster-parity` from main 245f309, one commit per task; forecast ~2,500-3,000 authored lines (mostly data and i18n; the sprite sheets and sprite-meta are generated); PR slicing is the user's decision.

## Tasks
- [x] T1 Starter evolutions, Mimikyu's awakening (core + save + run), 8 challenges as data (lore, mixed pools, bosses), challenge entry rule (core), CLAUDE.md, GDD. Route: inline in this bounded writer (the parent delegated the feature).
- [ ] T2 UI: shared challenges menu (dungeon select, town exit, Phantump's window), Phantump's window lists starters and awakening, challenge loadout filter, co-op start block, victory line. Route: inline.
- [ ] T3 Gacha lines' full movepools (learnsets, offers, new moves, rank effects, builds, GDD tables). Route: inline.

## Acceptance
- typecheck, `npx vitest run --testTimeout=30000`, build, `npm run prove` green.
- Zorua/Litwick/Cubone can evolve and Mimikyu awaken with their challenge's materials; the evolved form replaces the starter in the roster and keeps Mejoras and bought moves.
- A challenge cannot be entered with a species outside its line (solo and co-op).
- Every gacha line has a canon movepool of 20-30 moves with at least two tutor moves per slot, two Maestro moves (one dungeon-locked), recommended/full builds, and every move has rank effects under the ceilings.

## Parity checklist
- [ ] Species: starters + gacha lines all grow (evolution or awakening): T1 tests/core/evolution.test.ts, tests/core/awakening.test.ts. Full movepools for every line: T3.
- [x] Every playable species has its own sprite with the core sheets and a name in es/en (evolution.test iterates `PLAYABLE_SPECIES`); fairness, boosts, sprites and anim tests iterate `PLAYABLE_SPECIES` and now cover the 4 new forms.
- [x] Dungeons: 8 challenges covered by challenge.test (entry rule, type fit, lore, boss, floors) and fairness-floors (iterates `DUNGEONS` + `CHALLENGES`); main dungeons, Sima/endless and the shrine ignore the line rule (`challengeMisfits` is empty for them, tested).
- [ ] Solo + co-op entry rule: core in T1 (tests); UI and host start check in T2.
- [x] Save: evolved starter forms, starter-line materials (Mimikyu's too) and `awakened` sanitized and round-tripped (evolution.test, awakening.test, save.test); no version bump.
- [x] Net: unchanged protocol (evolved forms are playable so `isPlayable` accepts them; the stage bonus, like upgrades, lives in each peer's own player).
- [x] i18n es/en: species, move Hiperrayo, 8 challenges (name, subtitle, intro, 4 floor lines, victory line; challenge.test checks both languages and no em dash).
- [ ] Challenges menu reachable from dungeon select, town exit and Phantump's window: T2.
- [x] GDD §5 rewritten for starter evolutions, Mimikyu's awakening, the 8 trials and the line rule (T1); menu and movepools in T2/T3.
- [x] sim/prove: prove unchanged (166 cards survivable, 24/24 fights), it iterates the starters' base forms.

## Progress
- Research: PokeAPI learnsets read 2026-10-26 (latest version group with data: scarlet-violet for Piplup, Shinx, Axew, Zorua, Litwick lines; brilliant-diamond-shining-pearl for Abra and Cubone lines). PMDCollab AnimData: Zoroark 0571, Lampent 0608, Chandelure 0609, Marowak 0105 have Idle, Walk, Attack, Shoot, Charge and Hurt as their own sheets (no `CopyOf`); none existed as enemy sprites.
- Baseline (main 245f309, worktree): vitest 214 files / 2597 tests passed.
- T1 (route: inline): tests written first (evolution, challenge, awakening, evolved-selection); RED observed at typecheck and run (missing `challengeMisfits`, starter lines, `awakened`, sprites 0571 missing), then GREEN. Data: `PLAYER_EVOLUTIONS` + 4 starter steps (stage moves Tajo Umbrío, Desahogo, Hiperrayo (new Básico heavy beam), Llamarada), `PLAYER_AWAKENINGS.mimikyu` (Mazazo, Golpe Fantasma), `lineRoot`; `starterForm` builds the evolved starters from `SPECIES_BASE` (kit + stage moves + the starter's offer; `tutorOffer` resolves the line). Core: `rosterOf` puts an evolved starter in its starter's place, `currentForm`, `awakenedOf`, `nextStep`/`awakeningOf`, `stageBonus(species, party, awakened)`, `evolve` carries `learned` too and appends an evolved starter to `owned`, `knownMoves` adds awakened moves, `createWorld({ awakened })`; `challengeOpen` reads the roster, `challengeMisfits`. Save: `awakened`, materials keyed by any playable first form. Settings: a stored base form reads as its line's current form; the quiz picks the current form. Challenges: `ChallengeLine`, own pools (`at(species, f1, f2, f3)`), lore `floorKeys` + `victoryKey`. Sprites via tools/fetch-sprites.mjs (only additions; CREDITS regenerated). Town floaters: Lampent, Chandelure.
- T1 checks: typecheck ok; vitest 216 files / 2629 tests passed; build ok; prove 166 cards survivable, 24/24 fights.

## Open questions
- None pending from T1 (Mimikyu: user decided it awakens).

## Next step
T2.
