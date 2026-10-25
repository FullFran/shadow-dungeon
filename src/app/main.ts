import { detectLanguage, LANGUAGES, setLanguage, t, type Language } from '../i18n';

/** Bootstraps the page shell: language, title and the mandatory fan-project notice. */
function render(root: HTMLElement): void {
  document.documentElement.lang = document.documentElement.lang || 'es';
  document.title = t('app.title');

  const heading = document.createElement('h1');
  heading.textContent = t('app.title');

  const languageSelect = document.createElement('select');
  languageSelect.setAttribute('aria-label', t('language.label'));
  for (const language of LANGUAGES) {
    const option = document.createElement('option');
    option.value = language;
    option.textContent = t(`language.${language}`);
    languageSelect.append(option);
  }
  languageSelect.value = document.documentElement.lang;
  languageSelect.addEventListener('change', () => {
    applyLanguage(languageSelect.value as Language);
    render(root);
  });

  const footer = document.createElement('footer');
  footer.className = 'notice';
  for (const key of ['notice.fanProject', 'notice.sprites'] as const) {
    const line = document.createElement('p');
    line.textContent = t(key);
    footer.append(line);
  }

  root.replaceChildren(heading, languageSelect, footer);
}

function applyLanguage(language: Language): void {
  setLanguage(language);
  document.documentElement.lang = language;
}

const root = document.getElementById('app');
if (root) {
  applyLanguage(detectLanguage(navigator.language));
  render(root);
}
