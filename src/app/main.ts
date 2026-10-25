import { M0_SLOT_LAYOUT } from '../data/slots';
import type { MoveId } from '../data/moves';
import { loadSheets, type SheetStore } from '../adapters/assets';
import { createAudio } from '../adapters/audio';
import { browserStore } from '../adapters/storage';
import { detectLanguage, LANGUAGES, setLanguage, t, type Language } from '../i18n';
import { startGame, type GameResult, type RunningGame } from './game';
import { defaultSettings, loadSettings, saveSettings, slotOptions, type Settings } from './settings';

/**
 * Page flow: pre-run menu (loadout, language, click-to-lock, sound) -> sandbox
 * room -> boss room -> defeat or victory screen. Settings persist through the
 * storage port; the fan-project notice is always on screen. Audio starts on the
 * first user gesture (browsers block autoplay).
 */
const store = browserStore();
let settings: Settings = loadSettings(store, defaultSettings(detectLanguage(navigator.language)));
const audio = createAudio(settings);
const unlockAudio = () => audio.unlock();
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
let sheets: SheetStore | null = null;
let running: RunningGame | null = null;

/** Creates an element with plain properties (textContent, className, value, type...) and children. */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string> = {}, children: (Node | string)[] = []): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

function applyLanguage(language: Language): void {
  setLanguage(language);
  document.documentElement.lang = language;
  document.title = t('app.title');
}

function update(changes: Partial<Settings>): void {
  settings = { ...settings, ...changes };
  saveSettings(store, settings);
  audio.setVolumes(settings);
}

function notice(): HTMLElement {
  return el('footer', { className: 'notice' }, [el('p', { textContent: t('notice.fanProject') }), el('p', { textContent: t('notice.sprites') })]);
}

function show(root: HTMLElement, ...children: Node[]): void {
  running?.stop();
  running = null;
  root.replaceChildren(...children, notice());
}

function menu(root: HTMLElement): void {
  applyLanguage(settings.language);

  const languages = el(
    'div',
    { className: 'row', ariaLabel: t('language.label') },
    LANGUAGES.map((language) => {
      const button = el('button', { type: 'button', textContent: t(`language.${language}`) });
      button.setAttribute('aria-pressed', String(language === settings.language));
      button.addEventListener('click', () => {
        update({ language });
        menu(root);
      });
      return button;
    }),
  );

  const slots = M0_SLOT_LAYOUT.map((kind, index) => {
    const select = el(
      'select',
      {},
      slotOptions(kind).map((moveId) => el('option', { value: moveId, textContent: t(`move.${moveId}`) })),
    );
    select.value = settings.loadout[index] ?? '';
    select.addEventListener('change', () => {
      const loadout = [...settings.loadout];
      loadout[index] = select.value as MoveId;
      update({ loadout });
    });
    return el('label', {}, [`${t(`slot.${kind}`)} `, select]);
  });

  const clickToLock = el('input', { type: 'checkbox' });
  clickToLock.checked = settings.clickToLock;
  clickToLock.addEventListener('change', () => update({ clickToLock: clickToLock.checked }));
  const lock = el('label', {}, [clickToLock, ` ${t('menu.clickToLock')}`]);

  const volumes = (['masterVolume', 'musicVolume', 'sfxVolume'] as const).map((key) => {
    const slider = el('input', { type: 'range', min: '0', max: '1', step: '0.05' });
    slider.value = String(settings[key]);
    slider.addEventListener('input', () => update({ [key]: Number(slider.value) }));
    return el('label', {}, [`${t(`menu.${key}`)} `, slider]);
  });
  const mute = el('input', { type: 'checkbox' });
  mute.checked = settings.muted;
  mute.addEventListener('change', () => update({ muted: mute.checked }));

  const start = el('button', { type: 'button', className: 'primary', textContent: t('menu.start') });
  start.addEventListener('click', () => play(root));

  const controls = ['move', 'roll', 'fast', 'heavy', 'lock', 'clickLock', 'mute'].map((key) => el('li', { textContent: t(`menu.controls.${key}`) }));

  show(
    root,
    el('div', { className: 'panel' }, [
      el('h1', { textContent: t('app.title') }),
      el('p', { className: 'subtitle', textContent: t('menu.subtitle') }),
      languages,
      el('h2', { textContent: t('menu.loadout') }),
      el('div', { className: 'row' }, slots),
      el('h2', { textContent: t('menu.lockOn') }),
      el('div', { className: 'row' }, [lock]),
      el('h2', { textContent: t('menu.sound') }),
      el('div', { className: 'row' }, [...volumes, el('label', {}, [mute, ` ${t('menu.mute')}`])]),
      el('h2', { textContent: t('menu.controls') }),
      el('ul', {}, controls),
      el('p', { className: 'goal', textContent: t('menu.goal') }),
      start,
    ]),
  );
  start.focus();
}

function resultScreen(root: HTMLElement, result: GameResult): void {
  audio.setMusic(null);
  audio.play(result);
  const retry = el('button', { type: 'button', className: 'primary', textContent: t('screen.retry') });
  retry.addEventListener('click', () => play(root));
  const back = el('button', { type: 'button', textContent: t('screen.menu') });
  back.addEventListener('click', () => menu(root));
  show(
    root,
    el('div', { className: `panel ${result}` }, [
      el('h1', { textContent: t(`screen.${result}.title`) }),
      el('p', { textContent: t(`screen.${result}.text`) }),
      el('div', { className: 'row' }, [retry, back]),
    ]),
  );
  retry.focus();
}

async function play(root: HTMLElement): Promise<void> {
  if (!sheets) {
    show(root, el('p', { textContent: t('app.loading') }));
    sheets = await loadSheets();
  }
  const canvas = el('canvas', { className: 'game' });
  show(root, canvas);
  root.querySelector('.notice')?.classList.add('in-game');
  running = startGame(canvas, sheets, {
    loadout: settings.loadout,
    clickToLock: settings.clickToLock,
    seed: Date.now() | 0,
    audio,
    onToggleMute: () => update({ muted: !settings.muted }),
    onEnd: (result) => resultScreen(root, result),
  });
}

const root = document.getElementById('app');
if (root) {
  // Menu click: any button press on the pages (the game canvas has none).
  root.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('button')) audio.play('click');
  });
  menu(root);
}
