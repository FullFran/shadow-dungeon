# Shadow Dungeon API

The first backend for *Mazmorra Sombría / Shadow Dungeon*: accounts and one
cloud save per account. It is [PocketBase](https://pocketbase.io) **v0.40.6**
used as a Go framework (`github.com/pocketbase/pocketbase`), built into one
static binary.

v1 scope: users (email + password; OAuth2 later as "link account"), public
profiles and cloud saves. There are no
rankings, no replay verifier and no server wallet yet; the save stays
client-authoritative and the server only rejects absurd data
(`docs/backend-accounts-plan.md` sections 2–5 describe what comes later).
Guests keep playing without an account; that is all client-side.

## Layout

| Path | What it holds |
|---|---|
| `main.go` | Starts PocketBase, registers hooks and applies the environment on `serve` |
| `migrations/` | The schema as Go migrations (`users` changes, `profiles`, `saves`, then password accounts); never edit an applied one, add a new file |
| `internal/rules/` | Pure rules: save validation, revision check, nickname rules (table-driven tests) |
| `internal/hooks/` | Binds the rules to PocketBase events (integration tests with `pocketbase/tests`) |
| `internal/setup/` | Reads the environment: CORS, OAuth2 providers, rate limits, proxy headers |

## Collections

**`users`** (auth). Accounts use **email + password** (owner decision,
2026-10-26):

- Anyone can sign up (`createRule = ""`); a hook requires an email on a
  password sign-up (the field stays optional in the schema because OAuth2
  accounts have none).
- Passwords need at least 8 characters; a taken email answers 400.
- The email is private: `emailVisibility` is forced to `false` on sign-up and
  on every update by the owner, and nobody but the owner can list or view a
  user (`id = @request.auth.id`).
- **No email verification is required to sign in** (`authRule = ""`): there
  is no SMTP yet. `verified` stays `false` and the owner cannot set it.
- The owner can update and **delete their own account** (GDPR); deleting it
  deletes their profile and save (cascade).
- OAuth2 is still configured from the environment (below) and the provider's
  name and avatar are not copied. A hook clears the email the provider
  returns, so an OAuth2 account is identified only by the provider's user id
  (`_externalAuths`) and PocketBase never auto-links by matching email.

**`profiles`**: `user` (unique), `nickname`, `avatarSpecies`. Anyone can read;
only the owner creates or updates; only a superuser deletes. The nickname
must already be clean by the rules of `src/net/nickname.ts`: 1–16 characters,
no control, format (zero-width, bidi), unassigned or private-use characters,
no leading/trailing or repeated whitespace. The server rejects; it does not fix.

**`saves`**: `user` (unique), `data` (JSON), `version`, `rev`, `created`,
`updated`. Only the owner lists, views, creates and updates; only a superuser
deletes. On every create and update:

- `data` must be a JSON object of at most 64 KB.
- `version` must be a whole number from 1 to 99 (the client `SAVE_VERSION`)
  and equal `data.version`.
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

The client can bump `SAVE_VERSION` up to 99 without a server change
(`rules.MinSaveVersion`/`MaxSaveVersion`). The server does not migrate save
contents; reading an older version is the client's job.

## Web client API

Base URL `https://sd-api.fullfran.com` (locally `http://127.0.0.1:8090`).
With the PocketBase JS SDK (`pb = new PocketBase(BASE)`) or plain `fetch`;
`TOKEN` goes in the `Authorization` header as is (no `Bearer`).

| Action | SDK | HTTP |
|---|---|---|
| Sign up | `pb.collection('users').create({email, password, passwordConfirm: password})` | `POST /api/collections/users/records` `{"email","password","passwordConfirm"}` → 200 record (no token) |
| Log in | `pb.collection('users').authWithPassword(email, password)` | `POST /api/collections/users/auth-with-password` `{"identity":email,"password"}` → `{token, record}` |
| Refresh | `pb.collection('users').authRefresh()` | `POST /api/collections/users/auth-refresh` with `Authorization: TOKEN` → `{token, record}` |
| Get my save | `pb.collection('saves').getFirstListItem('user="'+id+'"')` | `GET /api/collections/saves/records?filter=(user='ID')` → `items[0]` or none |
| First save | `pb.collection('saves').create({user: id, data, version, rev: 0})` | `POST /api/collections/saves/records` → 200 with `rev: 1`, or 409 if one exists |
| Update save | `pb.collection('saves').update(saveId, {data, version, rev})` | `PATCH /api/collections/saves/records/SAVE_ID` with the `rev` it was based on → 200 `rev+1`, or 409 `data.current` |
| Delete account | `pb.collection('users').delete(id)` | `DELETE /api/collections/users/records/ID` with `Authorization: TOKEN` → 204; profile and save go with it |

Sign-up does not log in: call `auth-with-password` after it. Errors are
PocketBase's `{"status":400,"data":{"email":{"code":"validation_not_unique"}}}`
shape (`validation_min_text_constraint` for a short password,
`validation_required` for a missing email). A 429 means a rate limit.

## Email (no SMTP yet)

There is no SMTP server, so the API sends no email: **no verification, no
password reset, no email change**. A forgotten password can only be reset
by a superuser in the dashboard. To add it later:

1. Get SMTP credentials (for example Gmail with 2-step verification and an
   [app password](https://myaccount.google.com/apppasswords):
   host `smtp.gmail.com`, port 587, TLS, user = the Gmail address).
2. Read them in `internal/setup` from new variables (say `SD_SMTP_HOST`,
   `SD_SMTP_PORT`, `SD_SMTP_USERNAME`, `SD_SMTP_PASSWORD`, `SD_MAIL_FROM`)
   and write `settings.SMTP` and `settings.Meta.SenderAddress` in `Apply`,
   like the OAuth2 providers. Not implemented yet.
3. Then the client can call `requestPasswordReset` and `requestVerification`;
   only after that consider `authRule = "verified = true"` (a new migration).

## Linking OAuth2 later

PocketBase v0.40 already links instead of creating an account when the
OAuth2 request is signed in: `authWithOAuth2` called with the user's
`Authorization` header uses the signed-in account if no account owns that
provider id yet (`apis/record_auth_with_oauth2.go`). So "link account" needs
no custom route: the client calls `pb.collection('users').authWithOAuth2({provider})`
while `pb.authStore` holds the user's token. Things to settle before offering it:

- If the provider id already belongs to another account, PocketBase signs
  into that account instead; the client must detect that (returned record id
  differs) and tell the user.
- Accounts stay unverified without SMTP, and PocketBase keeps at most one
  provider link on an unverified account (linking a second one drops the
  first).
- `GET /api/collections/_externalAuths/records` lists a user's links;
  unlinking is `DELETE` on one of them (its default rules are owner-only).

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
go vet ./... && go test ./... && go test -race ./... && go build ./...
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
`*:auth` 10/min (log in, refresh, OAuth2), `users:create` 5 per 10 min
(sign-up), `saves:create` 10/min, `saves:update` 30/min, `*:create`
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
