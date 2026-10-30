import { normalizeFriendCode, type Friend, type FriendsApi, type FriendsError, type FriendsOverview, type FriendsResult, type FriendState } from '../adapters/friends-api';
import { t } from '../i18n';
import { normalizeRoomCode } from '../net/room-code';
import { cursorList, type CursorList, type ListItem } from '../ui/cursor-list';
import { h } from '../ui/window';

/**
 * "Amigos": your code, add by code, requests, your friends and whether they
 * are in a room to join. The server decides who sees what
 * (adapters/friends-api.ts). A guest gets a line and the way to the account,
 * and no request is made. All a player typed is shown as text, never as markup.
 */

const STATE_ORDER: Record<FriendState, number> = { room: 0, online: 1, offline: 2 };

/** Rooms first, then online, then offline, each by name. */
export function sortFriends(friends: readonly Friend[]): Friend[] {
  return [...friends].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.nickname.localeCompare(b.nickname));
}

/** The room to join for this friend: only a friend in a room, only a valid code, and not the room this player is already in. */
export function joinableRoom(friend: Friend, myRoom: string | null): string | null {
  if (friend.state !== 'room' || friend.room === null) return null;
  const code = normalizeRoomCode(friend.room);
  return code && code !== myRoom ? code : null;
}

/** What the window shows: signed out it asks the server nothing. */
export function loadFriends(api: Pick<FriendsApi, 'overview'>, token: string | null): Promise<FriendsResult<FriendsOverview>> {
  return token ? api.overview(token) : Promise.resolve({ ok: false, error: 'denied' });
}

export const HEARTBEAT_MS = 60_000;

export interface HeartbeatDeps {
  /** Who is signed in (`who` is the account, the token may be refreshed), or null as a guest. */
  session(): { who: string; token: string } | null;
  /** The room this player is in, or null. */
  room(): string | null;
  visible(): boolean;
  send(token: string, room: string | null): void;
  start(tick: () => void, ms: number): unknown;
  stop(timer: unknown): void;
}

export interface Heartbeat {
  /** Call when the account, the room or the tab's visibility may have changed; repeats do nothing. */
  sync(): void;
  /** One beat now, signed in (the window was just opened: an account's first beat that counts, so friends see it online at once). */
  now(): void;
}

/**
 * Tells the server this account is here, so its friends see it online, and
 * which room it is in. It only runs signed in, with the tab visible; in a room
 * it also runs hidden, since a host waiting while on a chat is still there. A
 * closed tab simply stops, and the server forgets it after a few minutes.
 */
export function friendsHeartbeat(deps: HeartbeatDeps): Heartbeat {
  let timer: unknown = null;
  let sent: { who: string; token: string; room: string | null } | null = null;

  const disarm = () => {
    if (timer !== null) deps.stop(timer);
    timer = null;
  };
  const beat = () => {
    const session = deps.session();
    if (!session) return;
    sent = { ...session, room: deps.room() };
    deps.send(session.token, sent.room);
  };
  const arm = () => {
    disarm();
    timer = deps.start(beat, HEARTBEAT_MS);
  };

  return {
    now: beat,
    sync() {
      const session = deps.session();
      // Whoever published a room takes it back, with its own token, when it goes.
      if (sent && sent.who !== session?.who) {
        if (sent.room !== null) deps.send(sent.token, null);
        sent = null;
      }
      if (!session) return disarm();
      const room = deps.room();
      const changedRoom = sent !== null && sent.room !== room;
      if (!deps.visible() && room === null) {
        disarm();
        if (changedRoom) beat();
        return;
      }
      if (timer === null || sent === null || changedRoom) {
        beat();
        arm();
      }
    },
  };
}

const STYLE = `
.friends-window .md-window-body { max-height: calc(100dvh - 150px); overflow-y: auto; overscroll-behavior: contain; scrollbar-color: var(--md-cursor) transparent; }
.friends-window { width: min(560px, calc(100vw - 16px)); box-sizing: border-box; }
.friends-window .friends-code { color: var(--md-cursor); letter-spacing: 0.1em; font-family: var(--md-code-font); }
.friends-window input.code-input { font-size: 16px; width: 9em; letter-spacing: 0.1em; box-sizing: border-box; max-width: 100%; }
.friends-window .md-label { overflow-wrap: anywhere; }
.friends-window .friends-note { margin: 8px 0 0; font-size: 14px; }
.friends-window .friends-guest { margin: 0 0 8px; }
.friends-window .friends-join { padding-left: 1.2em; color: var(--md-cursor); }
`;

export interface FriendsWindowOptions {
  api: FriendsApi;
  token(): string | null;
  /** The room this player is in, or null. */
  myRoom(): string | null;
  onBack(): void;
  /** Guests go to the account screen from here. */
  onAccount(): void;
  /** A valid room code to join (the app opens the lobby, as if it had been typed). */
  onJoin(code: string): void;
  /** The server has this account's card now, so a heartbeat counts from here on. */
  onLoaded(): void;
}

const POLL_MS = 30_000;

const errorKey = (error: FriendsError): string => `friends.error.${error}`;

export function friendsWindow(options: FriendsWindowOptions): { element: HTMLElement; dispose(): void } {
  const status = h('p', { className: 'lobby-error' });
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const title = h('h2', { className: 'md-window-title', textContent: t('friends.title') });
  const body = h('div', { className: 'md-window-body' });
  const element = h('section', { className: 'md-window shop friends-window' }, [h('style', { textContent: STYLE }), title, body]);
  let list: CursorList | null = null;
  let main: CursorList | null = null;
  let data: FriendsOverview | null = null;
  let disposed = false;
  let poll: ReturnType<typeof setInterval> | null = null;

  const nameOf = (nickname: string) => nickname || t('friends.noName');
  const setList = (items: ListItem[], onBack: () => void): CursorList => {
    list?.dispose();
    list = cursorList({ items, onBack, label: t('friends.title'), className: 'shop-list' });
    return list;
  };
  const say = (key: string) => {
    status.textContent = t(key);
  };

  const input = h('input', { type: 'text', className: 'code-input', placeholder: t('friends.codePlaceholder') });
  input.maxLength = 11;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('autocapitalize', 'characters');
  input.setAttribute('autocorrect', 'off');
  input.enterKeyHint = 'go';
  input.setAttribute('aria-label', t('friends.add'));
  input.addEventListener('click', (e) => e.stopPropagation());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void add();
  });

  /** The server refused this session: nothing it loaded stays on screen. */
  function denied(): void {
    data = null;
    showMain();
    say('friends.error.denied');
  }

  function fail(error: FriendsError): void {
    if (error === 'denied') return denied();
    say(errorKey(error));
  }

  async function add(): Promise<void> {
    const code = normalizeFriendCode(input.value);
    if (!code) {
      say('friends.invalidCode');
      input.focus();
      return;
    }
    const token = options.token();
    const result = token ? await options.api.send(token, code) : ({ ok: false, error: 'denied' } as const);
    if (disposed) return;
    if (!result.ok) return fail(result.error);
    input.value = '';
    say(result.value === 'friends' ? 'friends.nowFriends' : 'friends.sent');
    await load(false);
  }

  /** A request or a removal from a detail view; back to the list with the new state. */
  async function act(run: (token: string) => Promise<FriendsResult<unknown>>, done: string): Promise<void> {
    const token = options.token();
    const result = token ? await run(token) : ({ ok: false, error: 'denied' } as const);
    if (disposed) return;
    showMain();
    if (!result.ok) return fail(result.error);
    say(done);
    await load(false);
  }

  function detail(heading: string, rows: ListItem[]): void {
    main = null;
    title.textContent = heading;
    status.textContent = '';
    const back = () => {
      status.textContent = '';
      showMain();
    };
    body.replaceChildren(setList([...rows, { label: t('menu.back'), onConfirm: back }], back).element, status);
  }

  const copyCode = (code: string) => {
    void navigator.clipboard?.writeText(code).then(() => {
      if (!disposed) say('friends.copied');
    });
  };

  function rows(view: FriendsOverview): ListItem[] {
    const items: ListItem[] = [
      { label: t('friends.code'), value: h('span', { className: 'friends-code', textContent: view.code }), onConfirm: () => copyCode(view.code) },
      { label: t('friends.add'), value: input, className: 'join-row', onConfirm: () => (normalizeFriendCode(input.value) ? void add() : input.focus()) },
    ];
    if (view.incoming.length) items.push({ label: t('friends.requests'), header: true });
    for (const request of view.incoming) {
      const name = nameOf(request.nickname);
      items.push({
        label: name,
        value: t('friends.requestValue'),
        onConfirm: () =>
          detail(name, [
            { label: t('friends.accept'), onConfirm: () => void act((token) => options.api.accept(token, request.id), 'friends.nowFriends') },
            { label: t('friends.decline'), onConfirm: () => void act((token) => options.api.remove(token, request.id), 'friends.declined') },
          ]),
      });
    }
    items.push({ label: t('friends.list'), header: true });
    if (!view.friends.length) items.push({ label: h('span', { className: 'dim', textContent: t('friends.none') }), disabled: true });
    for (const friend of sortFriends(view.friends)) {
      const name = nameOf(friend.nickname);
      const code = joinableRoom(friend, options.myRoom());
      const inMyRoom = friend.state === 'room' && friend.room === options.myRoom();
      items.push({
        label: name,
        value: t(inMyRoom ? 'friends.state.same' : `friends.state.${friend.state}`),
        onConfirm: () => detail(name, [{ label: t('friends.remove'), onConfirm: () => void act((token) => options.api.remove(token, friend.id), 'friends.removed') }]),
      });
      if (code) items.push({ label: h('span', { className: 'friends-join', textContent: t('friends.join') }), onConfirm: () => options.onJoin(code) });
    }
    if (view.outgoing.length) items.push({ label: t('friends.waiting'), header: true });
    for (const sent of view.outgoing) {
      items.push({
        label: h('span', { className: 'friends-code', textContent: sent.code }),
        onConfirm: () => detail(sent.code, [{ label: t('friends.cancel'), onConfirm: () => void act((token) => options.api.remove(token, sent.id), 'friends.cancelled') }]),
      });
    }
    items.push({ label: t('friends.reload'), onConfirm: () => void load(true) });
    items.push({ label: t('menu.back'), onConfirm: options.onBack });
    return items;
  }

  function paint(view: FriendsOverview): void {
    if (!main) return;
    const typing = document.activeElement === input;
    main.setItems(rows(view));
    if (typing) input.focus();
  }

  function showMain(): void {
    title.textContent = t('friends.title');
    const token = options.token();
    if (!token) {
      main = null;
      body.replaceChildren(
        h('p', { className: 'friends-guest', textContent: t('friends.guest') }),
        setList([{ label: t('friends.account'), onConfirm: options.onAccount }, { label: t('menu.back'), onConfirm: options.onBack }], options.onBack).element,
      );
      return;
    }
    main = setList(data ? rows(data) : [{ label: t('menu.back'), onConfirm: options.onBack }], options.onBack);
    body.replaceChildren(main.element, status, h('p', { className: 'dim friends-note', textContent: t('friends.privacy') }));
  }

  /** Reads the server; `loud` says so on screen. A failed quiet read leaves what is there. */
  async function load(loud: boolean): Promise<void> {
    if (loud) say('friends.loading');
    const result = await loadFriends(options.api, options.token());
    if (disposed) return;
    if (!result.ok) {
      if (loud || result.error === 'denied') fail(result.error);
      return;
    }
    if (loud) status.textContent = '';
    if (JSON.stringify(result.value) === JSON.stringify(data)) return;
    const first = data === null;
    data = result.value;
    if (first) options.onLoaded();
    if (first && main) showMain();
    else paint(data);
  }

  showMain();
  if (options.token()) {
    void load(true);
    poll = setInterval(() => {
      if (main && !document.hidden) void load(false);
    }, POLL_MS);
  }
  return {
    element,
    dispose: () => {
      disposed = true;
      if (poll !== null) clearInterval(poll);
      list?.dispose();
      list = null;
      main = null;
    },
  };
}
