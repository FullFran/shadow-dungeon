# story-quests

## Objective
Turn each line's challenge dungeon into a Senda (story quest) in three chapters, one per material tier (I Normal, II Hard, III Nightmare), with a cinematic before and after, inner-voice lines in the run, memory fragments, the boss as a figure of the Pokémon's wound and a bond line per chapter. Pilot: Mimikyu complete; the other seven outlined in docs/story-quests.md and fillable with text only.

## Problem
Owner (2026-10-26) after Mimikyu's challenge: "no estuvo tan épica... lore del Pokémon, con sus traumitas... alguna cinemática... que le cojas cariño al bicho, como en Genshin pero con fórmula souls".

## Scope
- docs/story-quests.md (design, all 8 outlines), GDD pointer.
- Data `src/data/story-quests.ts` (`STORY_QUESTS`), pure rules `src/core/story.ts` (tier → chapter, gating, progress, sanitize, fragment spot).
- Save: optional `story` field (chapters cleared per line), sanitized; no version bump. Kept to a few lines in save.ts (fix/progress-continuity works there).
- Cinematics on the prologue player with new scenes `src/adapters/story-scenes.ts` (rag, candle, plaza, eclipse, dark, Phantump at the lake; the line's sprite in a pose).
- In-run (game.ts): inner voice (arrive, mid, lowHp), memory fragment pickup + card, boss name card and lines replacing the guardian cinematic in a Senda.
- Town: bond line and Phantump's line in Phantump's window; chapter status in the challenges window.
- Mimikyu's challenge text consistent with the Senda.

## Constraints
- Allowed surfaces: docs/story-quests.md, docs/gdd.md, odd/tasks/story-quests.md, src/**, tests/**, index.html.
- Avoid save.ts beyond the optional field, and the shared menu component.
- es peninsular, no em dashes; en translations. Conventional Commits, explicit paths, no AI attribution, no push.

## Delivery strategy
single branch `feat/story-quests` from main 2360985; three commits (doc, engine/data, Mimikyu content). Forecast ~1,100 authored lines; PR slicing is the owner's decision.

## Tasks
- [x] T1 Design doc + GDD pointer + this document. Route: inline (passive docs).
- [ ] T2 Engine/data: STORY_QUESTS types, core/story.ts, save field, scenes, cinematic wiring, in-run voice/fragment/boss, town bond, tests. Route: inline (writer is this agent; delegated by the parent).
- [ ] T3 Mimikyu content: es/en text of the three chapters, challenge text aligned, completeness tests, screenshots.

## Acceptance
- typecheck, `npx vitest run --testTimeout=30000 --maxWorkers=4`, build, `npm run prove` green.
- Every STORY_QUESTS entry is complete in es and en (test iterates the table).
- Chapter gating: I always (with the line), II after I, III after II; Easy has none.
- Progress survives a save round trip; hostile values are dropped.

## Parity checklist
- [ ] Every challenge line: Mimikyu complete; Cubone, Litwick, Zorua, Abra, Piplup, Shinx, Axew outlined in docs/story-quests.md, text pending (owner's pilot scope; listed as pending, not out of scope).
- [ ] Solo: cinematics before/after, voice, fragment, boss lines.
- [ ] Co-op: voice, fragment card (non-pausing), boss name card and lines; no cinematics (shared runs never pause).
- [ ] Save/sanitize: optional `story`.
- [ ] i18n es/en.
- [ ] GDD section.
- [ ] Sim/prove: presentation only, no simulation change (prove must stay green unchanged).
- Shrine/Sima/main dungeons: not concerned (Sendas live on challenge dungeons only).

## Progress
- T1 done.

## Next step
T2.
