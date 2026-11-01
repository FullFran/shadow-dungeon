# Google login

Objective: let a player sign in with Google from the account window. Branch: `feat/google-login`. Delivery: single-pr. Test runner: vitest.

## Specs

- S1: "habilitar el login con google" (L1).
- S2: "que todo entre en el plan gratuito" (L2).

## Tasks

- T1 (S1, inline): client redirect flow, account state, screen, i18n, tests, docs. Status: written; live Google check pending.
- T2 (S1, owner): create the Google OAuth client, then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the VPS. Status: pending.

## Parity checklist

- [x] Account API and account state: `tests/adapters/account-api.test.ts`, `tests/app/account.test.ts`.
- [x] i18n es/en: the account strings test covers the new errors and lines.
- [x] GDD (`docs/gdd.md`, Cuentas) and `server/README.md`.
- [x] Save/sync: sign-in goes through the same `adopt` path as a password login.
- [ ] Live sign-in against Google, on desktop and on a phone. Pending T2.
- [ ] Pending, not dropped: linking Google to an existing password account.
- [ ] Pending, not dropped: Twitch and Discord buttons (server already supports both).

## Log

- L1 (2026-11-01): "ahora tienes la cli de cf (cloudflare) ya puedes poner el r2 de los backups y ademas habilitar el login con google no?!"
- L2 (2026-11-01): "pero avisame, que todo entre en el plan gratuito"
- L3: `auth-methods` checked on a throwaway local server with fake credentials: the provider entry has `authURL`, `state`, `codeVerifier`.
