---
name: deploy-and-branches
description: "Trigger: deploy, desplegar, release, preprod, sd-pre, merge to main, sd-api, rama, branches. Branch flow and deploy steps for Mazmorra Sombría (Pages, sd-pre, sd-api)."
license: Apache-2.0
metadata:
  author: "FullFran"
  version: "1.0"
---

## Activation Contract

Load before merging or pushing `main` or `preprod`, cutting a release, deploying `server/`, or answering how deploys and branches work here.

## Hard Rules

- Pushing `main` or `preprod` deploys by itself. Do it only on the owner's explicit request, never as a side effect.
- Merging to `main` is the production deploy of both halves: the client through `deploy.yml` (GitHub Pages) and `sd-api` through deploy-agent on the VPS, which polls `main` every 2 min, builds `server/` and recreates the container. Never deploy `sd-api` by hand (no rsync, no `docker compose -p sd-api`): it would fight the agent.
- Branch flow: feature branch from `main` → merge into `preprod` → check https://sd-pre.fullfran.com → merge `preprod` into `main`. After anything lands on `main` directly (hotfix, release), bring it into `preprod` (fast-forward when `preprod` has nothing of its own, else ask the owner).
- Run the deploy gate green before merging into `main`: `npm run typecheck`, `npx vitest run --testTimeout=30000`, `npm run build`, `npm run prove`.
- Client and `server/` deploy independently on the same merge (the API lands up to ~4 min after the push), so a `server/` change must keep working with the previous client, and the client must tolerate the previous API for a few minutes. A change that cannot: land `server/` on `main` first, then the client in a later merge.
- PocketBase migrations run on prod data when the new `sd-api` container starts; sd-pre starts empty, so it never exercises them on real data. Before a migration that changes existing data, ask the owner about a fresh backup.
- Never touch `/etc/deploy-agent`, `/var/lib/deploy-agent`, the `sd-pre-*` and `sd-api-*` containers, the `sd-api_pb_data` volume, `secrets/*.sops.env`, `~/grant-sudo.sh`, `dokploy-traefik`, or Access/DNS outside the infra repo's tofu. Env, secrets and compose changes belong to the infra repo (ask the infra session).
- Server code must run read-only except `/pb_data` and `/tmp`, within 512 MiB (sd-pre limits).

## Decision Gates

| Change | Do |
|--------|----|
| Client, `server/` or both | `preprod` → check sd-pre → gate → merge to `main` (both deploy by themselves) |
| `server/` change the old client cannot live with | merge `server/` to `main` first, client in a later merge |
| Env, secrets, compose, build context | infra repo (`apps/sd-api`, `apps/sd-pre`), not here |
| TURN co-op, sign-up mail | test on sd-pre (same TURN and Resend as prod; mail links point to pre) |
| Release | follow `docs/release.md` (version, `src/data/changelog.ts`, gate, GitHub Release) |

## Execution Steps

1. `git fetch`; compare `origin/main` and `origin/preprod`. `preprod` may be ahead with a collaborator's work under test: never fast-forward or reset it over that work, and follow the `preprod` branch's own `CLAUDE.md` (`npm run deploy:preprod`, ask the owner before every preprod deploy).
2. Merge the feature branch into `preprod`, push, and wait about 2 min: deploy-agent builds both services; a failed build keeps the old version. The title shows `v<version> · <commit>`.
3. Ask the owner to check sd-pre (Cloudflare Access, email code).
4. Pick the row above; run the gate; merge to `main`; watch `gh run list -R FullFran/shadow-dungeon --workflow deploy.yml`.
5. If `server/` changed, wait a few minutes and check `https://sd-api.fullfran.com/api/health` (200). A failed build keeps the old container and retries every 2 min; forcing a redeploy is admin-only (`references/deploy-details.md`).
6. If the gate's vitest aborts with `Timeout calling "onTaskUpdate"` while every test passed, the machine is overloaded: rerun with `--maxWorkers=4`.

## Output Contract

Report the commits on `preprod` and `main`, each deploy's result (Pages run id, `sd-api` health, title version), which checks the owner still has to do on sd-pre, and any rule above that was skipped and why.

## References

- `references/deploy-details.md`: hosts, paths, commands, preprod facts.
- `docs/release.md`: release steps and patch notes.
- `server/README.md`: backend config, backups, tickets.
