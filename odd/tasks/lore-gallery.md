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
- [x] T1 Pleas on arrival: the solo town plays the pleas when it opens if they are due (any profile without the `plea` flag), leaving the player on the crater's rim; the Sima departure keeps its own check. Route: inline (two files, understood). Test-first: an old profile's store (save, records, prologue, no `simaScenes`) is due; the scene starts the pleas on arrival, never in a room nor with a dev start window. Commit e893633.
- [x] T2 Gallery data (pure): groups and entries built from PROLOGUE, SIMA_PLEA, SIMA_SCENE_IDS, GUARDIAN_CINEMATICS and STORY_QUESTS; seen-state from the device flags, records and the save's `story`. Route: inline. Test-first: every Senda x chapter x phase, every Sima scene, every guardian phase is listed; locked vs unlocked; a new Senda appears without touching the gallery. Commit 1610147.
- [x] T3 Gallery window in the town's Esc menu (solo and room), described menu (descriptions on the right), replay without touching progress (no seen flag, save, records or story written); the pleas replay on the rim and bring the player back. i18n es/en. Dev `window=gallery`, menu-geometry case. Route: inline. Commit 953169e.
- [x] T4 Docs (GDD, sima-redesign T2 note), verification. Route: inline.

## Acceptance criteria
- An old profile (no `simaScenes` key) arriving at the town alone sees the pleas once; Esc ends them; never again on that device.
- The gallery lists every cinematic from the data sources; unseen ones show "???" and do not play; replay changes no progress.
- es/en keys for every new string; the town menu parity tests and menu-geometry include the gallery.

## Parity checklist
- [x] Solo town Esc menu lists the gallery (tests/town/town-menu.test.ts: `openGallery: townGallery(root)` twice).
- [x] Room town Esc menu lists the gallery; the pleas' replay only alone (row explains it in a room).
- [x] All 8 Sendas, 3 chapters, before and after (tests/app/lore-gallery.test.ts iterates STORY_QUESTS and pins the 8 lines).
- [x] Every Sima scene, the pleas first (iterates SIMA_SCENE_IDS; the return's short form is the same tableaux).
- [x] Prologue (first group; unlocked by the prologue flag or a chosen starter).
- [x] Guardian cinematics (iterates GUARDIAN_CINEMATICS, pre and post; also unlocked by the dungeon cleared in records).
- [x] i18n es/en (gallery test checks every row and group key in both languages, no em dash).
- [x] GDD (Sima pleas trigger, town menu, Galería paragraph); sima-redesign T2 note.
- [x] Menu geometry: `town-gallery` case, stable at 3 viewports.
- [ ] Pending: herald intros (procedural per seed, not a fixed catalogue): not in the gallery.

## Checks
npm run typecheck; npx vitest run --testTimeout=30000 --maxWorkers=4; npm run build; npm run prove; node tools/mobile/menu-geometry.mjs.

## Progress
Done. Owner corrections mid-task: the prologue is mandatory as the first group (done); a "field journal" framing was requested then withdrawn (kept plain: «Galería» / "Gallery", "???").

Cloud decision: the Sima's `simaScenes` flags stay device-local like `prologueSeen` and `cinematicsSeen` (profile.ts: seen flags never travel; "a new device tells the story again"). The gallery widens them with what already travels: the save's `story` (Senda chapters), the run records (a guardian's dungeon cleared) and the chosen starter (prologue). No new profile field, no merge rule.

## Verification (observed)
- `npm run typecheck`: clean.
- `npx vitest run --testTimeout=30000 --maxWorkers=4`: 260 files, 3253 tests passed.
- `npm run build`: built.
- `npm run prove`: 166 cards (166 survivable), 24/24 solver fights cleared.
- `node tools/mobile/menu-geometry.mjs`: every menu kept its geometry (town-gallery included).
- Browser check (headless Firefox, dev server): an old profile without `simaScenes` gets the pleas on arriving in town, Esc ends them on the rim, the flag is written and they do not play again; the gallery replays a Senda chapter and the pleas (back to the Refugio) without changing storage.

## Pending
- Herald intros: procedural per seed (up to 500 in the bestiary), not a fixed catalogue; not in the gallery.
- tools/mobile/shots.mjs, calls.mjs and bench.mjs open `screen=town` on a fresh profile, which now starts with the pleas; seed `mazmorra-sombria.simaScenes=["plea"]` there if their town captures should show the Refugio.
- A Senda chapter attempted but not won had its opening played; the gallery unlocks a chapter only once closed (no per-chapter seen flag exists).
