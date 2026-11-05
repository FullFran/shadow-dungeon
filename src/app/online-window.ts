import { t } from '../i18n';
import { pixelIconSvg, type PixelIconId } from '../ui/pixel-icons';
import { h } from '../ui/window';
import { hubStep } from './title-hub';
import { joinAttempt, onlineModel, type OnlineAction } from './online-model';
import '../styles/relic-controls.css';
import '../styles/online.css';

export interface OnlineWindowOptions {
  /** A code from the link (`?room=CODE`), already valid, or ''. */
  prefill: string;
  nickname: string;
  /** Saves the nickname as typed; returns the clean value to show. */
  saveNickname(value: string): string;
  onCreate(): void;
  onJoin(code: string): void;
  onBack(): void;
}

const KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

const button = (label: string, variant: string, onClick: () => void, key: string): HTMLButtonElement => {
  const el = h('button', { type: 'button', className: `rk-btn ${variant}`, textContent: label });
  el.dataset.key = key;
  el.addEventListener('click', onClick);
  return el;
};

/**
 * "Play online" in the relic pattern (.agents/DESIGN.md §4 Online window):
 * your name in the room on top, then two equal cards (create a room, join one
 * by code) with a single ember action, and Back. Arrows move between controls,
 * Enter acts, Esc goes back (or leaves a field first).
 */
export function onlineWindow(options: OnlineWindowOptions): { element: HTMLElement; dispose(): void } {
  const model = onlineModel(options.prefill);
  const variant = (action: OnlineAction) => (model.primary === action ? 'rk-ember rk-wide' : 'rk-wide');

  const nickname = h('input', { type: 'text', className: 'rk-input ol-nick', placeholder: t('nickname.placeholder'), value: options.nickname, id: 'ol-nick' });
  nickname.maxLength = 32;
  nickname.autocomplete = 'off';
  nickname.spellcheck = false;
  nickname.enterKeyHint = 'done';
  const nickLabel = h('label', { className: 'ol-label', textContent: t('settings.nickname') });
  nickLabel.htmlFor = nickname.id;
  const save = () => {
    nickname.value = options.saveNickname(nickname.value);
  };
  nickname.addEventListener('change', save);
  nickname.addEventListener('blur', save);

  const code = h('input', { type: 'text', className: 'rk-input code-input ol-code', placeholder: t('lobby.codePlaceholder'), value: model.code, id: 'ol-code' });
  code.maxLength = 7;
  code.autocomplete = 'off';
  code.spellcheck = false;
  // Soft keyboard: capitals, no autocorrect, a Go key that submits like Enter.
  code.setAttribute('autocapitalize', 'characters');
  code.setAttribute('autocorrect', 'off');
  code.enterKeyHint = 'go';
  code.setAttribute('aria-label', t('lobby.joinCode'));
  code.setAttribute('aria-describedby', 'ol-error');
  const error = h('p', { className: 'ol-error', id: 'ol-error' });
  error.setAttribute('role', 'alert');

  const join = () => {
    const attempt = joinAttempt(code.value);
    if (attempt.ok) return options.onJoin(attempt.code);
    error.textContent = t(attempt.reason === 'empty' ? 'online.emptyCode' : 'lobby.invalidCode');
    code.setAttribute('aria-invalid', 'true');
    code.focus();
  };
  code.addEventListener('input', () => {
    error.textContent = '';
    code.removeAttribute('aria-invalid');
  });

  const createBtn = button(t('lobby.create'), variant('create'), options.onCreate, 'create');
  const joinBtn = button(t('lobby.join'), variant('join'), join, 'join');

  const card = (icon: PixelIconId, title: string, body: string, controls: HTMLElement[]): HTMLElement =>
    h('section', { className: 'ol-card' }, [
      h('div', { className: 'ol-card-head' }, [pixelIconSvg(icon, 'px-icon ol-icon'), h('h3', { className: 'ol-card-title', textContent: title })]),
      h('p', { className: 'ol-card-body', textContent: body }),
      h('div', { className: 'ol-card-controls' }, controls),
    ]);

  const body = h('div', { className: 'ol-body' }, [
    h('div', { className: 'ol-nick-row' }, [h('div', { className: 'ol-nick-text' }, [nickLabel, h('span', { className: 'ol-hint', textContent: t('online.nickname.hint') })]), nickname]),
    h('div', { className: 'ol-cards' }, [
      card('room', t('lobby.create'), t('online.create.body'), [createBtn]),
      card('online', t('lobby.joinCode'), t('online.join.body'), [code, joinBtn, error]),
    ]),
    h('div', { className: 'ol-foot' }, [button(t('menu.back'), 'rk-quiet', options.onBack, 'back'), h('p', { className: 'ol-foot-hint', textContent: t('hub.hint') })]),
  ]);
  const element = h('section', { className: 'md-window ol-window' }, [h('h2', { className: 'md-window-title', textContent: t('lobby.online') }), body]);
  element.setAttribute('aria-label', t('lobby.online'));

  const onKey = (e: KeyboardEvent): void => {
    if (!element.isConnected) {
      window.removeEventListener('keydown', onKey, true);
      return;
    }
    if (e.ctrlKey || e.altKey || e.metaKey || document.querySelector('.rc-veil')) return;
    const target = document.activeElement as HTMLElement | null;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (target instanceof HTMLInputElement) target.blur();
      else options.onBack();
      return;
    }
    if (e.key === 'Enter' && target === code) {
      e.preventDefault();
      join();
      return;
    }
    if (e.key === 'Enter' && target === nickname) {
      e.preventDefault();
      nickname.blur();
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
    if (at < 0) return void controls[0]?.focus({ preventScroll: true });
    const points = controls.map((el, i) => {
      const r = el.getBoundingClientRect();
      return { id: String(i), x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    controls[Number(hubStep(points, String(at), dir))]?.focus({ preventScroll: true });
  };
  window.addEventListener('keydown', onKey, true);
  // Focus once mounted, on the ember action.
  requestAnimationFrame(() => (model.focus === 'join' ? joinBtn : createBtn).focus({ preventScroll: true }));

  return { element, dispose: () => window.removeEventListener('keydown', onKey, true) };
}
