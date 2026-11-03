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
- Branch flow: feature branch from `main` → merge into `preprod` → check https://sd-pre.fullfran.com → merge `preprod` into `main`. After anything lands on `main` directly (hotfix, release), fast-forward `preprod` to `main`.
- Run the deploy gate green before merging into `main`: `npm run typecheck`, `npx vitest run --testTimeout=30000`, `npm run build`, `npm run prove`.
- Prod `sd-api` never deploys itself. A change touching both the client and `server/`: deploy `sd-api` by hand FIRST, then merge to `main` (the client on Pages would call an old API otherwise).
- `sd-api` by hand: always `docker compose -p sd-api`; rsync without `--delete`; before a data migration stop it and tar `sd-api_pb_data` into `/home/fran/backups/`.
- Never touch `/etc/deploy-agent`, `/var/lib/deploy-agent`, the `sd-pre-*` containers, `secrets/*.sops.env`, `~/grant-sudo.sh`, `dokploy-traefik`, or Access/DNS outside the infra repo's tofu. sd-pre credentials are the infra session's job.
- Server code must run read-only except `/pb_data` and `/tmp`, within 512 MiB (sd-pre limits).

## Decision Gates

| Change | Do |
|--------|----|
| Client only | `preprod` → check sd-pre → merge to `main` (Pages deploys) |
| `server/` only | `preprod` → check sd-pre → merge to `main` → deploy `sd-api` by hand |
| Client + `server/` | `preprod` → check sd-pre → deploy `sd-api` by hand → merge to `main` |
| TURN co-op, sign-up mail | test on sd-pre (same TURN and Resend as prod; mail links point to pre) |
| OAuth login | not configured in prod nor pre: no provider apps exist yet |
| Release | follow `docs/release.md` (version, `src/data/changelog.ts`, gate, GitHub Release) |

## Execution Steps

1. `git fetch`; confirm `preprod` is an ancestor of `main` (`git merge-base --is-ancestor origin/preprod origin/main`) or that the gap is intended.
2. Merge the feature branch into `preprod`, push, and wait about 2 min: deploy-agent builds both services; a failed build keeps the old version. The title shows `v<version> · <commit>`.
3. Ask the owner to check sd-pre (Cloudflare Access, email code).
4. Pick the row above; run the gate; merge to `main`; watch `gh run list -R FullFran/shadow-dungeon --workflow deploy.yml`.
5. For `sd-api`, follow `references/deploy-details.md`, then check `https://sd-api.fullfran.com/api/health`.

## Output Contract

Report the commits on `preprod` and `main`, each deploy's result (run id, health, title version), which checks the owner still has to do on sd-pre, and any rule above that was skipped and why.

## References

- `references/deploy-details.md`: hosts, paths, commands, preprod facts.
- `docs/release.md`: release steps and patch notes.
- `server/README.md`: backend config, backups, tickets.
