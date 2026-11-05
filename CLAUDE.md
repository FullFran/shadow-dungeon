# Mazmorra Sombría: project rules for agents

## Integration rule (mandatory)

New content must be woven into everything that already exists. A feature is not done while old content of the same kind lacks it.

- When a new system lands (evolutions, challenges, skins, move tiers, rank effects, co-op rules, save fields...), apply it to every existing instance it concerns: all playable species (starters and gacha lines), all dungeons (main, challenges, Sima/endless, shrine), solo and co-op, save/migrate/sanitize, net protocol, i18n es/en, GDD (`docs/gdd.md`), sim/prove harnesses.
- When new content lands (a species, a dungeon, a boss), give it everything the existing content of the same kind has: full movepool (learnset, tutor offers, tiers, rank effects, builds), evolutions, challenge dungeon, sprites (normal and shiny), lore lines, i18n.
- Prefer tests that iterate over every instance (`PLAYABLE_SPECIES`, `DUNGEONS` plus `CHALLENGES`, every boss) so a missing piece fails a test instead of passing silently.
- Every feature document (`odd/tasks/*.md`) carries a "Parity checklist" section listing each existing area the change must reach, ticked with evidence before the feature closes.
- Never drop a planned item (for example, shiny skins from `docs/gacha-roster-plan.md`) without the owner's explicit approval; if scope is cut for simplicity, list the cut items as pending, not as out of scope.

## Preproduction

- Environment: https://sd-pre.fullfran.com, behind Cloudflare Access (owner and Álvaro's emails only; a plain curl gets the Access login redirect, not the API). Its own empty database, separate from production (`sd-api.fullfran.com`): test accounts are fine there; it never holds production accounts or saves. Sign-in is Clerk (development instance: Google, Discord, email and password); mail goes out through production's Resend account. When the Access session expires, API calls are redirected to the Access login and fail as CORS errors (the game shows "Sin conexión"): reload the page to log in again.
- Deploy branch: `preprod` on FullFran/shadow-dungeon. The server polls it every 2 minutes and builds the game (`npm run build` with `VITE_API_URL=https://sd-pre.fullfran.com` and the Clerk publishable key) and `server/`; `/api/` and `/_/` go to the backend, the rest to the game. A failed build keeps the previous version.
- Flow: work branch → `npm run deploy:preprod -- --yes` (deploy gate, then fast-forwards `preprod` to the branch) → test on sd-pre → merge to `main` when it is good.
- Class names must never start with `ad-`: ad blockers hide them (tests/ui/adblock-safe-classes.test.ts).
- Pushing to `preprod` publishes to a shared environment: ask the user before running the deploy, every time. No SSH or server logs; test the API locally (`server/`, `go run . serve`) or with an Access service token.

## Conventions

- Code, identifiers, comments, commits in English; player-facing text in `src/i18n/es.json` (Spanish, peninsular) and `en.json`; GDD in Spanish.
- Conventional Commits, explicit paths in `git add`, no AI attribution.
- Deploy gate: `npm run typecheck`, `npx vitest run --testTimeout=30000`, `npm run build`, `npm run prove` all green.
- Backend lives in `server/` (Go, PocketBase as a framework).

## Deploys and branches

Before merging or pushing `main` or `preprod`, cutting a release or deploying `server/`, read `skills/deploy-and-branches/SKILL.md`.
