# sima-lore

## Objective
Give the Sima del Eclipse a reason, a thread and cinematics (docs/sima-redesign.md), and bring the Sendas' shadows and wounds into it without touching daily fairness.

## Problem
Owner (2026-10-26): "A la Sima hay que darle una vuelta para que tenga sentido y hacerle un lore, con cinemáticas"; the Sendas' shadows and wounds belong down there; there must be a reason to go down.

## Owner decisions (2026-10-26)
1. Reason: A, "a por los que no volvieron"; you come back because you answered the voice and your shadow pulls you up.
2. The clock is "Lucidez" / "Lucidity" in the HUD; amounts unchanged. At 0:00 "te pierdes": your shadow carries you to the crater rim (re-skinned time-out end, same rewards).
3. Uncleared Sendas: shadows and wounds are nameless ("Sombra de alguien", "Una herida que no es tuya"); cleared ones show name and a recognition line. Memory changes text only, never generation (test: same seed, different progress, identical floors).
4. The Sima stays open from the start. A Mystery-Dungeon-style plea sequence in the town before the first descent; a "te pierdes" wake-up scene with Phantump; strata thresholds, first Eco, first herald, first Senda shadow (two variants), the return. Solo plays them, co-op logs a line, once per device, skippable, clock paused.
5. The reborn: «Caminantes de la Sima» / "Sima Walkers" (key `lore.reborn.name`, singular `lore.reborn.one`; `{called}`/`{calledOne}` in any string). Every playable Pokémon is a human reborn as a Pokémon who answered the voice; a Walker carries the Pokémon's memories and wounds (the Sendas).
6. Figuraciones YES (cosmetic silhouettes under 60 s of lucidity, never touching the simulation, accessibility toggle, prefers-reduced-motion).

## Scope
Allowed surfaces: docs/sima-redesign.md, docs/gdd.md, odd/tasks/sima-lore.md, src/**, tests/**, index.html.

## Delivery strategy
Branch `feat/sima-lore` from main (worktree), one work-unit commit per task, main merged in before the final proofs (4c0b111: compressed type chart and the gacha lines' Sendas). No push; PR slicing is the owner's call (about 2,900 authored lines, i18n included).

## Tasks
- [x] T1 Design doc committed. Route: inline (passive doc). Commit 2b86e3a.
- [x] T2 Texts: lucidity (HUD label, entry card, end screen), dungeon lore, strata stage subtitles and lines, `lore.reborn.*` with `{called}` substitution in `t()`. Route: inline. Commit 9cfadca.
- [x] T3 Wounds on 35, 55, 75... (the guardians' turn skips them: Dhelmise 45, Nihilego 65), seeded bag over STORY_BOSSES + Mimikyu's wound; Sombra extraviada floors from 12 (7 %, seeded, never echo/herald floors) behind a fog wall with stairs in the antechamber, +20 s; Senda bosses fight their whole tier at 60 % HP, depth raises damage only. Route: inline. Commit 42dfad3 (+ stairs/log fix 4e1b923).
- [x] T4 Sima-appearance proofs of every Senda boss (tests/sim/story-prove-sima.test.ts, heavy shard). Route: inline. Commit a78eadd.
- [x] T5 Memory-aware names (faceless guardian, someone's shadow, a wound not yours, recognised with epithet and log line; boss bar, log, silhouettes) + fairness test; the stray's item pick. Route: inline. Commit cdc54c3.
- [x] T6 Cinematics: data/sima-scenes.ts, adapters/sima-scenes.ts, app/sima-cinematic.ts, triggers in game/main, per-device flags, dev `?screen=sima&scene=`. Route: inline. Commit f28c0da.
- [x] T7 Town plea sequence (data/sima-plea.ts, town/plea.ts, portraits on the dialog box). Route: inline. Commit eafb138.
- [x] T8 Figuraciones + accessibility setting. Route: inline. Commit 518fecf.
- [x] T9 GDD, proposal status, screenshots, verification. Route: inline. Commit d345ad1.

Route note: this whole feature ran inside one delegated writer (this agent); every task was inline in it.

## Verification (observed, after the merge of main)
- `npm run typecheck`: clean.
- `npx vitest run --testTimeout=30000 --maxWorkers=4`: 254 files, 3186 tests passed (on the final code).
- `npm run test:proofs`: 12 files, 1338 tests passed in 694 s (incl. the new tests/sim/story-prove-sima.test.ts, 597 tests).
- `npm run build`: built.
- `npm run prove`: 166 cards (166 survivable), 24/24 solver fights; reports/proof unchanged.
- Screenshots (1280x720, muted): sima-plea, sima-wake, sima-stratum, sima-shadow-nameless, sima-shadow-known in the session scratchpad.

## Parity checklist
- [x] Solo: cinematics over the run (clock stopped), the plea sequence, the mouth before the run, the lost/return after it. Evidence: screenshots; tests/app/sima-cinematic.test.ts.
- [x] Co-op: no cinematic, the scene's line in the log; boss chosen by the host's seed; names per client memory; the stray's fog crossing and stairs go through the existing fog-wall snapshot path (crossFogWall drops the stairs on guests too). Not playtested online.
- [x] Daily challenge fairness: tests/app/sima-lore.test.ts (same seed, two memories: identical worlds and plans, different names); tests/core/sima-story.test.ts (seed-only draws).
- [x] Every Senda boss can appear in the Sima: pools read STORY_BOSSES (+ Mimikyu's wound); test iterates them. The gacha lines' Sendas joined by the merge with no code change.
- [x] Every Sima appearance proven beatable: tests/sim/story-prove-sima.test.ts (every card, four tiers, three starts, at the first Sima floor; HP fixed so deeper floors are no harder to kill). Guardian echo proofs moved with the new floors (Dhelmise 45, Nihilego 65), stored witnesses still replay (prove unchanged).
- [x] i18n es/en: completeness tests (scene keys, plea keys, {called}).
- [x] Save/profile: no SaveData field. Scene/plea flags are per-device under `mazmorra-sombria.simaScenes` (like the prologue and guardian cinematics): not progress, not economy, not synced, so profile-merge needs no rule.
- [x] Settings: `figurations` on/reduced/off, sanitized on load, settings row under «Accesibilidad»; prefers-reduced-motion turns «on» down to reduced.
- [x] GDD («El lore de la Sima»), proposal (decisions and deviations).
- [ ] docs/story-quests.md «Pendiente» still says the shadows are not in the Sima: outside this task's allowed surfaces; to update.
- [ ] CI's heavy-proof path filter (.github/workflows/deploy.yml) may need the new shard's inputs (src/data/sima-story.ts, src/core/sima-story.ts): outside the allowed surfaces.
- [ ] Replaying the Sima's cinematics from the menu beside the Prologue (proposal §5): pending, not in the owner's decisions.
- [ ] Shrine (Santuario) reflections of Senda bosses: not concerned here (pending owner decision from the Sendas).

## Next step
Owner review of the texts and the scenes' feel; balance of the stray's reward and chance; push/PR when the owner decides.
