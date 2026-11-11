# Deploy details (state on 2026-11-11)

Source of truth: the infra repo (github.com/FullFran/infra): `agent/README.md` (how the agent deploys, failures, alerts), `apps/README.md` (registration, `ci` commands, secrets, volumes), `ansible/group_vars/vps.yml` (`deploy_agent_apps`: branch and strategy per app), `apps/sd-api/compose.yml`, `apps/sd-pre/compose.yml`. History: `odd/tasks/apps-to-git.md`, `odd/tasks/sd-preprod.md`.

## Production

- Client: GitHub Pages at `www.fullfran.com/shadow-dungeon/`. A push to `main` starts `.github/workflows/deploy.yml` by itself. Dispatch by hand (`gh workflow run deploy.yml -R FullFran/shadow-dungeon --ref main`) only if no run appears. A manual dispatch always runs the slow boss proofs (about 15 min).
- Backend `sd-api` (since 2026-11-05): deploy-agent on `vpscontavo` polls branch `main` every 2 min (systemd timer, no webhook). On a new commit it fetches, builds `server/` (its `Dockerfile`, image `sd-api:local`), then `up -d` with the recreate strategy (a few seconds of downtime). The commit counts as deployed only when build and `up` both succeed; a failed build keeps the old container serving and is retried on the next run, with a mail after 10 min of failures. There is no automatic rollback and no container healthcheck; an external watchdog probes `https://sd-api.fullfran.com/api/health`.
- Env comes from the infra secrets (`secrets/apps/sd-api.sops.env`); data lives in the external volume `sd-api_pb_data`, reused across deploys. A changed compose or env in the infra repo also redeploys.
- Forcing or restarting a deploy is admin-only: `ci deploy|restart sd-api --url https://ci.fullfran.com`, status with `ci deploys`.
- The old hand-run copy `/home/fran/shadow-dungeon-api` is retired: do not rsync to it or run `docker compose` there.
- The PocketBase admin UI is not public: only through an SSH tunnel to `127.0.0.1:8092`.
- Backups: PocketBase backup to R2 daily at 04:00 UTC (`SD_BACKUP_*`), plus the VPS-wide restic backup at 04:30. Whether restic covers the `sd-api_pb_data` volume is not confirmed.

## Preproduction (sd-pre)

- URL https://sd-pre.fullfran.com behind Cloudflare Access (email one-time code; owner and one collaborator) and a Cloudflare-only IP allowlist. Direct origin access is refused.
- Source: branch `preprod` of FullFran/shadow-dungeon. It is not protected: a collaborator pushes there freely.
- deploy-agent checks every 2 min and builds `api` (from `server/`, recreated) and `web` (the client, `VITE_API_URL=https://sd-pre.fullfran.com`, blue-green with a healthcheck: an unhealthy new web container is removed and the old one keeps serving). `api` has no healthcheck.
- Own empty volume `sd-pre_pb-data`, own network: sd-pre cannot reach prod, and migrations never run there on real data.
- TURN and SMTP use prod's Cloudflare TURN key and Resend account (owner's choice, infra eaee1bb); `SD_APP_URL` is sd-pre, so mail links point to pre. Its own `PB_ENCRYPTION_KEY`, no backups.
- Owned by the infra repo. Ask the infra session for changes; do not edit them from this repo.
