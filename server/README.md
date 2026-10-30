# Shadow Dungeon API

The first backend for *Mazmorra Sombría / Shadow Dungeon*: accounts and one
cloud save per account. It is [PocketBase](https://pocketbase.io) **v0.40.6**
used as a Go framework (`github.com/pocketbase/pocketbase`), built into one
static binary.

v1 scope: users (email + password; OAuth2 later as "link account"), public
profiles, cloud saves and a public Sima ranking derived from those saves
(unverified). There is no replay verifier and no server wallet yet; the save stays
client-authoritative and the server only rejects absurd data
(`docs/backend-accounts-plan.md` sections 2–5 describe what comes later).
Guests keep playing without an account; that is all client-side.

## Layout

| Path | What it holds |
|---|---|
| `main.go` | Starts PocketBase, registers hooks and applies the environment on `serve` |
| `migrations/` | The schema as Go migrations (`users` changes, `profiles`, `saves`, password accounts, then `reports`); never edit an applied one, add a new file |
| `internal/rules/` | Pure rules: save validation, revision check, nickname rules (table-driven tests) |
| `internal/hooks/` | Binds the rules to PocketBase events (integration tests with `pocketbase/tests`) |
| `internal/setup/` | Reads the environment: CORS, OAuth2 providers, rate limits, proxy headers, SMTP and the email templates (`mail.go`) |
| `internal/ranking/` | Pure Sima ranking rule over the saves (table-driven tests); `rankingapi/` serves it |
| `internal/reports/` | Bug report fields and limits; `reportsapi/` serves `POST /api/sd/reports`, `reportsadmin/` the admins' routes, `reportmail/` announces new reports |
| `internal/lore/` | The embedded lore (`data/`) and its pure index and search; `loreapi/` serves it over HTTP |
| `tools/sync-lore.sh` | Copies the lore from the game repo into `internal/lore/data/` |
| `tools/report-to-issue.sh` | Renders an exported bug report as a GitHub issue body (offline) |
| `skills/lore/` | Claude Code skill (`lore-sima`) that queries the lore API |

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
- **No email verification is required to sign in** (`authRule = ""`, for
  now). With SMTP on, sign-up sends a verification email and the account
  becomes `verified` when the link is opened; the owner cannot set
  `verified` any other way.
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
The game client writes its own profile while signed in (after each cloud
sync: the online nickname from Settings and the species played; nothing
when the nickname is empty), so the Sima ranking can name the player.

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

## Sima ranking (public, read-only)

`GET /api/sd/ranking/sima?tier=easy|normal|hard|nightmare` (no auth; the
tier defaults to `easy`, the client's `DEFAULT_DIFFICULTY`; any other tier
is 400). The route reads every `profiles` and `saves` record with app-level
access (the collection rules stay owner-only) and builds, for that tier,
each player's best score from `saves.data.profile.board` (the client's
`ScoreEntry[]`): deeper floor first, then more time left (`clockMs`), top
50. Both modes (daily and free) count; a score without `difficulty` is easy.

```json
{"tier":"easy","entries":[{"rank":1,"nickname":"Ana","avatarSpecies":"zorua","floor":9,"clockMs":500,"species":"zorua","level":14,"mode":"daily","date":"2026-10-25"}]}
```

- Only these fields leave the server: no raw save data, emails or user ids.
- A player without a profile (or with an empty nickname) is **skipped**:
  the ranking only shows names that are already public. Guests never appear.
- A malformed save, board or entry (wrong types, a floor below 1 or not a
  whole number, an unknown mode or tier) is skipped; it never fails the route.
- Ties between players order by nickname, then user id (stable).
- Each tier's answer is cached in memory for 60 s (and sent with
  `Cache-Control: public, max-age=60`), so the saves are read at most once a
  minute per tier. It is client-authoritative data: friends-scale and
  unverified (the verified replay ranking of `docs/backend-accounts-plan.md`
  stays the long-term plan).

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
| Resend verification | `pb.collection('users').requestVerification(email)` | `POST /api/collections/users/request-verification` `{"email"}` → 204 (always, even for an unknown email) |
| Forgot password | `pb.collection('users').requestPasswordReset(email)` | `POST /api/collections/users/request-password-reset` `{"email"}` → 204 (always) |
| Change email | `pb.collection('users').requestEmailChange(newEmail)` | `POST /api/collections/users/request-email-change` `{"newEmail"}` with `Authorization: TOKEN` → 204 |
| Delete account | `pb.collection('users').delete(id)` | `DELETE /api/collections/users/records/ID` with `Authorization: TOKEN` → 204; profile and save go with it |

Sign-up does not log in: call `auth-with-password` after it. Errors are
PocketBase's `{"status":400,"data":{"email":{"code":"validation_not_unique"}}}`
shape (`validation_min_text_constraint` for a short password,
`validation_required` for a missing email). A 429 means a rate limit.

## Lore (public, read-only)

The game's lore is served from the same binary, read-only and **public on
purpose for now** (owner decision, 2026-10-27: public while the lore is
being built, to be made private later). It reads only embedded files and
never touches PocketBase collections.

| Route | What it returns |
|---|---|
| `GET /lore` | The lore bible as an HTML page (index, anchors, "Cómo consultar") |
| `GET /lore/grafo` | The offline lore graph viewer, as is |
| `GET /lore/buenas-practicas` | The best-practice notes as an HTML page |
| `GET /api/lore/context?q=...&k=8` | Graph RAG: top `k` matching nodes (max 25) plus 1-hop neighbours, their edges, the bible sections that match or mention them (≤ 6,000 characters of section text) and `context`, a plain-text bundle with sources and canon tiers (≤ 14,000 characters) |
| `GET /api/lore/node/{id}?depth=1\|2` | A node, its neighbours, edges and the sections that mention it; 404 for an unknown id |
| `GET /api/lore/search?q=` | Ranked node labels and section headings, for autocomplete |
| `GET /api/lore/graph` | `lore-graph.json` as is |
| `GET /api/lore/doc/{lore\|buenas-practicas}` | The markdown as is |
| `GET /api/lore/meta` | Counts, data version (hash of the embedded files), source ref and commit |

Matching folds case and accents ("craneo" finds «cráneo») and scores with
BM25. Every answer carries an `ETag` and `Cache-Control` (5 min for pages
and raw data, 1 min for queries); a missing or over-300-character `q` is 400.
The pages load Mermaid 10.9.1 from cdnjs (pinned, with SRI) for the map; the
graph viewer needs nothing external.

The source of truth is `docs/lore/` in the game repo, branch
`docs/lore-bible`. After changing it there:

```sh
tools/sync-lore.sh                      # from docs/lore-bible (or --ref REF, --repo PATH)
tools/sync-lore.sh --worktree           # from the game repo's working tree
go test ./internal/lore/...             # then commit internal/lore/data/ and redeploy
```

The synced copies are committed so the Docker build needs nothing outside
`server/` (`.dockerignore` lets `internal/lore/data/*.md` through).

## Email (Resend SMTP)

Outgoing email goes through [Resend](https://resend.com) SMTP, configured
from the environment (`SD_SMTP_*`, `SD_MAIL_*`, `SD_APP_*`, see below) and
applied on every start. **SMTP is on only when `SD_SMTP_HOST`,
`SD_SMTP_PASSWORD` and `SD_MAIL_FROM_ADDRESS` are all set**; anything less
keeps it off (the start log warns about a partial setup) and the API sends
no email, so a forgotten password can only be reset by a superuser.

With SMTP on:

- **Sign-up sends the verification email** (a hook, right after the account
  is created; a failed send is logged and the sign-up still succeeds, the
  client can ask again with `request-verification`).
- The game's "I forgot my password" and "Change password" rows both use
  `request-password-reset`. The link opens PocketBase's own page (`/_/`), in
  English. Changing the password logs every device out.
- `request-verification`, `request-password-reset` and `request-email-change`
  send their emails (PocketBase sends these in the background and answers 204
  whether or not the email exists).
- The login alert ("new sign-in from a new place") is on; with SMTP off it is off.

The templates (verification, password reset, email change, one-time code
and login alert) are short Spanish + English texts set on the `users`
collection in `internal/setup/mail.go` on every start, so dashboard edits
are overwritten. Their buttons open **PocketBase's built-in confirmation
pages** at `SD_APP_URL` (`/_/#/auth/confirm-verification/TOKEN`,
`/_/#/auth/confirm-password-reset/TOKEN`, `/_/#/auth/confirm-email-change/TOKEN`):
they work for any auth collection, ask for the new password themselves and
need no page in the game. `SD_APP_URL` must therefore be the public API URL
(`/_/` must be reachable through Traefik). A game-side page can replace them
later by changing the links and calling `confirm-verification` /
`confirm-password-reset` with the token.

Unverified accounts can still sign in. Requiring verification later is a
new migration (`authRule = "verified = true"`).

### Resend setup (once)

1. In Resend → **Domains**, add `fullfran.com` (or a subdomain such as
   `mail.fullfran.com` to keep its reputation separate) and pick a region.
2. In Cloudflare → DNS for `fullfran.com`, add exactly the records Resend
   shows: the DKIM `TXT` (`resend._domainkey`), the SPF `MX` and `TXT` on the
   `send` subdomain, and optionally a DMARC `TXT` (`_dmarc`, e.g.
   `v=DMARC1; p=none;`). Set them **DNS only** (grey cloud), then press
   **Verify** in Resend and wait until the domain is "Verified".
3. In Resend → **API Keys**, create a key with permission **Sending access**
   restricted to that domain (not "Full access"). Copy it once.
4. Put it in the server `.env` (never in git):

   ```dotenv
   SD_SMTP_HOST=smtp.resend.com
   SD_SMTP_PORT=465
   SD_SMTP_USERNAME=resend
   SD_SMTP_PASSWORD=re_...            # the API key
   SD_MAIL_FROM_ADDRESS=no-reply@fullfran.com
   SD_APP_URL=https://sd-api.fullfran.com
   ```

5. Restart the service (`docker compose up -d` or redeploy in Dokploy); the
   start log shows `smtp=true`. Test it with a sign-up or a
   `request-password-reset` to an address you own. Port 465 uses implicit
   TLS; for 587 set `SD_SMTP_PORT=587` (STARTTLS, `SD_SMTP_TLS` defaults to
   false there).

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
- Accounts stay unverified until their email is confirmed (needs SMTP), and
  PocketBase keeps at most one provider link on an unverified account
  (linking a second one drops the first).
- `GET /api/collections/_externalAuths/records` lists a user's links;
  unlinking is `DELETE` on one of them (its default rules are owner-only).

## Co-op TURN relay (Cloudflare Realtime)

`GET /api/sd/turn` answers `{"iceServers": [...]}` for co-op rooms. Browsers that cannot reach each other directly (strict NAT, mobile data, privacy settings) are relayed through Cloudflare's TURN. Without a key, or when Cloudflare fails, it answers an empty list and co-op stays direct-only.

- **Key:** `CF_TURN_KEY_ID` and `CF_TURN_API_TOKEN` in `.env` (Cloudflare dashboard: Realtime > TURN Server). They are long-lived secrets that never leave the server.
- **Credentials:** one per request, valid 2 h.
- **Limits:** 10 requests per IP every 10 minutes (rate-limit rule `/api/sd/turn`), and at most `MaxPerHour` (120) credentials per hour across all clients. Past either limit the client gets no relay.
- **Monitoring:**
  - Cloudflare dashboard, Realtime > TURN: usage. The free allowance is 1,000 GB/month, then $0.05/GB.
  - PocketBase logs (dashboard > Logs; they are stored in `pb_data`, not printed by `docker logs`): `turn credential issued`, `turn credentials capped` and `turn credentials unavailable` entries. Each issued entry has the credential `username` and a hash of the client IP under a key that is random per server run.
- **Revoke one credential:** `POST https://rtc.live.cloudflare.com/v1/turn/keys/<key id>/credentials/<username>/revoke` with the API token as Bearer (see the Cloudflare Realtime docs).
- **Kill switch:** remove both `CF_TURN_*` lines from `.env` and restart the service. Co-op keeps working direct-only. Rotating the key in the dashboard also invalidates every credential issued from it.

## Bug reports

Players report problems from the game (title menu and pause menu, "Reportar un problema"). Reports are anonymous and private: nothing becomes a public GitHub issue on its own; the owner reads each one and decides (issue #9).

**Route.** `POST /api/sd/reports` with a JSON body of at most 32 KB:

| Field | Rule |
|---|---|
| `category` | required: `bug`, `online`, `performance`, `interface`, `progress`, `suggestion` or `other` |
| `description` | required, at most 2000 characters |
| `steps` | optional, at most 2000 |
| `expected`, `observed` | optional, at most 1000 each |
| `version` | optional, at most 40 (game version) |
| `device` | optional, at most 200 (coarse browser / OS / touch summary) |
| `diagnostics` | optional JSON object, at most 16 KB |
| `website` | honeypot: must be empty. If filled, the route answers success with a made-up ref and stores nothing |

Text is trimmed and control characters are dropped; unknown fields are rejected. It answers `201 {"ref":"SD-XXXXXX"}`, `400 {"error":"...","field":"..."}` for a bad field, `413` for an oversized body, `429` past 5 reports per IP every 10 minutes (rate-limit rule `/api/sd/reports`), and `503` past `DailyCap` (200) reports per UTC day across all clients.

**What is stored** (collection `reports`): the fields above, `ref`, `status` (`new`, `triaged`, `issue`, `closed`; starts `new`), `githubIssue` (URL, set by the owner), `created`, `updated`, and `client`: an HMAC-SHA256 of the client IP under a server secret (`SD_REPORT_IP_KEY`, or a random key per server run when unset) and the UTC day, only to spot a flood from one source on one day. It cannot be reversed without the secret and does not follow anyone across days. Never the IP, an email, an account id or a save. The success log line carries only the category, never the ref, so a report cannot be matched by time to PocketBase's request log (which keeps IPs). Every API rule is superuser-only: the records API cannot list, view, create, edit or delete reports.

**Admins.** The collection `admins` lists the player accounts that triage reports. Only superusers edit it: Dashboard (`/_/`) > Collections > `admins` > New record, and pick the account, one whose email is verified: an email can be registered by anyone until verified. An email is never what makes someone an admin. Deleting the account removes the admin.

**Admin routes.** All need the token of an account in `admins`: 401 without a token, 403 otherwise. The client hash is never answered.

| Route | Answer |
|---|---|
| `GET /api/sd/admin/me` | `200 {"admin":true}`: how the game knows to show the panel |
| `GET /api/sd/admin/reports?status=` | The newest 200 (of that status, when given) and `total` |
| `PATCH /api/sd/admin/reports/{ref}` with `{"status":...}` | `new`, `triaged` or `closed` (also out of `issue`, keeping its link); nothing else can change |

**Email.** Each admin gets a plain-text mail per new report, while SMTP is on, for the first 20 reports of each UTC day. Past that they wait in the inbox, so a flood cannot spend the quota account verification emails share.

**Triage.**

1. In the game: Options > Tickets (or Dashboard (`/_/`) > Collections > `reports`, filter `status = "new"`, sort by `created`).
2. Read the report. Spam or duplicate: set `status` to `closed`. Real but not worth an issue yet: `triaged`.
3. Worth an issue: save the record as JSON (as superuser, `GET /api/collections/reports/records?filter=(ref='SD-XXXXXX')`; the script takes that list answer or a single record) and render the body:

   ```sh
   tools/report-to-issue.sh report.json > body.md
   gh issue create --repo FullFran/shadow-dungeon --title "[SD-XXXXXX] <short summary>" --label bug --body-file body.md
   ```

   Or by hand, with this template:

   ~~~markdown
   Player report **SD-XXXXXX** (category: bug), received 2026-10-29.

   ### Description
   <description>

   ### Steps to reproduce
   <steps>

   ### Expected
   <expected>

   ### Observed
   <observed>

   ### Environment
   - Game version: <version>
   - Device: <device>

   <details><summary>Diagnostics</summary>

   ```json
   <diagnostics>
   ```
   </details>
   ~~~

   Nothing personal is stored, so nothing needs stripping; still read the text the player wrote before publishing it (they may have typed a name or an email themselves).
4. Back in the dashboard set `status` to `issue` and `githubIssue` to the issue URL. Close the report (`closed`) when the issue is fixed.

The player keeps the `SD-XXXXXX` reference and can quote it when writing to the owner.

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
| `SD_SMTP_HOST` | empty (SMTP off) | `smtp.resend.com` |
| `SD_SMTP_PORT` | `465` | SMTP port |
| `SD_SMTP_USERNAME` | empty | `resend` for Resend |
| `SD_SMTP_PASSWORD` | empty | Resend API key ("Sending access" only). Secret |
| `SD_SMTP_TLS` | `true` on 465, else `false` | Implicit TLS; `false` uses STARTTLS |
| `SD_MAIL_FROM_ADDRESS` | empty | Sender, e.g. `no-reply@fullfran.com` (a verified Resend domain) |
| `SD_MAIL_FROM_NAME` | `Mazmorra Sombría` | Sender name |
| `SD_APP_URL` | `https://sd-api.fullfran.com` | Public API URL used in the email links |
| `SD_APP_NAME` | `Mazmorra Sombría` | Game name in the emails |

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
