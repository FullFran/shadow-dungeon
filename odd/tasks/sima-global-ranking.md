# Sima global ranking

## Objective

A server-wide ranking of how deep each player has reached in the Sima del Eclipse, visible in the game.

## Problem / why

Friends play a lot and want to compare. Today the Sima leaderboard (`src/town/leaderboard.ts`) is per device only. Account players already upload their Sima board inside the cloud save (`saves.data.profile.board`, `ScoreEntry[]`), but `saves` is owner-only, so nobody can see anyone else's marks.

## Approach (decision)

Derive the ranking server-side from the cloud saves that already exist, instead of a new submissions collection:

- Retroactive: every friend who already synced appears at once, with no client upload change.
- No new write path, so no new cheating surface beyond what the client-authoritative save already has (accepted: friends-scale ranking, unverified; the verified replay ranking in `docs/backend-accounts-plan.md` stays the long-term plan).
- Public output only: nickname (already public in `profiles`), best floor, clock left, species, level, tier, mode, date. No emails, no user ids beyond what profiles expose.

Guests (no account) do not appear; the board says so.

## Scope

- Backend (`mazmorra-backend` worktree, branch `feat/sima-ranking` off `feat/lore-api`): `GET /api/sd/ranking/sima?tier=<difficulty>`, best entry per player per tier, sorted like `compareScores` (floor desc, then clockMs desc), top 50, cached briefly.
- Client (this repo, branch `feat/sima-global-ranking` off `main`): fetch it through the account API adapter and show it in the town Sima board next to the device board; offline/unavailable shows a clear line, never breaks the town.

## Constraints

- Server reads saves with app-level access inside the route; never exposes raw save data.
- Malformed boards in a save are skipped, never crash the route.
- Deploy is a remote operation: needs the owner's explicit go-ahead.

## Tasks

- [x] T1 Backend ranking route (pure ranking rule with table tests, route + integration test, README). Route: delegated (one writer across both worktrees; preparation reading + 2+ non-trivial files). Commit `36f8fd1` on `feat/sima-ranking` (mazmorra-backend).
- [x] T2 Client global board (adapter + town board view + i18n es/en + GDD + tests). Route: delegated (same writer). Commit `bcec027` on `feat/sima-global-ranking`.
- [ ] T3 Deploy backend and client (pending owner authorization).

## Parity checklist

- [x] Every difficulty tier has its own global board. Evidence: server `TestBuild/each_tier_keeps_its_own_board`, `TestRankingRoute` (easy, hard, nightmare, unknown -> 400), `ranking.Tiers` = client `DIFFICULTIES` (`TestIsTier`); client `global ranking source` loads every tier of `DIFFICULTIES`; the board shows the tier picked now (solo: settings; room: host).
- [x] Both Sima modes (daily and free) count. Evidence: `TestBuild/daily_and_free_runs_both_count`; route test returns a daily row.
- [x] Old scores without `difficulty` count as easy (`scoreTier`). Evidence: `TestBuild/a_score_without_difficulty_counts_as_easy`; `DefaultTier == "easy"` checked in `TestIsTier`.
- [x] i18n es/en for every new line. Evidence: `tests/town/global-ranking.test.ts` "every line has its text in every language" over `GLOBAL_RANKING_KEYS` x `LANGUAGES`.
- [x] GDD (`docs/gdd.md`) Sima/Cuentas section updated. Evidence: new "Ranking global" bullet after "Marca" in the Sima section; Cuentas "Servidor" bullet.
- [x] Co-op Sima runs: documented how they are (or are not) included. Each peer records its own score at the end of a Sima run (`endlessScore` -> `saveScore`, room guests included), so each signed-in member of the group appears with their own mark; the room's board shows the host's tier. Written in the GDD bullet.
- [x] Solo and room town both get the global board (`globalBoard` passed to both `openTown` calls in `src/app/main.ts`).

## Checks

Backend: `go test ./...` in `server/`. Client: `npm run typecheck`, `npx vitest run --testTimeout=30000`, `npm run build`, `npm run prove`.

## Decisions taken while implementing

- Players without a profile (or with an empty nickname) are skipped by the server, not shown with a placeholder: only already-public names appear (`server/README.md`, "Sima ranking").
- Guests make no request (the GDD promise "sin cuenta el juego no hace ninguna petición" stays true): a guest's board shows how to appear instead.
- The player's own row is matched by the online nickname in Settings (`settings.nickname`), the only nickname the client knows.
- Unknown difficulty values in a stored score are skipped by the server (the client reads them as easy; the server is stricter on purpose).

## Open issue (needs the owner)

- Nothing creates `profiles` records today: neither the client nor a server hook writes them (only `validateProfile` exists). With "skip players without a profile", the live ranking stays empty until profiles exist. Follow-up choice: the client upserts its profile (nickname + avatarSpecies) when signed in, or the server shows a neutral placeholder for players without one.

## Progress

Created 2026-10-28.

- T1 done: `36f8fd1` (mazmorra-backend, `feat/sima-ranking`). RED observed first (undefined symbols) for `internal/ranking` and `rankingapi`. `go test ./...` ok, `go vet ./...` clean. About 700 changed lines, mostly table tests and the route integration test; one coherent unit, not split.
- T2 done: `bcec027`. RED observed first for the adapter (3 failing tests) and `tests/town/global-ranking.test.ts` (module missing). `npm run typecheck` ok; `npx vitest run --testTimeout=30000` 262 files / 3280 tests passed; `npm run build` ok; `npm run prove` 166 cards survivable, 24/24 solver fights.
- Next: owner decision on the open issue above, then T3 (deploy, needs explicit authorization).
