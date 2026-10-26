# sima-lore

## Objective
Give the Sima del Eclipse a reason, a thread and cinematics (docs/sima-redesign.md), and bring the Sendas' shadows and wounds into it without touching daily fairness.

## Problem
Owner (2026-10-26): "A la Sima hay que darle una vuelta para que tenga sentido y hacerle un lore, con cinemáticas"; the Sendas' shadows and wounds belong down there; there must be a reason to go down.

## Owner decisions (2026-10-26)
1. Reason: A, "a por los que no volvieron"; you come back because you answered the voice and your shadow pulls you up.
2. The clock is "Lucidez" / "Lucidity" in the HUD; amounts unchanged. At 0:00 "te pierdes": your shadow carries you to the crater rim (re-skinned time-out end, same rewards).
3. Uncleared Sendas: shadows and wounds are nameless ("Sombra de alguien", "Una herida que no es tuya"); cleared ones show name and a recognition line. Memory changes text only, never generation (test: same seed, different progress, identical floors).
4. The Sima stays open from the start. A Mystery-Dungeon-style plea sequence in the town before the first descent; a "te pierdes" wake-up scene with Phantump; strata thresholds, first Eco, first herald, first Senda shadow (two variants), the return. Solo plays them, co-op shows a text card, once per device, skippable, clock paused.
5. Later the same day: the Llamados (provisional name, key `lore.reborn.name`): every playable Pokémon is a human reborn as a Pokémon who answered the voice; that is why they come back. A Llamado carries the Pokémon's memories and wounds (the Sendas).
6. Later the same day: Figuraciones YES (cosmetic silhouettes under 60 s of lucidity, never touching the simulation, accessibility toggle, prefers-reduced-motion).

## Scope
Allowed surfaces: docs/sima-redesign.md, docs/gdd.md, odd/tasks/sima-lore.md, src/**, tests/**, index.html.

## Delivery strategy
Branch `feat/sima-lore` from main, one work-unit commit per task, no push (owner decides PRs).

## Tasks
- [ ] T1 Design doc committed (2b86e3a). Route: inline.
- [ ] T2 Texts: lucidity (HUD label, entry card, end screen), dungeon lore, strata stage subtitles and lines, `lore.reborn.name`. Route: inline.
- [ ] T3 Memory-aware names: faceless guardian echo, nameless/recognised Senda shadows and wounds (presentation only). Route: inline.
- [ ] T4 Wounds on alternate guardian-echo floors from 35 (35, 55, 75...), seeded bag from STORY_BOSSES; Sombra extraviada floors from 12 (seeded, never on an echo/herald floor), fog wall with a way past, +20 s and an item pick. Route: inline.
- [ ] T5 Fairness test (same seed, different memory: identical floors) and Sima-appearance proofs of every Senda boss. Route: inline.
- [ ] T6 Cinematics: Sima scenes (mouth, strata, own shadow, first name, someone's shadow x2, lost + wake-up with Phantump, return), per-device seen flags, solo/co-op, triggers. Route: inline.
- [ ] T7 Town plea sequence before the first descent. Route: inline.
- [ ] T8 Figuraciones + accessibility setting. Route: inline.
- [ ] T9 GDD, proposal status, screenshots, full verification. Route: inline.

## Parity checklist
- [ ] Solo and co-op (cinematics vs text card; names per client memory; host-decided boss through the seed).
- [ ] Daily challenge fairness (test).
- [ ] Every Senda boss (STORY_BOSSES + Mimikyu's wound) can appear in the Sima (test iterates them).
- [ ] Every Sima appearance proven beatable at its depth scaling.
- [ ] i18n es/en.
- [ ] Save/profile: per-device flags only (no SaveData field).
- [ ] GDD.
- [ ] Settings: Figuraciones toggle, reduced motion.

## Next step
T2.
