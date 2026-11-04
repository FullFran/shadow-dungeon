# Clerk account drawer and menu redesign (pass 2)

Objective: sign-in moves to Clerk (Hagalink account, app "Mazmorra Sombria", `app_3LdjFMdOJJ7HxGu4S2DUHS8UBpR`, dev instance `ins_3LdjFInK6rcJMWH7daM6CjxpXqL`) behind a quick side drawer (email+password, Google, Discord, or play as guest with pros and cons); the install notice, Shrine, Mission board, Gallery and Friends windows get the relic picker treatment. Branch: `feat/title-hub`.
Delivery: work-unit commits, never push. Runner: `npx vitest run --testTimeout=30000` (game), `go test ./...` (server/). Design contract: `.agents/DESIGN.md`.

## Specs

- S1 owner (2026-11-04): "rediseña el aviso [install prompt], el santuario, el tablón, la galería, y la sección de amigos y cuenta".
- S2 owner: "quiero que integres clerk con clerk cli, aunque sea la org de hagalink no pasa nada, y haces un login rápido tipo drawer lateral y que puedas iniciar sesión con correo y contraseña, con google y discord, o jugar como invitado explicando un poco las desventajas y ventajas de tener la cuenta creada".
- S3 owner: "Eso ya lo hará él [Fran: production OAuth apps, backend deploy], procede a integrarlo todo ya con clerk".

## Architecture decision

Clerk is the identity provider; PocketBase stays the data store. The client signs in with clerk-js, then exchanges the Clerk session JWT for a PocketBase auth token:

- `POST /api/sd/clerk/session`, header `Authorization: Bearer <clerk session token>`, no body.
- 200 → same shape as PocketBase `auth-with-password` (`{ token, record }`), so `authSession` in `src/adapters/account-api.ts` parses it unchanged.
- Server verifies the JWT against the instance JWKS (`CLERK_SECRET_KEY`), reads the user's primary verified email from the Clerk Backend API, then: user with `clerk_id` → that user; else verified user with the same email → link (`clerk_id` set); else create (random password, `verified = true`).
- 401 invalid/expired token; 503 when `CLERK_SECRET_KEY` is unset (password endpoints keep working, so preprod/prod do not break before Fran configures Clerk).
- Client: Clerk path only when `VITE_CLERK_PUBLISHABLE_KEY` is set; otherwise the existing password flow. OAuth returns to `/?sso=1` (no extra route, the static server has no SPA fallback).

## Tasks

- T1 done (de27297, cherry-picked; go test/vet green; live 401 on a bad token with CLERK_SECRET_KEY set; real JWKS path untried until a real sign-in; extra statuses 409 email linked to another Clerk user, 502 Clerk unreachable; no `azp` check yet): server Clerk exchange endpoint + `clerk_id` field migration + tests. RED: `server/internal/hooks` (or new package) test for verify→link→create and 401/503.
- T2 delegated (worktree): client Clerk adapter (`src/adapters/clerk-auth.ts`), account drawer (email+password with sign-up email code, Google, Discord, guest with pros/cons), Friends window redesign. RED: adapter and drawer model tests.
- T3 delegated (worktree): install notice + Gallery redesign. RED: view-model tests.
- T4 delegated (worktree): Shrine + Mission board redesign. RED: view-model tests.
- T5 inline: merge worktrees, i18n parity, GDD, DESIGN.md decision log, full gate.

## Parity checklist

- [ ] es/en strings for every new label (i18n parity test)
- [ ] Every shrine trial (Reflejos, Desafíos) and every board mission kind rendered by the new views (tests iterate data)
- [ ] Every gallery scene (prologue, Sima, every Senda, Guardianes) in the new gallery (test iterates `galleryGroups`)
- [ ] Solo and co-op: signed-in email flows to friends heartbeat and cloud sync unchanged
- [ ] Save/migrate untouched (auth token shape unchanged)
- [ ] Touch layout 844x390 and keyboard/gamepad focus for the drawer and every redesigned window
- [ ] GDD account section updated; `.agents/DESIGN.md` drawer pattern + decision log
- [ ] typecheck, vitest, build, prove; `go test ./...`

## Pending for the owner / Fran

- Production Clerk instance (`clerk deploy`) with own Google and Discord OAuth apps; dev instance uses Clerk shared credentials.
- `CLERK_SECRET_KEY` on preprod/prod server, `VITE_CLERK_PUBLISHABLE_KEY` in the build.

## Log

- L1 (2026-11-04): S1, S2 with screenshots of install notice, shrine, board, gallery, friends, account.
- L3 (2026-11-04, T2 client): `@clerk/clerk-js` 6.42.1 (exact) behind `src/adapters/clerk-auth.ts`; `Account.logInClerk` + `clerkSession` exchange; `src/app/auth-flow.ts`; account side drawer (`src/app/account-drawer.ts`, replaces the account window; Account, Options, Settings, Friends and the hub plate all open it); Friends window redesigned (`src/app/friends-window.ts`); provider icons in `src/ui/icons/account-icons.ts` (own file, to avoid conflicts on `pixel-icons.ts`). Parity: es/en strings (i18n test green), drawer and friends keyboard/touch checked at 1440x900, 1366x768, 844x390, 390x844 with zero page scroll and zero inner scroll on the drawer. Not run: a real Clerk round trip (no dev key in this worktree; needs `.env.local` and the server endpoint of T1).
- L2 (2026-11-04): asked Clerk vs native PocketBase OAuth; owner chose Clerk (S3). Clerk app created and linked with `clerk` CLI; Discord enabled, password min length 8; keys in `.env.local` (now gitignored).
- L3 (2026-11-04, T4): Santuario and Tablón rebuilt as picker windows (`src/app/shrine.ts`, `src/app/board.ts`, pure models `shrine-hall.ts` and `board-view.ts`, shared `src/ui/hall-nav.ts` and `src/styles/hall.css`). Tests iterate every `SHRINE_BOSSES`, `GAUNTLETS` and mission kind. Added `abandonMission`/`abandonAt` for the new Abandonar action (confirm dialog); accept limits, rewards and records untouched. Shrine heralds stay as a third tab once met.
