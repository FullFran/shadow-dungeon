# accounts-client

## Objective
First version of player accounts in the web client: email + password sign-up, log in, log out and delete account against the live backend (PocketBase v0.40.6 at https://sd-api.fullfran.com), plus a cloud copy of the local save. Simple and clean.

## Problem
The save lives only in this browser's localStorage (src/app/save.ts): a cleared browser or a new phone loses every Pokémoneda, upgrade and gacha Pokémon. The backend (feat/backend-v1, `server/README.md`) already offers users and one save per user with optimistic concurrency (`rev`, 409 with `data.current`).

## Why
User request (2026-10-26): "first version of accounts with email + password; cloud save. Simple and clean."

## Scope
- Port + plain-fetch adapter for the API (no SDK): sign up, log in, refresh, get/create/update save, delete account. Base URL `import.meta.env.VITE_API_URL`, default https://sd-api.fullfran.com. `Authorization: TOKEN` (no Bearer).
- Session in localStorage (try/catch; play never depends on it), refreshed on start, sign out.
- Account screen from the title menu and from Settings: register, log in, log out, delete account (confirm), current email. Phone-friendly, regular weight only.
- Cloud sync: guest play unchanged. First login on a device: server empty -> upload local; server has a save and local is empty -> take the cloud; both non-empty and different -> ask "Este dispositivo" / "La nube" with coins and owned Pokémon of each. Then every local save write is pushed debounced (2 s, and at once when the tab is hidden) with the known `rev`; 409 -> adopt the server's save and tell the player; offline -> keep the latest and retry later, never block play.
- Docs: GDD and README note on accounts and privacy.

## Constraints
- Allowed surfaces: odd/tasks/accounts-client.md, src/**, tests/**, docs/gdd.md, README.md, index.html, package.json, package-lock.json, .env.example.
- New modules under src/app/ and src/adapters/; thin wiring in main.ts (parallel branches feat/roster-parity, feat/achievements-missions touch save/settings).
- save.ts stays untouched: write points are observed by wrapping the KeyValueStore given to the game (every save write already goes through `writeSave(store, ...)` with main.ts's store).
- No accounts on the production server during development; no analytics; the token goes only to the API base URL.
- No SMTP yet: no password reset or verification; the UI says "Si olvidas la contraseña, escríbenos".
- Test-first for the pure logic; one Conventional Commit per task, no AI attribution, no push/merge/deploy.

## Decisions
- Plain fetch over the PocketBase SDK: six calls, no extra dependency, and the port keeps tests on a fake.
- Save writes are observed by a store decorator (`observeKey`) instead of editing save.ts, so parallel branches that add save fields need no change here.
- A cloud save adopted (choice, 409, newer at start) is written through the raw store, so adopting never echoes a push.
- On start with a stored session: refresh the token, fetch the save; a newer server `rev` is adopted (same rule as a 409), else local changes made offline are pushed.
- OAuth "Vincular (pronto)" placeholder: not added (not trivial to make meaningful); OAuth linking stays pending for a later version.

## Delivery strategy
Branch `feat/accounts-client` from main 4934138; one commit per task; forecast ~900-1,200 authored lines (single PR, `ask-on-risk` default; reported to the parent).

## Tasks
- [ ] T1 Pure sync logic (src/app/cloud-sync.ts) with tests: emptiness, first-login decision, summaries, push loop (debounce, 409 adoption, offline retry, flush on hide). Route: inline (single new module + test, already understood).
- [ ] T2 API adapter (src/adapters/account-api.ts) with a fake-fetch test; session storage (src/app/account.ts) with tests. Route: inline.
- [ ] T3 Account screen + wiring (src/app/account-screen.ts, main.ts, i18n, index.html CSS). Route: inline.
- [ ] T4 Docs (docs/gdd.md, README.md, .env.example).
- [ ] T5 Local end-to-end against `go run . serve` (register -> save -> reload -> restored).

## Acceptance
- typecheck, `npx vitest run --testTimeout=30000`, build, `npm run prove` green.
- Tests cover: first-login decision table, 409 adoption, debounce coalescing, offline retry, flush on hide, storage failure tolerated, API request shapes (no Bearer, filter, rev).
- Guest play unchanged (no request is made while signed out).

## Progress / evidence
(filled per task)

## Parity checklist
- [ ] Save write points: every `writeSave` call site in the app (shop, tutor, gacha, evolve, coin earnings, challenge rewards, shrine gauntlet) goes through main.ts's store -> observed by `observeKey`.
- [ ] Save versions: the cloud payload is `sanitize()`d at SAVE_VERSION; a cloud save from an older/newer client reads through `migrate()` + `sanitize()` like a local one.
- [ ] Solo and co-op: the save is per device/account, so co-op payouts written locally are pushed like solo ones.
- [ ] i18n es/en for every new string (no em dashes).
- [ ] GDD (`docs/gdd.md`) and README.
- [ ] sim/prove harnesses: unaffected (no core change); `npm run prove` green.
- Pending (not in v1): OAuth linking (Google/Twitch/Discord), password reset and email verification (need SMTP), profiles/nickname sync, settings and notice-board records in the cloud (only the save facade syncs).

## Next step
T1.
