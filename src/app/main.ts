import { SPECIES } from '../data/species';
import { loadSheets } from '../adapters/assets';
import { detectLanguage, setLanguage, t } from '../i18n';
import { startGame } from './game';

/** Bootstraps the page: language, the mandatory fan-project notice, then the sandbox. */
async function boot(root: HTMLElement): Promise<void> {
  const language = detectLanguage(navigator.language);
  setLanguage(language);
  document.documentElement.lang = language;
  document.title = t('app.title');

  const loading = document.createElement('p');
  loading.textContent = t('app.loading');
  const canvas = document.createElement('canvas');
  canvas.className = 'game';
  const footer = document.createElement('footer');
  footer.className = 'notice';
  for (const key of ['notice.fanProject', 'notice.sprites'] as const) {
    const line = document.createElement('p');
    line.textContent = t(key);
    footer.append(line);
  }
  root.replaceChildren(loading, footer);

  const sheets = await loadSheets();
  root.replaceChildren(canvas, footer);
  startGame(canvas, sheets, {
    loadout: SPECIES.mimikyu.defaultLoadout,
    lockMode: 'hold',
    onEnd: () => undefined,
  });
}

const root = document.getElementById('app');
if (root) void boot(root);
