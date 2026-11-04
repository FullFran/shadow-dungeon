import { normalizeFriendCode, type FriendsApi, type FriendsError, type FriendsOverview, type FriendsResult, type FriendState } from '../adapters/friends-api';
import { t } from '../i18n';
import { confirmDialog } from '../ui/confirm-dialog';
import { pixelIconSvg } from '../ui/pixel-icons';
import { spinLoader } from '../ui/spinner';
import { h } from '../ui/window';
import { friendsView, gateFor, loadFriends, type FriendsView } from './friends-screen';
import { hubStep } from './title-hub';
import '../styles/relic-controls.css';
import '../styles/friends.css';

export interface FriendsWindowOptions {
  api: FriendsApi;
  token(): string | null;
  /** The room this player is in, or null. */
  myRoom(): string | null;
  onBack(): void;
  /** The signed-out card opens the account drawer from here. */
  onAccount(): void;
  /** A valid room code to join (the app opens the lobby, as if it had been typed). */
  onJoin(code: string): void;
  /** The server has this account's card now, so a heartbeat counts from here on. */
  onLoaded(): void;
}

const POLL_MS = 30_000;
const errorKey = (error: FriendsError): string => `friends.error.${error}`;

/** A relic button: label and a variant class (`rk-ember`, `rk-quiet`). `key` lets a redraw give the focus back. */
const button = (label: string, variant: string, onClick: () => void, key?: string): HTMLButtonElement => {
  const el = h('button', { type: 'button', className: `rk-btn ${variant}`, textContent: label });
  if (key) el.dataset.key = key;
  el.addEventListener('click', onClick);
  return el;
};

/** The avatar tile: the first letter of the name on a slab, with a state pip. */
const avatar = (initial: string, state: FriendState | null): HTMLElement =>
  h('span', { className: `fr-avatar${state ? ` is-${state}` : ''}` }, [h('span', { className: 'fr-initial', textContent: initial }), state ? h('i', { className: 'fr-pip' }) : null]);

const KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

/**
 * The Friends window in the relic picker pattern (.agents/DESIGN.md §4): fixed
 * geometry, a sheet on the left (your code, add by code) and a list of cards on
 * the right (requests, friends, waiting). Signed out it is one compact card
 * that opens the account drawer. Arrows move focus between controls, Enter
 * acts, Esc goes back; the list scrolls inside its own frame, never the page.
 */
export function friendsWindow(options: FriendsWindowOptions): { element: HTMLElement; dispose(): void } {
  const status = h('p', { className: 'fr-status' });
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const body = h('div', { className: 'fr-body' });
  const element = h('section', { className: 'md-window fr-window' }, [h('h2', { className: 'md-window-title', textContent: t('friends.title') }), body]);
  let data: FriendsOverview | null = null;
  let disposed = false;
  let poll: ReturnType<typeof setInterval> | null = null;
  const say = (key: string) => {
    // Loading is the spin loader (no word); anything else is a message line.
    if (key === 'friends.loading') status.replaceChildren(spinLoader({ label: t(key), size: 32 }));
    else status.textContent = key ? t(key) : '';
  };

  const input = h('input', { type: 'text', className: 'rk-input fr-input', placeholder: t('friends.codePlaceholder'), id: 'fr-code-input' });
  input.maxLength = 11;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('autocapitalize', 'characters');
  input.setAttribute('autocorrect', 'off');
  input.enterKeyHint = 'go';
  input.setAttribute('aria-label', t('friends.add'));

  /** The server refused this session: nothing it loaded stays on screen. */
  function denied(): void {
    data = null;
    render();
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
    say('account.busy');
    const token = options.token();
    const result = token ? await options.api.send(token, code) : ({ ok: false, error: 'denied' } as const);
    if (disposed) return;
    if (!result.ok) return fail(result.error);
    input.value = '';
    say(result.value === 'friends' ? 'friends.nowFriends' : 'friends.sent');
    await load(false);
  }

  /** A request, a removal or a cancel; the list reloads with the new state. */
  async function act(run: (token: string) => Promise<FriendsResult<unknown>>, done: string): Promise<void> {
    say('account.busy');
    const token = options.token();
    const result = token ? await run(token) : ({ ok: false, error: 'denied' } as const);
    if (disposed) return;
    if (!result.ok) return fail(result.error);
    say(done);
    await load(false);
  }

  const copyCode = (code: string, trigger: HTMLButtonElement) => {
    void navigator.clipboard?.writeText(code).then(() => {
      if (disposed) return;
      say('friends.copied');
      trigger.textContent = t('friends.copied');
    });
  };

  const nameOf = (name: string) => name || t('friends.noName');

  /** One card: avatar, name and state line on the left, actions on the right. */
  const card = (parts: { initial: string; state: FriendState | null; name: string; line: string; lineClass?: string; actions: HTMLElement[] }): HTMLElement =>
    h('li', { className: 'fr-card' }, [
      avatar(parts.initial, parts.state),
      h('span', { className: 'fr-who' }, [h('span', { className: 'fr-name', textContent: parts.name }), h('span', { className: `fr-line ${parts.lineClass ?? ''}`, textContent: parts.line })]),
      h('span', { className: 'fr-actions' }, parts.actions),
    ]);

  function list(view: FriendsView): HTMLElement {
    const ul = h('ul', { className: 'fr-list' });
    ul.setAttribute('aria-label', t('friends.list'));
    const cards: HTMLElement[] = [];
    for (const request of view.requests) {
      cards.push(
        card({
          initial: request.initial,
          state: null,
          name: nameOf(request.name),
          line: t('friends.requestValue'),
          lineClass: 'is-request',
          actions: [
            button(t('friends.accept'), 'rk-ember', () => void act((token) => options.api.accept(token, request.id), 'friends.nowFriends'), `a:${request.id}`),
            button(t('friends.decline'), 'rk-quiet', () => void act((token) => options.api.remove(token, request.id), 'friends.declined'), `d:${request.id}`),
          ],
        }),
      );
    }
    for (const friend of view.friends) {
      const name = nameOf(friend.name);
      const actions: HTMLElement[] = [];
      if (friend.joinRoom) {
        const room = friend.joinRoom;
        actions.push(button(t('friends.join'), 'rk-ember', () => options.onJoin(room), `j:${friend.id}`));
      }
      actions.push(
        button(
          t('friends.remove'),
          'rk-quiet',
          () => {
            void confirmDialog({ title: t('friends.remove'), body: name, confirmLabel: t('friends.remove') }).then((yes) => {
              if (yes && !disposed) void act((token) => options.api.remove(token, friend.id), 'friends.removed');
            });
          },
          `r:${friend.id}`,
        ),
      );
      cards.push(card({ initial: friend.initial, state: friend.state, name, line: t(friend.stateKey), lineClass: `is-${friend.state}`, actions }));
    }
    for (const sent of view.waiting) {
      cards.push(
        card({
          initial: '…',
          state: null,
          name: sent.code,
          line: t('friends.waiting'),
          actions: [button(t('friends.cancel'), 'rk-quiet', () => void act((token) => options.api.remove(token, sent.id), 'friends.cancelled'), `c:${sent.id}`)],
        }),
      );
    }
    if (!cards.length) ul.append(h('li', { className: 'fr-empty', textContent: t('friends.none') }));
    ul.append(...cards);
    return ul;
  }

  function signedOut(): HTMLElement {
    return h('div', { className: 'fr-gate' }, [
      pixelIconSvg('friends', 'px-icon fr-gate-icon'),
      h('h3', { className: 'fr-gate-title', textContent: t('friends.gate.title') }),
      h('p', { className: 'fr-gate-body', textContent: t('friends.gate.body') }),
      button(t('friends.gate.cta'), 'rk-ember rk-wide', options.onAccount, 'account'),
      button(t('menu.back'), 'rk-quiet rk-wide', options.onBack, 'back'),
    ]);
  }

  function signedIn(view: FriendsView | null): HTMLElement {
    const copy = button(t('friends.copy'), 'rk-quiet', () => view && copyCode(view.code, copy), 'copy');
    copy.disabled = !view;
    const send = button(t('friends.send'), 'rk-ember', () => void add(), 'send');
    const addLabel = h('label', { className: 'fr-label', textContent: t('friends.addTitle') });
    addLabel.htmlFor = input.id;
    const side = h('section', { className: 'fr-side' }, [
      h('div', { className: 'fr-code-card' }, [h('span', { className: 'fr-label', textContent: t('friends.codeCard') }), h('span', { className: 'fr-code', textContent: view?.code ?? '········' }), copy]),
      h('div', { className: 'fr-add' }, [addLabel, h('div', { className: 'fr-add-row' }, [input, send])]),
      h('p', { className: 'fr-privacy', textContent: t('friends.privacy') }),
    ]);
    const head = h('div', { className: 'fr-head' }, [
      h('span', { className: 'fr-head-title', textContent: t('friends.list') }),
      h('span', { className: 'fr-head-online', textContent: view ? t('friends.onlineCount').replace('{n}', String(view.onlineCount)) : '' }),
      button(t('friends.reload'), 'rk-quiet', () => void load(true), 'reload'),
    ]);
    const cards = view ? list(view) : h('ul', { className: 'fr-list' }, [h('li', { className: 'fr-empty' }, [spinLoader({ label: t('friends.loading'), size: 48 })])]);
    return h('div', { className: 'fr-split' }, [side, h('section', { className: 'fr-main' }, [head, cards, status])]);
  }

  /** Redraws, keeping the focused control (by its key) and what is being typed. */
  function render(): void {
    const focusedKey = (document.activeElement as HTMLElement | null)?.dataset?.key;
    const typing = document.activeElement === input;
    if (gateFor(options.token()) === 'account') {
      body.replaceChildren(signedOut());
      body.querySelector<HTMLElement>('[data-key="account"]')?.focus({ preventScroll: true });
      return;
    }
    body.replaceChildren(
      signedIn(data ? friendsView(data, options.myRoom()) : null),
      h('div', { className: 'fr-foot' }, [button(t('menu.back'), 'rk-quiet', options.onBack, 'back'), h('p', { className: 'fr-hint', textContent: t('hub.hint') })]),
    );
    if (typing) input.focus();
    else (focusedKey ? body.querySelector<HTMLElement>(`[data-key="${CSS.escape(focusedKey)}"]`) : null)?.focus({ preventScroll: true });
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
    if (loud) say('');
    const first = data === null;
    const changed = JSON.stringify(result.value) !== JSON.stringify(data);
    data = result.value;
    if (first) options.onLoaded();
    if (changed) render();
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') void add();
  });

  const onKey = (e: KeyboardEvent): void => {
    if (!element.isConnected) {
      window.removeEventListener('keydown', onKey, true);
      return;
    }
    // The confirmation on top has the keys while it is open.
    if (e.ctrlKey || e.altKey || e.metaKey || document.querySelector('.rc-veil')) return;
    const target = document.activeElement as HTMLElement | null;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (target instanceof HTMLInputElement) target.blur();
      else options.onBack();
      return;
    }
    // A pad sends synthetic keys, which never click on their own.
    if ((e.key === 'Enter' || e.key === ' ') && target instanceof HTMLButtonElement) {
      e.preventDefault();
      target.click();
      return;
    }
    const dir = KEYS[e.code];
    if (!dir || (target instanceof HTMLInputElement && (dir === 'left' || dir === 'right'))) return;
    e.preventDefault();
    const controls = [...body.querySelectorAll<HTMLElement>('button:not(:disabled), input')];
    const at = target ? controls.indexOf(target) : -1;
    if (at < 0) {
      controls[0]?.focus({ preventScroll: true });
      return;
    }
    const points = controls.map((el, i) => {
      const r = el.getBoundingClientRect();
      return { id: String(i), x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const next = controls[Number(hubStep(points, String(at), dir))];
    next?.focus({ preventScroll: true });
    next?.scrollIntoView?.({ block: 'nearest' });
  };
  window.addEventListener('keydown', onKey, true);

  render();
  if (options.token()) {
    void load(true);
    poll = setInterval(() => {
      if (!document.hidden) void load(false);
    }, POLL_MS);
  }
  return {
    element,
    dispose: () => {
      disposed = true;
      window.removeEventListener('keydown', onKey, true);
      if (poll !== null) clearInterval(poll);
    },
  };
}
