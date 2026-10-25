# Twitch Chat Integration — Research

Status: research only, nothing implemented. Researched 2026-10-25.

Goal: let Twitch chat take part while the streamer plays live.

- **MVP (a):** chat votes on the answers to a Mystery Dungeon-style personality quiz by typing `1`, `2` or `3`.
- **Later (b):** chat votes on which held item the streamer picks.
- **Later (c):** chat-triggered events, such as "chat summons an enemy", with cooldowns and anti-spam.

Constraints: TypeScript and Vite, static hosting on GitHub Pages, no backend, hexagonal architecture with adapters in `src/adapters/`.

---

## 1. Findings

### 1.1 Anonymous IRC over WebSocket (`justinfan`)

| Fact | Evidence | Date checked |
|---|---|---|
| The endpoint is `wss://irc-ws.chat.twitch.tv:443`. Non-TLS `ws://` was decommissioned on 2025-08-15. | https://dev.twitch.tv/docs/chat/irc/ and https://dev.twitch.tv/docs/product-lifecycle/ | 2026-10-25 |
| The Product Lifecycle page lists Chat (IRC) as **Active**, with no deprecation or sunset date. Legacy PubSub was shut down on 2025-04-14. IRC was not. | https://dev.twitch.tv/docs/product-lifecycle/ | 2026-10-25 |
| Twitch calls EventSub plus the Helix API "the preferred method" for chat. IRC is a "historical interface" with "limited features". The IRC migration guide *recommends* moving to EventSub but gives no removal date. | https://dev.twitch.tv/docs/chat/ and https://dev.twitch.tv/docs/chat/irc-migration/ | 2026-10-25 |
| Anonymous `justinfan<digits>` login is **not documented** by Twitch. The official IRC page only describes authenticated logins (`chat:read`/`chat:edit`). Anonymous login is community knowledge only: https://discuss.dev.twitch.tv/t/anonymous-connection-to-twitch-chat/20392 (circa 2020: any non-empty dummy `PASS`, nick `justinfan` plus random digits). | see links | 2026-10-25 |
| **Observed working on 2026-10-25.** The test was a Node 24 global `WebSocket` sending `CAP REQ :twitch.tv/tags twitch.tv/commands`, `PASS SCHMOOPIIE`, `NICK justinfan56974` and `JOIN #twitchdev`. The server replied `001 … Welcome, GLHF!`, then `JOIN` and `353`. This was a single run from Node, not from a browser. | local probe | 2026-10-25 |
| Join limits: 20 join attempts per 10 s per user, 100 concurrent channels per account (since 2024-05-15). Sending limits do not matter for read-only use. | https://dev.twitch.tv/docs/chat/ and https://discuss.dev.twitch.com/t/giving-broadcasters-control-concurrent-join-limits-for-irc-and-eventsub/54997 | 2026-10-25 |
| CORS does not apply to WebSockets, so a browser page on any origin can open the socket. No client id and no OAuth are needed for anonymous reads. | general WebSocket semantics; nothing in Twitch docs restricts Origin | — |
| With `twitch.tv/tags`, every `PRIVMSG` carries a stable numeric `user-id` tag, plus `display-name`, `mod`, `subscriber` and `badges`. Votes can be deduplicated on `user-id`, which survives a rename. | https://dev.twitch.tv/docs/chat/irc/ (tags section) | 2026-10-25 |

**Conclusion:** anonymous IRC is the only way to read chat from a static page with **zero auth**. It works today and the IRC product is Active. Its anonymous mode is undocumented, though, so Twitch could remove it without any lifecycle notice.

### 1.2 EventSub `channel.chat.message` over WebSocket

| Fact | Evidence |
|---|---|
| `channel.chat.message` v1 requires the `user:read:chat` scope from the *chatting (reading) user*. Using an app token adds `user:bot` from the reader and `channel:bot` from the broadcaster, or mod status. | https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/ |
| The WebSocket transport **requires a user access token**: "If you use app access tokens with WebSockets, the subscriptions will fail." | https://dev.twitch.tv/docs/eventsub/handling-websocket-events/ |
| Limits per (client id, user) pair: 3 WebSocket connections with enabled subscriptions, 300 subscriptions per connection, `max_total_cost` 10. You must subscribe (via Helix `POST /eventsub/subscriptions` with `session_id`) within 10 s of the welcome message, or the socket closes with code 4003. The keepalive is 10–600 s. | same page |
| A user token with `user:read:chat` can read **any** channel's chat, with `condition = { broadcaster_user_id, user_id: <token owner> }`. Reading counts toward that user's join limits. So any logged-in viewer could run the page against any channel, and the streamer's login is *not* strictly required. Logging in with the streamer's own account is still the natural choice, since the streamer runs the game. | https://dev.twitch.tv/docs/chat/irc-migration/ and https://dev.twitch.tv/docs/chat/ |
| A static site needs a registered app (client id) and the **implicit grant flow**. The token comes back in the URL fragment (`#access_token=…`), with the `state` parameter "strongly encouraged". The redirect URI must match a URI registered in the Twitch dev console. A GitHub Pages URL can be registered, and so can `http://localhost:<port>` for dev. The docs show no refresh token for this flow. | https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/ |
| Device code flow (public client, no secret, 4 h access token, one-time refresh tokens) is the other secret-less option. | same page |
| Apps that keep an OAuth session "must validate the OAuth token when it starts and on an hourly basis" (`GET https://id.twitch.tv/oauth2/validate`). Twitch audits this and may revoke the client id. | https://dev.twitch.tv/docs/authentication/validate-tokens/ |

**Conclusion:** EventSub works from a browser with no backend, but it needs a registered client id, an implicit-grant login, hourly validation and a subscribe call within 10 s. That is all doable client-side. It is heavier than IRC, but it is the documented, preferred path.

### 1.3 Libraries

Versions are from the npm registry. Commit dates are from the GitHub API. Sizes are from bundlephobia, minified and gzipped, for the package itself. All were checked on 2026-10-25.

| Library | Latest | Last activity | Size (gz) | Notes |
|---|---|---|---|---|
| `tmi.js` | 1.8.5 (2021-08-18) | last commit 2025-11-11 | ~11.5 KB | No release in 5 years. Works in the browser (`window.tmi`). IRC only, no EventSub. 26 open issues. It is effectively in maintenance mode. https://github.com/tmijs/tmi.js |
| `comfy.js` | 1.1.29 (2025-09-05) | commit 2026-08-01 | ~19 KB | A wrapper around tmi.js, so it inherits the stale core. `ComfyJS.Init("channel")` reads with no password. Browser builds are on jsDelivr. https://github.com/instafluff/ComfyJS |
| `@twurple/chat` | 8.2.0 (2026-09-13) | commit 2026-09-13 | ~23 KB (+ deps) | Actively maintained and written in TS. The docs say: if `authProvider` is omitted, "the chat client will connect anonymously". https://twurple.js.org/reference/chat/interfaces/ChatClientOptions.html |
| `@twurple/eventsub-ws` | 8.2.0 (2026-09-13) | same | ~25 KB, but pulls in `@twurple/api` (bundlephobia approx. 545 KB raw) | EventSub WebSocket client. Heavy for a game bundle. |
| Hand-written client | — | — | < 2 KB | Anonymous IRC needs about 60 lines: connect, send 4 lines, answer `PING` with `PONG`, parse `@tags :prefix PRIVMSG #chan :text`, reconnect with backoff. EventSub needs about 150 lines: welcome → `fetch` POST subscribe, keepalive watchdog, `session_reconnect`. |

**Conclusion:** for a game bundle with a hexagonal adapter, a hand-written adapter is cheaper and easier to test than any of these libraries. `@twurple/chat` is the maintained fallback if parsing edge cases pile up. Avoid tmi.js and ComfyJS for new code, because their core is stale.

### 1.4 Other platforms (feasibility only)

- **YouTube.** `liveChatMessages.list` costs 5 units per call. `streamList` (server push) also costs 5 units, and Google recommends it to save quota. The default quota is 10,000 units/day. Source: https://developers.google.com/youtube/v3/determine_quota_cost and https://developers.google.com/youtube/v3/live/docs/liveChatMessages/list (both "Last updated 2026-10-15"). At 5 units per poll, a 2–5 s polling cadence uses up the daily quota within hours of streaming, while `streamList` is far cheaper. Auth is Google OAuth from a Cloud project, and whether an API key is enough was not confirmed. Feasible client-side, but quota-bound. Treat it as a later adapter.
- **Kick.** The official public API (https://docs.kick.com/events/subscribe-to-events) delivers `chat.message.sent` **only via webhooks** (`method: "webhook"`), using a user token with `events:subscribe` or an app token. That **needs a backend**. Third-party tools read Kick's internal Pusher WebSocket, but that is undocumented and unsupported.

### 1.5 Policy, branding, privacy

- **Developer Services Agreement:** https://legal.twitch.com/en/legal/developer-agreement/. The page is rendered client-side, and the body text could not be pulled in this session. Its clauses are *unverified* here (see §5).
- **Twitch marks:** Twitch's general Terms say the Twitch name and logos may not be used "without our prior written permission" in connection with non-Twitch products. This comes from a secondary summary, https://conductatlas.com/platform/twitch/twitch-terms-of-service/provision/CA-P-025005/twitch-trademarks-may-not-be-used-without-written-permission/. Brand assets and guidelines: https://www.twitch.tv/p/en-gb/brand/ (pointer from https://discuss.dev.twitch.com/t/where-to-find-twitch-connect-brand-assets/20869). The practical rule: do not put "Twitch" in the game or app name, do not use the Glitch logo as game art, and describe the feature plainly ("chat voting works with Twitch").
- **Pokémon IP:** `package.json` describes this as a non-commercial Pokémon fan game. That IP risk is separate from the Twitch integration and out of scope here, but streaming it publicly raises its visibility.

---

## 2. Recommended approach

### MVP (quiz voting): anonymous IRC, read-only, behind a port

1. **Port in the core.** Add a `ChatFeed` port that emits `{ userId: string; displayName: string; text: string; isMod: boolean; at: number }` and offers `connect(channel)` and `disconnect()`. The core never sees IRC or EventSub.
2. **Adapter.** Add `src/adapters/twitch-irc-anon.ts`, a hand-written WebSocket client:
   - It sends `CAP REQ :twitch.tv/tags twitch.tv/commands`, a dummy `PASS`, `NICK justinfan<random 5 digits>` and `JOIN #<channel lowercase>`.
   - It answers `PING :tmi.twitch.tv` with `PONG :tmi.twitch.tv`.
   - It handles `RECONNECT`, and reconnects with exponential backoff and jitter.
   - It parses only `PRIVMSG` and ignores everything else.
   - The channel name comes from a settings field or a `?channel=` query parameter. **No token, no client id, nothing stored except the channel name.**
3. **Vote domain (pure, unit-testable).** Model a `Poll` value object: `{ id, options: 1..N, opensAt, closesAt, ballots: Map<userId, option> }`.
   - **Accept rule:** the message text, trimmed, matches `/^[1-N]$/`. Optionally also accept `!1` or `#1`. Reject longer text, so that "1 lol" does not count unless you decide it should.
   - **One vote per user per poll**, keyed on the `user-id` tag, never the display name.
   - **Vote changes:** choose either "last vote wins" or "first vote locks". Last vote wins feels better on stream.
   - **Windows:** a fixed window, for example 20 s, with a visible countdown. Messages outside the window are ignored. The game timestamps on receipt, because IRC `tmi-sent-ts` can drift.
   - **Ties:** fall back to the streamer's own pick, or a random pick that is announced on screen.
   - **Zero votes:** the streamer's pick is used.
4. **On-screen tally.** Show counts and percentages per option and the total voter count only. **Do not render usernames or message text.** That avoids amplifying abusive names or texts on stream and keeps the overlay free of chat content. An optional "last voter" ticker should stay off by default.
5. **The streamer keeps control.** A visible "chat voting ON/OFF" toggle, and a streamer override key that can veto or close a poll early.

Why this approach: it needs zero auth and zero secrets, there is no token in `localStorage`, it adds under 2 KB, it fits GitHub Pages, and it is enough for read-only voting.

### Upgrade path (same port, second adapter)

Add `src/adapters/twitch-eventsub.ts` once (a) anonymous IRC breaks or (b) a feature needs authenticated data, such as channel-point redemptions or "only followers/subs may vote" checks done through Helix.

1. Register a Twitch app. Set the redirect URI to the exact GitHub Pages URL plus `http://localhost:5173/` for dev.
2. Use the implicit grant with scope `user:read:chat` only and a random `state` held in `sessionStorage` and compared on return. Clear the fragment with `history.replaceState`.
3. Keep the token **in memory only**. Optionally keep it in `sessionStorage` so it survives a reload during the stream, and wipe it when the tab closes. Never use `localStorage`. Call `/oauth2/validate` on start and hourly, as Twitch requires. Offer a "Log out" button that revokes the token (`POST https://id.twitch.tv/oauth2/revoke`).
4. Open `wss://eventsub.wss.twitch.tv/ws`. On `session_welcome`, POST the subscription to Helix within 10 s, with `condition { broadcaster_user_id, user_id }`. Run a keepalive watchdog, and follow `session_reconnect`.

### What needs a backend later

- **(c) Chat-triggered events with cooldowns and anti-spam.** These *can* be client-side, through a per-user and global cooldown in the domain plus a rate cap per window. A backend becomes necessary only for actions that must be secure against the streamer's own page being tampered with, or that must persist across sessions, such as leaderboards and "bits/points bought this".
- **Channel-point rewards and Bits.** EventSub works with a user token from the browser, but managing rewards (Helix `custom_rewards`) is cleaner with a server holding refresh tokens.
- **Long-lived auth without re-login each stream.** That needs the authorization code flow with a client secret, which requires a server.
- **Kick** (webhooks only), and **multi-platform aggregation** (YouTube quota held server-side, and one merged feed for several streamers).
- **Shared state across viewers.** For example, viewers seeing the game state on their own page, or a public results archive.

---

## 3. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Anonymous `justinfan` reads are undocumented and could be blocked without notice. IRC is Active, but Twitch steers developers to EventSub. | Medium over 1–2 years | The `ChatFeed` port plus a ready EventSub adapter design (above). Show "chat offline" when connecting fails, and keep the game playable without chat. |
| Vote stuffing with alt accounts | Low–medium | One vote per `user-id`. Optional filters: ignore accounts flagged by mod tools, or (EventSub plus Helix) require a follow. On-screen counts make manipulation visible. |
| Spam or abusive text shown on stream | Medium | Never render chat text or usernames in the overlay. Count only. |
| Stream delay (2–15 s) makes windows unfair | High | Long enough windows (≥ 20 s), and announce the window on screen before it opens. Optionally add a grace period after the timer hits zero. |
| Token leaks (EventSub path) | Low if done right | Minimal scope (`user:read:chat`), memory or `sessionStorage` only, fragment cleared, revoke on logout, no third-party scripts on the page. |
| Twitch audit or app revocation (EventSub path) | Low | Hourly `/validate`. Do not use Twitch marks in the game name. |
| IRC or EventSub reconnect gaps lose votes | Medium | Reconnect with backoff, and show a "chat reconnecting" banner. Do not close a poll while disconnected; extend it instead. |
| Chat floods (big raid) block the main thread | Low | Parse incrementally. Only `PRIVMSG` matching the vote regex reaches the domain. Batch UI tally updates with `requestAnimationFrame`. |

---

## 4. Open questions

1. Should vote changes be "last vote wins" or "first vote locks"? Should a timer that runs out with zero votes default to the streamer's choice?
2. Should vote weight differ (mods, subs)? Recommendation: no, keep it 1 user = 1 vote.
3. Which channel? Hardcoded for the streamer, or a settings field so any streamer can use it?
4. Is per-stream login acceptable when the EventSub upgrade comes, or will a backend be needed for refresh tokens?
5. For (c), are chat events free or tied to channel points? Channel points push towards EventSub plus reward management.
6. Is any platform besides Twitch needed for the first public release?

---

## 5. Unverified

- **Browser behaviour of the anonymous IRC socket.** It was only probed from Node 24, once. A browser sends an `Origin` header, and Twitch filtering by Origin was not observed or tested.
- **Developer Services Agreement clauses** on data retention, privacy policy requirements, displaying user data and naming. The page body could not be retrieved (client-rendered). Read https://legal.twitch.com/en/legal/developer-agreement/ before registering an app.
- **Exact rules on using "Twitch" in an app or game name.** Only secondary sources were found.
- **Implicit-grant token lifetime.** The docs do not state it, and it is commonly reported as a few hours with no refresh. Also unverified: whether a GitHub Pages `https://<user>.github.io/<repo>/` path-style redirect URI is accepted as-is, which is expected but not tested.
- **Helix CORS for `POST /eventsub/subscriptions` from a browser origin.** It is widely used client-side, but this session did not confirm it.
- **YouTube `liveChatMessages` auth.** Whether an API key alone can read public live chat, or OAuth is mandatory.
- **twurple total bundle cost** after tree-shaking in Vite. The bundlephobia numbers are per package, and `@twurple/api` is large.
