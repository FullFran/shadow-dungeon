# story-quests

## Objective
Turn each line's challenge dungeon into a Senda (story quest) in three chapters, one per material tier (I Normal, II Hard, III Nightmare): a longer road (seven floors, two mid-bosses with fog and bonfire, and the line's own wound as the last boss), a cinematic before and after, inner-voice lines, memory fragments, boss epithets and lines, and a bond line per chapter. Pilot: Mimikyu complete; the other seven outlined in docs/story-quests.md and fillable with data.

## Problem
Owner (2026-10-26) after Mimikyu's challenge: "no estuvo tan épica... lore del Pokémon, con sus traumitas... alguna cinemática... que le cojas cariño al bicho, como en Genshin pero con fórmula souls". Additions the same day: longer Sendas with 2-3 bosses per chapter and the Pokémon's own powered-up wound as the final boss, provably beatable; full creative freedom drawing on canon motifs (dossier); a pool reach rule after Litwick's Flash Fire made its challenge trivial.

## Scope
- docs/story-quests.md (design, all 8 outlines), GDD section.
- Data `src/data/story-quests.ts` (`STORY_QUESTS`), pure rules `src/core/story.ts`.
- Wound boss: species `mimikyu-wound`, cards `src/data/wound-cards.ts` (Decidueye's card engine, cards on every tier), rooms `throne` and `wound-mimikyu`, `sendaPlan` in dungeons.ts; corrupted + 1.7x render.
- Reach rule: `attackTypesOf`/`typeHurts`/`canHurtLine` in core/challenge.ts; Litwick and Piplup pools fixed.
- Save: optional `story` field, sanitized (5 lines in save.ts).
- Cinematics on the prologue player with `src/adapters/story-scenes.ts`; in-run voice, fragments (card in `src/app/memory-card.ts`), boss lines (after the fog); bond and Phantump line in Phantump's window; Senda progress in the challenges window.

## Constraints
- Allowed surfaces: docs/story-quests.md, docs/gdd.md, odd/tasks/story-quests.md, src/**, tests/**, index.html. `reports/proof/` untouched: the wound's proof is searched live in its own test instead of stored witnesses.
- Avoid save.ts beyond the optional field, and the shared menu component.
- es peninsular, no em dashes; en translations. Conventional Commits, explicit paths, no AI attribution, no push.

## Delivery strategy
single branch `feat/story-quests` from main 2360985: design doc commit, then one feature commit (engine, wound, reach rule, Mimikyu content: the completeness tests bind the text to the engine, so they ship together), then the design update. About 1,900 authored lines; PR slicing is the owner's decision.

## Tasks
- [x] T1 Design doc + GDD pointer + this document. Route: inline (passive docs). Commit a689b0b.
- [x] T2 Engine/data: STORY_QUESTS, core/story.ts, save field, scenes, cinematic wiring, in-run voice/fragment/boss, town bond, tests. Route: inline (this agent is the delegated writer).
- [x] T3 Owner addition: seven-floor road, mid-bosses, wound boss with cards, live beatability proof (18 tests: every card of every tier from three starts, solver fights on Nightmare). Route: inline.
- [x] T4 Owner addition: reach rule + test for every challenge; Litwick and Piplup pools fixed. Route: inline.
- [x] T5 Mimikyu content (es/en), canon-inspired, challenge text replaced; screenshots.
- [x] T6 Owner 2026-10-26 "sigue con las otras 7" (commits 1d572c6 sprites, c98ee78 feature; branch `feat/sendas-starters`, the starters; Abra, Piplup, Shinx, Axew on a parallel branch): Cubone, Litwick and Zorua Sendas, text es/en, wounds, scenes. Route: delegated writer (this agent), inline inside it.
- [x] T7 Owner addition "los tres capítulos no pueden sentirse iguales": a road per chapter (`roadFor`, `challenge-<line>-2/-3`, `SENDA_ROADS`), its own base look and two mid-bosses; the wound grows per tier (cards 2/3/5/6, drawn x1.35/x1.55/x1.8). Runs map the road from dungeon + tier on every peer; the end summary counts the road as its challenge; the fairness yardstick reads the road.
- [x] T8 Owner addition "pon más jefes, que estos están muy quemados": 15 new Senda shadows (7 new sheets fetched: Mandibuzz, Kangaskhan, Dusknoir, Banette, Mismagius, Kecleon, Spiritomb; 8 from existing sheets), data kit `src/data/story/kit.ts`, one arena each, reach and STAB tests per road, live proofs per line (tests/sim/story-prove-<line>.test.ts).
- [x] T9 Owner addition "Touhou por dentro": signature cards named «Signo», from the proven patterns plus a moon-phase ring card; survival on Hard, last word on Nightmare; hpScale per tier tuned to the kill margins. New engine patterns (frozen knives, late-visible bullets, phoenix walls) pending.
- [x] T10 The gacha lines (branch `feat/sendas-gacha`, built from main b87190d, then converged on the starters' kit): Abra, Piplup, Shinx and Axew Sendas on `senda()`/`roadFor`, one file each under `src/data/story/` and `src/adapters/story/<line>-scenes.ts` (12 new tableaux; figures can face away and vanish with a teleport's shimmer). 21 new shadows (19 new sheets fetched with `tools/fetch-sprites.mjs --add=`, a new flag that keeps the rest of sprite-meta.json; Lanturn and Bisharp as shadows of existing sheets), 4 wounds (Alakazam Desvelado, Empoleon de Hielo Negro, Luxray Sin Párpados, Haxorus de Colmillos Rotos). Kit extended, generic: a `blades` template (Aegislash's fan + swung blade), per-card HP `weights` per tier, and the last word's `last` form (`turning`, `aimed`, `drop`) for bosses whose turning one had no melee opening. Reused old bosses only where the story needs them (Nihilego in Abra III and Shinx III, Trevenant in Axew II), proven at those roads' levels (tests/sim/story-prove-reused.test.ts). Text es/en for the four lines (challenge, 3 chapters, floors per road, cards and stances). Route: delegated writer (this agent), inline inside it; the HP tuning fitted with a scratch calibration over the live proof (several rounds).

## Acceptance (observed)
- Pilot (T1-T5): typecheck clean; 242 files, 3006 tests; build; prove 166 cards, 24/24 fights; wound-prove 17 cards.
- Starters (T6-T9, 2026-10-26), on `feat/sendas-starters`:
  - `npm run typecheck`: clean (both configs).
  - `npx vitest run --testTimeout=30000 --maxWorkers=4`: 252 files, 3393 tests passed.
  - `npm run build`: built.
  - `npm run prove`: 166 cards (166 survivable), 24/24 solver fights cleared; reports/proof/latest.md unchanged.
  - tests/sim/story-prove-{cubone,litwick,zorua}.test.ts + wound-prove: 283 tests (every card of 15 shadows and 4 wounds on Easy..Nightmare from three starts; solver clears every Nightmare fight on seeds 1-3).
- Gacha lines (T10, 2026-10-26), on `feat/sendas-gacha` after merging main 49e9637:
  - `npm run typecheck`: clean (both configs).
  - `npx vitest run --testTimeout=30000 --maxWorkers=4`: 259 files, 3884 tests passed, no unhandled errors (the wound proof is sharded: tests/sim/wound-prove.ts with wound-prove.test.ts for the pilot and starters, wound-prove-gacha{,-2}.test.ts for the gacha lines; the long single test had starved a worker's RPC).
  - `npm run build`: built.
  - `npm run prove`: 166 cards (166 survivable), 24/24 solver fights cleared; reports/proof untouched.
  - Gacha proofs: story-prove-{abra,piplup,shinx,axew} (every card of 21 shadows on Easy..Nightmare from three starts, solver on Nightmare seeds 1-3), wound-prove-gacha shards (4 wounds, each tier at its own road's level), story-prove-reused (Nihilego and Trevenant replaying their stored witnesses at the gacha roads' levels).

## Parity checklist
- [x] Every challenge line: reach rule applied to all eight (test iterates CHALLENGES on every tier). Mimikyu's Senda complete.
- [x] Cubone, Litwick, Zorua Sendas: three chapters with their own roads, shadows, wound, scenes, text es/en (T6-T9).
- [x] Abra, Piplup, Shinx, Axew Sendas: three chapters with their own roads, shadows, wound, scenes, text es/en (T10); proofs per line (tests/sim/story-prove-{abra,piplup,shinx,axew}.test.ts), wounds per road level (tests/sim/wound-prove.test.ts reads each tier's road), reused bosses (story-prove-reused); screenshots in the scratchpad (senda-<line>-cinematic/fragment/wound.png).
- [ ] Mimikyu: still one road for its three chapters (Sableye, Aegislash); per-chapter roads and shadows for it are the owner's call (its text names those bosses). Pending, not out of scope.
- [x] New species parity (shadows): species, behaviour (card engine), tier tricks, sprite anim, rooms, i18n names/cards/stances, XP (50 per shadow, wounds 0 like Mimikyu's), reach rule, proofs. Not in the shrine's reflections nor the Sima (pending decision, like the wound).
- [x] Sprites: 7 sheets fetched with tools/fetch-sprites.mjs (native Idle, Walk, Attack, Shoot, Charge, Hurt; Alolan Marowak rejected, its Shoot is a copy), CREDITS regenerated. No shiny needed (enemies).
- [x] Co-op: the road is derived from the host's dungeon id and tier on every peer (startRun), so shared runs walk the same road; not playtested online.
- [x] Solo: cinematics before/after, voice, fragments, boss lines, bond (screenshots in the scratchpad).
- [x] Co-op: voice, fragments (non-pausing card), boss lines; no cinematics (shared runs never pause). Not playtested online.
- [x] Save/sanitize: optional `story`, round trip and hostile values tested.
- [x] i18n es/en (completeness test).
- [x] GDD section.
- [x] Sim/prove: prove green; the wound has its own live proof test; bonfire test updated (a Senda lights one on each mid-boss).
- Shrine/Sima/main dungeons: not concerned (the wound is not in the shrine's reflections yet: pending decision).

## Next step
Owner review of the seven Sendas' texts (the gacha four in the scratchpad screenshots senda-<line>-*.png) and the shadows' feel; decide Mimikyu's per-chapter roads; shadows in the shrine and the Sima are pending.
