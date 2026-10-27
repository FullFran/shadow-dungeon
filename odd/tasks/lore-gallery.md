# lore-gallery

## Objective
1. Every player who has not seen the Sima's pleas sees them, old profiles included, at the next natural entry point; once seen, never forced again; Esc still ends them.
2. A gallery in the town's Esc menu to rewatch every cinematic already seen (prologue, the Sima's pleas and scenes, the guardians, every Senda chapter before and after); unseen ones locked as "???".

## Problem
Owner (2026-10-27): "Haz que las escenas de la Sima salgan a todos los que no las hayan visto, que si no se las pierden" and "una galería para volver a ver las cinemáticas, para los amantes del lore". The pleas only played when a solo player headed for the Sima from the town, so anyone who no longer goes down (or plays it only in a room) never saw them.

## Scope
Allowed surfaces: odd/tasks/lore-gallery.md, src/app/**, src/town/**, src/i18n/*.json, tests/**, tools/mobile/menu-geometry.mjs, docs/gdd.md, docs/sima-redesign.md.

## Delivery strategy
Branch `feat/lore-gallery` off main (3bab8b4). One work-unit commit per task, no push, no deploy. Forecast about 600 authored lines (i18n included); `ask-on-risk` stays with the owner (no PR is opened here).

## Tasks
- [ ] T1 Pleas on arrival: the solo town plays the pleas when it opens if they are due (any profile without the `plea` flag), leaving the player on the crater's rim; the Sima departure keeps its own check. Route: inline (two files, understood). Test-first: an old profile's store (save, records, prologue, no `simaScenes`) is due; the scene starts the pleas on arrival, never in a room nor with a dev start window.
- [ ] T2 Gallery data (pure): groups and entries built from PROLOGUE, SIMA_PLEA, SIMA_SCENE_IDS, GUARDIAN_CINEMATICS and STORY_QUESTS; seen-state from the device flags, records and the save's `story`. Route: inline. Test-first: every Senda x chapter x phase, every Sima scene, every guardian phase is listed; locked vs unlocked; a new Senda appears without touching the gallery.
- [ ] T3 Gallery window in the town's Esc menu (solo and room), described menu (descriptions on the right), replay without touching progress (no seen flag, save, records or story written); the pleas replay on the rim and bring the player back. i18n es/en. Dev `window=gallery`, menu-geometry case. Route: inline.
- [ ] T4 Docs (GDD, sima-redesign T2 note), verification. Route: inline.

## Acceptance criteria
- An old profile (no `simaScenes` key) arriving at the town alone sees the pleas once; Esc ends them; never again on that device.
- The gallery lists every cinematic from the data sources; unseen ones show "???" and do not play; replay changes no progress.
- es/en keys for every new string; the town menu parity tests and menu-geometry include the gallery.

## Parity checklist
- [ ] Solo town Esc menu lists the gallery.
- [ ] Room town Esc menu lists the gallery (the pleas' replay only alone).
- [ ] All 8 Sendas (cubone, litwick, zorua, abra, piplup, shinx, axew, mimikyu), 3 chapters, before and after.
- [ ] Every Sima scene (plea, mouth, strata, own shadow, first name, somebody's shadow both forms, lost, return).
- [ ] Prologue (first group).
- [ ] Guardian cinematics (aegislash, decidueye, dhelmise, nihilego; pre and post).
- [ ] i18n es/en.
- [ ] GDD.
- [ ] Pending: herald intros (procedural per seed, not a fixed catalogue): not in the gallery.

## Checks
npm run typecheck; npx vitest run --testTimeout=30000 --maxWorkers=4; npm run build; npm run prove; node tools/mobile/menu-geometry.mjs.

## Progress
(none yet)
