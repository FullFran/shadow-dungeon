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
- [ ] T1 Profile, cloud payload, merge rules, backups ring (pure) with tests. Route: inline (worker is the delegated writer).
- [ ] T2 Decision table + pusher + sync state + leader election (pure, fakes) with exhaustive tests.
- [ ] T3 Account orchestration rewrite (account.ts) on the new core; account tests updated for the intended behavior changes.
- [ ] T4 Account screen (notice, cards, foreign choice, held, status line, backups, export/import, wipe), undo toast, multi-tab wiring in main.ts, i18n es/en.
- [ ] T5 Local end-to-end (local backend, two browser profiles) and fixes.
- [ ] T6 Docs (GDD Cuentas, README).

## Acceptance
- typecheck, `npx vitest run --testTimeout=30000 --maxWorkers=4`, build, `npm run prove` green.
- Decision table covered for every owner/local/remote/base/held combination; merge rule tests per store; backup ring tests; account tag tests; leader logic tests with fakes.
- E2E: A registers and saves; fresh B logs in, sees the notice, downloads, equals A; diverge both and resolve; backup + undo.

## Progress / evidence
(filled per task)

## Parity checklist
- [ ] Every local progress store is in the payload: save facade, run records, shrine records, Sima leaderboard, bestiary (test iterates PROFILE_KEYS).
- [ ] Save versions: payload save reads through migrate + sanitize; profile parts through each store's parser (hostile data reads empty).
- [ ] All save fields classified economy vs merged (test fails if a new SaveData field is unclassified).
- [ ] Every store has a merge rule test.
- [ ] Solo and co-op: all writes go through main.ts's observed store (account-wiring test extended to every profile key).
- [ ] i18n es/en for every new string, no em dashes.
- [ ] GDD and README.
- [ ] sim/prove: no core change; `npm run prove` green.
- Pending (not in this change): settings sync (per device by decision), OAuth linking, password reset/verification (SMTP).

## Next step
T1.
