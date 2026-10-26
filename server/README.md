# Shadow Dungeon API

The first backend for *Mazmorra Sombría / Shadow Dungeon*: accounts and one
cloud save per account. It is [PocketBase](https://pocketbase.io) **v0.40.6**
used as a Go framework (`github.com/pocketbase/pocketbase`), built into one
static binary.

v1 scope: users (OAuth2 only), public profiles and cloud saves. There are no
rankings, no replay verifier and no server wallet yet; the save stays
client-authoritative and the server only rejects absurd data
(`docs/backend-accounts-plan.md` sections 2–5 describe what comes later).
Guests keep playing without an account; that is all client-side.

## Layout

| Path | What it holds |
|---|---|
| `main.go` | Starts PocketBase, registers hooks and applies the environment on `serve` |
| `migrations/` | The schema as Go migrations (`users` changes, `profiles`, `saves`) |
| `internal/rules/` | Pure rules: save validation, revision check, nickname rules (table-driven tests) |
| `internal/hooks/` | Binds the rules to PocketBase events (integration tests with `pocketbase/tests`) |
| `internal/setup/` | Reads the environment: CORS, OAuth2 providers, rate limits, proxy headers |

## Collections

**`users`** (auth). OAuth2 is the only sign-in method: password sign-in is
off, direct sign-up is closed (`createRule = null`), `email` is optional and
the provider's name and avatar are not copied. A hook clears the email the
provider returns, so no email is stored; the account is identified by the
provider's user id, which PocketBase keeps in `_externalAuths`. A user can
delete their own account; that deletes their profile and save (cascade).

**`profiles`**: `user` (unique), `nickname`, `avatarSpecies`. Anyone can read;
only the owner creates or updates; only a superuser deletes. The nickname
must already be clean by the rules of `src/net/nickname.ts`: 1–16 characters,
no control, format (zero-width, bidi), unassigned or private-use characters,
no leading/trailing or repeated whitespace. The server rejects; it does not fix.

**`saves`**: `user` (unique), `data` (JSON), `version`, `rev`, `created`,
`updated`. Only the owner lists, views, creates and updates; only a superuser
deletes. On every create and update:

- `data` must be a JSON object of at most 64 KB.
- `version` must be a known client `SAVE_VERSION` (1–3) and equal `data.version`.
- `data.coins` must be a whole number from 0 to 1,000,000,000.
- **Optimistic concurrency:** the request must send `rev`, the revision it
  was based on (0 for the first save). If it matches the stored one, the
  server stores `rev + 1`. If not, it answers **409** with the stored save:

  ```json
  {"status":409,"message":"...","data":{"current":{"id":"...","rev":4,"data":{...}}}}
  ```

  A second "first save" (`POST` when one exists) also answers 409 this way.
  The check runs inside the write transaction, so concurrent writes cannot
  both win.

When the client bumps `SAVE_VERSION`, add the number to
`rules.KnownSaveVersions` and deploy the server first.

## Run locally

Requires Go 1.27 or newer (`go.mod` says `go 1.27`; an older `go` downloads
the toolchain on first use).

```sh
cd server
go run . serve                       # http://127.0.0.1:8090, data in ./pb_data
go run . superuser upsert you@example.com 'a-long-password'
```

The dashboard is at <http://127.0.0.1:8090/_/>. Health:
`curl http://127.0.0.1:8090/api/health`. Locally, leave
`SD_TRUSTED_PROXY_HEADERS` empty.

Checks:

```sh
go vet ./... && go test ./... && go build ./...
docker build -t sd-api:local .
```

## Environment

See `.env.example`. Everything is read at start; the dashboard values for
these settings are overwritten on the next start.

| Variable | Default | Meaning |
|---|---|---|
| `PB_ENCRYPTION_KEY` | empty | 32 characters; encrypts stored settings (OAuth2 secrets). Set it in production |
| `SD_ALLOWED_ORIGINS` | `https://www.fullfran.com,http://localhost:5173` | CORS origins (passed to `serve --origins` unless you pass the flag yourself) |
| `SD_TRUSTED_PROXY_HEADERS` | empty | Client-IP headers to trust; `X-Real-IP` behind Traefik |
| `SD_RATE_LIMITS` | on | `off` disables the built-in limiter |
| `TWITCH_CLIENT_ID` / `_SECRET` | empty | Twitch OAuth2, enabled when both are set |
| `DISCORD_CLIENT_ID` / `_SECRET` | empty | Discord OAuth2, same |
| `GOOGLE_CLIENT_ID` / `_SECRET` | empty | Google OAuth2, same |

Rate limits (PocketBase's built-in limiter, per IP or per user):
`*:auth` 10/min, `saves:create` 10/min, `saves:update` 30/min, `*:create`
20/min, `/api/batch` 3/s (batch is disabled anyway), `/api/` 300 per 10 s.

## OAuth2 apps

Register one app per provider with the redirect URL
**`https://sd-api.fullfran.com/api/oauth2-redirect`** (for local tests also
`http://127.0.0.1:8090/api/oauth2-redirect`), then put the client id and
secret in the environment.

PocketBase asks for these scopes by default; the client can ask for fewer
with the JS SDK's `scopes` option, and the server drops the email either way.

| Provider | Console | Default scopes | Minimal scopes to pass from the client | What it returns |
|---|---|---|---|---|
| Twitch | dev.twitch.tv/console/apps (category "Game Integration") | `user:read:email` | `[]` | id, login, display name, avatar; email only with the scope |
| Discord | discord.com/developers/applications → OAuth2 | `identify email` | `['identify']` | id, username, avatar; email only with `email` |
| Google | console.cloud.google.com → APIs & Services → Credentials (OAuth client, "Web application") | `userinfo.profile userinfo.email` | `['openid']` | `sub` id; name, avatar and email only with their scopes |

The minimal scopes still need a live check against each provider (not done
here). Read the Twitch developer agreement before registering the app
(plan section 4.5).

## Deploy (each remote step needs the owner's explicit authorization)

Nothing here has been deployed. The plan is `docs/backend-accounts-plan.md`
section 5.4:

1. DNS: `A`/`AAAA` record `sd-api.fullfran.com` → the VPS.
2. Create the three OAuth2 apps (above) and a `PB_ENCRYPTION_KEY`
   (`openssl rand -hex 16`); keep them as secrets (SOPS/age as in `vps-infra`).
3. In Dokploy, create a Compose service from this directory
   (`docker-compose.yml`), with the variables of `.env.example` in its
   environment. The service joins the external `dokploy-network`, publishes
   no port, and Traefik routes `sd-api.fullfran.com` on `websecure` with the
   `letsencrypt` certresolver. Check the certresolver name against the
   Traefik config on the VPS before the first deploy.
4. Deploy, then check `https://sd-api.fullfran.com/api/health` and the certificate.
5. Create the superuser from the CLI, not from the install link printed in
   the first log lines:
   `docker exec -it <container> sd-api superuser upsert EMAIL PASS --dir=/pb_data`.
6. Point the client build at the API and publish it (separate decision).

## Backups

All state is the `pb_data` volume (SQLite). Off-site backups to R2 are
blocked until R2 is activated (`vps-infra` T3). Until then, use PocketBase's
built-in backups (dashboard → Settings → Backups, with a cron) and copy the
archives off the VPS; a backup is only proven once it restores locally.
Do not copy `data.db` while the server is running.
