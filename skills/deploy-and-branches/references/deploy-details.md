# Deploy details (state on 2026-11-03)

## Production

- Client: GitHub Pages at `www.fullfran.com/shadow-dungeon/`. A push to `main` starts `.github/workflows/deploy.yml` by itself. Dispatch by hand (`gh workflow run deploy.yml -R FullFran/shadow-dungeon --ref main`) only if no run appears. A manual dispatch always runs the slow boss proofs (about 15 min).
- Backend `sd-api`: SSH host `vpscontavo` (Tailscale SSH; the first connection may need the owner to approve a browser check). Files in `/home/fran/shadow-dungeon-api` (plain files, not git). `superuser.txt` and `.env` live only there.
  ```sh
  # from the repo's server/ directory
  rsync -aic --exclude .env --exclude pb_data --exclude .git ./ vpscontavo:/home/fran/shadow-dungeon-api/
  ssh vpscontavo 'cd /home/fran/shadow-dungeon-api && docker compose -p sd-api up -d --build'
  curl -s https://sd-api.fullfran.com/api/health
  ```
  Without `-p sd-api`, compose creates a second project with an empty volume.
- Backups: PocketBase backup to R2 daily at 04:00 UTC (`SD_BACKUP_*`), plus the VPS-wide restic backup at 04:30.

## Preproduction (sd-pre)

- URL https://sd-pre.fullfran.com behind Cloudflare Access (email one-time code; owner and one collaborator). Direct origin access is refused.
- Source: branch `preprod` of FullFran/shadow-dungeon. It is not protected: a collaborator pushes there freely.
- deploy-agent on the VPS checks every 2 min, builds `server/` (api) and the client (web, `VITE_API_URL=https://sd-pre.fullfran.com`), and runs `up -d` for compose project `sd-pre`. There is no health gate and no rollback: a container that builds but fails at startup stays broken.
- Own empty volume `sd-pre_pb-data`, own network: sd-pre cannot reach prod.
- No OAuth, SMTP or TURN yet. The owner has not yet decided on separate credentials for pre.
- Owned by the infra repo (github.com/FullFran/infra: `apps/sd-pre/compose.yml`, `odd/tasks/sd-preprod.md`, `odd/tasks/apps-to-git.md`, `agent/README.md`). Ask the infra session for changes; do not edit them from this repo.

## Planned

- `sd-api` moves to deploy-agent (infra `apps-to-git.md`, step 5). When it lands, the manual backend steps and the version-skew rule change: update this skill.
