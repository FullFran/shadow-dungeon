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

## Acceptance (observed)
- `npm run typecheck`: clean.
- `npx vitest run --testTimeout=30000 --maxWorkers=4`: 242 files, 3006 tests passed.
- `npm run build`: built.
- `npm run prove`: 166 cards (166 survivable), 24/24 solver fights cleared; witnesses file unchanged.
- tests/sim/wound-prove.test.ts: 17 cards proven on Easy..Nightmare, solver clears Nightmare on seeds 1-3.

## Parity checklist
- [x] Every challenge line: reach rule applied to all eight (test iterates CHALLENGES on every tier). Mimikyu's Senda complete.
- [ ] Cubone, Litwick, Zorua, Abra, Piplup, Shinx, Axew Sendas: outlined in docs/story-quests.md, text, mid-bosses and wounds pending (owner's pilot scope; pending, not out of scope).
- [x] Solo: cinematics before/after, voice, fragments, boss lines, bond (screenshots in the scratchpad).
- [x] Co-op: voice, fragments (non-pausing card), boss lines; no cinematics (shared runs never pause). Not playtested online.
- [x] Save/sanitize: optional `story`, round trip and hostile values tested.
- [x] i18n es/en (completeness test).
- [x] GDD section.
- [x] Sim/prove: prove green; the wound has its own live proof test; bonfire test updated (a Senda lights one on each mid-boss).
- Shrine/Sima/main dungeons: not concerned (the wound is not in the shrine's reflections yet: pending decision).

## Next step
Owner review of the Mimikyu text and the wound's feel; then fill the next Senda.
