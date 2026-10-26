# cloud-sync

## Objective
Sync the whole player profile (save, run records, shrine records, Sima leaderboard, bestiary) with the account cloud like other web games: log in on another browser, get a clear notice to download the cloud data, resolve divergence safely, never lose progress.

## Problem
v1 accounts (odd/tasks/accounts-client.md) only push the save facade; records, shrine records, leaderboard and bestiary stay on one browser. The first-login rules downloaded silently or asked with only coins and Pokémon, and a 409 adopted the server blindly (local progress made meanwhile was lost). No backups, no multi-tab safety, no account tag on local data.

## Why
Owner request (2026-10-26): "un sistema para sincronizar cuentas de la nube: que pueda iniciar sesión en otro navegador con mi cuenta y me dé un aviso de descargar los datos de la nube y sincronizarlos y demás, como otros juegos web."

## Scope
- One cloud payload for the profile in the existing `saves.data` JSON. Settings stay per device.
- Per-device sync state: owner account, saveId, baseRev, base hash, last sync time, held flag, status.
- Pure decision table (push, silent pull, offer download, diverged, foreign data, held, none).
- Notices: "Encontramos tu progreso en la nube" (summary + Descargar / Empezar de cero); divergence cards "Este dispositivo" / "La nube"; foreign data (another account) choice.
- Merge rules: economy never merged; achievements, records, shrine records, leaderboard and bestiary always merged.
- Backups: ring of 3 in localStorage before every overwrite, "Deshacer" ~30 s, "Copias de seguridad" restore, "Descargar copia" / "Importar copia".
- Multi-tab: one leader tab pushes (Web Locks, localStorage lease fallback); other tabs reload state on storage events.
- Sign out keeps local data; "Borrar datos de este dispositivo" with confirm; status line in the account screen.

## Constraints
- Allowed surfaces: odd/tasks/cloud-sync.md, src/**, tests/**, docs/gdd.md, README.md, index.html.
- Server untouched (`server/internal/rules`: `data` must be an object of at most 64 KB with a top-level `version` equal to the record version and whole `coins` 0..1e9; extra keys are allowed).
- Avoid the shared menu component/CSS (fix/menu-layout) and story data/cinematics (feat/story-quests); main.ts changes stay minimal.
- No requests to production, no accounts created there, no email.

## Decisions
- Payload shape: the requested `{ save, records, ... }` would fail `ValidateSave` (no top-level `version`/`coins`), so the save stays flat at the top level and the rest rides in one extra key: `{ ...save, profile: { v: 1, records, shrine, board, bestiary, meta: { savedAt, device? } } }`. Server needs no change; v1 clients still read the save (sanitize drops `profile`). If the payload goes over 60 KB, the oldest bestiary entries are dropped first (tested).
- "Empezar de cero" (safest clean option): the device keeps its fresh local progress and enters a held state: nothing is pushed or pulled until the player picks, in the account screen, "Descargar la nube" or "Sobrescribir la nube" (with confirm; the cloud profile is backed up locally first). The cloud is never overwritten by accident.
- Achievements on merge: the union of both sides is kept, each with its earliest day. The merge never pays a reward: Pokémonedas (and any reward already paid) belong to the save that is kept; an achievement unlocked only on the discarded side is marked unlocked on the kept save without paying it again (its reward stayed with the discarded economy). Later, `recordPast` at start pays only achievements neither side had unlocked that the merged records now prove (a genuine first unlock).
- Economy never merged: coins, upgrades, learned, ranks, owned, awakened, materials, pity, earned, missions, shinies, shinyWorn, shinyPity come whole from the chosen side.
- 409 during a push no longer adopts blindly: it reruns the decision table (local unchanged since base: silent pull; changed: divergence cards).
- "Descartar" for another account's data still leaves a backup in the ring (the backup rule covers every overwrite); "Guardar como copia" labels it as such.
- Wiping device data signs out first, so an empty profile is never pushed over the cloud.

## Delivery strategy
Branch `feat/cloud-sync` from main 3805562; forecast ~1,800-2,400 authored lines (tests included) in a few work-unit commits; strategy `ask-on-risk` (reported to the parent, single PR or chain is the owner's call).

## Tasks
- [x] T1 Profile, cloud payload, merge rules, backups ring (pure) with tests. Route: inline (this worker is the delegated writer). Commit d99ca32.
- [x] T2 Decision table + pusher + sync state + leader election (pure, fakes) with exhaustive tests. Commit ae6cd5d (with T3/T4: account.ts and the screen only compile together with the new core).
- [x] T3 Account orchestration rewrite (account.ts) on the new core; account tests rewritten for the intended behavior changes. Commit ae6cd5d.
- [x] T4 Account screen (notice, cards, foreign choice, held, status line, backups, export/import, wipe), undo notice, multi-tab wiring, i18n es/en, CSS in index.html. Commit ae6cd5d.
- [x] T5 Local end-to-end (local backend, two browser profiles) and the fixes it found. Commit 012ccb6.
- [x] T6 Docs (GDD Cuentas, README). Commit (docs).

## Acceptance
- typecheck, `npx vitest run --testTimeout=30000 --maxWorkers=4`, build, `npm run prove` green.
- Decision table covered for every owner/local/remote/base/held combination; merge rule tests per store; backup ring tests; account tag tests; leader logic tests with fakes.
- E2E: A registers and saves; fresh B logs in, sees the notice, downloads, equals A; diverge both and resolve; backup + undo.

## Progress / evidence
- T1: 26 tests (tests/app/profile-sync.test.ts): payload keeps top-level version/coins, round-trip, v1 bare save, hostile data, size cap (oldest heralds first; 500 heralds x 40 chars fits the real cap untrimmed), merge per store, field classification, backups ring (limit 3, dedupe, quota, export/import).
- T2: tests/app/cloud-sync.test.ts enumerates every owner x held x base x local x remote state (invariants: never push over unseen cloud progress, never pull away local economy, foreign never merged, empty device never pushes over cloud) plus 19 named table rows; pusher (debounce, create, baseRev, 409 back to the table, offline backoff, held/choice/empty guards); leader (fake Web Locks hand-over, lease fallback with frozen leader, storage-less tab).
- T3: tests/app/account.test.ts 35 tests: offer/download, start fresh held + overwrite with cloud backup, diverged cards both ways + undo, silent pull, 409 asks, non-economic-only change merges without asking, wiped storage pulls back, foreign keep/discard/adopt, multi-tab leader/follower, legacy v1 session link, restore keeps records, wipe device.
- T5 (local backend built from the backend worktree, `--dir` in the scratchpad, origin http://127.0.0.1:5199; two headless Firefox profiles via tools/mobile/bidi.mjs, muted, 390x844): 22/22 checks. A registers (profile with records uploaded), a live save write is pushed; fresh B logs in, sees "Encontramos tu progreso en la nube" with the summary, nothing pulled before the choice, "Descargar" makes B's save, records, Sima board and bestiary equal A's; both diverge, B sees two cards, keeps its device, merged records go up, the replaced cloud is a backup, "Deshacer" restores the cloud economy and pushes it; A reloads, silent pull with "Datos de la nube cargados" and B's merged records; backups view lists copies; sign out says the data stays and keeps it. Screenshots: scratchpad sync-*.png.
- T5 found three real defects, fixed test-first in unit tests: (1) the undo notice lived in #app and was erased by the next screen redraw (now on body); (2) a pull whose merge added only non-economic data made the device look "changed", so the next concurrent push became a needless choice: the sync state now also keeps an economy hash and only moved economies ask; a cloud revision whose content equals the base counts as unchanged; (3) restore/undo replaced records wholesale: restore and import now take the backup's economy and merge the rest.
- Gate: typecheck OK; vitest 246 files / 3044 tests passed (`--maxWorkers=4`); build OK (bundle holds https://sd-api.fullfran.com, no local URL); `npm run prove` 166 cards (166 survivable), 24/24 fights.

## Parity checklist
- [x] Every local progress store is in the payload: save facade, run records, shrine records, Sima leaderboard, bestiary (`PROFILE_KEYS` test; save-continuity fixtures v2/v3 round-trip the whole profile through the cloud).
- [x] Save versions: payload save reads through migrate + sanitize; profile parts through each store's parser (hostile data test).
- [x] All save fields classified economy vs merged (`SAVE_FIELD_RULES satisfies Record<keyof SaveData, ...>`: a new field fails typecheck).
- [x] Every store has a merge rule test (records, shrine incl. group, leaderboard, bestiary, achievements).
- [x] Solo and co-op: every profile writer takes the store parameter (account-wiring test now covers saveRun/saveScore/saveTrial/recordHerald and all profile keys; setupAccount observes PROFILE_KEYS).
- [x] i18n es/en for every new string, no em dashes (account strings and sync texts tests).
- [x] GDD (Cuentas, v2) and README.
- [x] sim/prove: no core change; `npm run prove` green.
- Kept per device by design (owner decision): settings, prologue/cinematic "seen" flags, install banner.
- Pending (not in this change): OAuth linking, password reset/verification (SMTP), a device label in the payload meta (field supported, not filled), live redraw of non-account screens in follower tabs (they re-read storage on their next read; only the title redraws).

## Next step
Owner review; merge into main (no conflicts expected outside main.ts's account wiring block and the appended i18n keys). Then a production check on https://www.fullfran.com/shadow-dungeon/ with one real account, deleted afterwards.
