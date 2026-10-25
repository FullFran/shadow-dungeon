import creditsMarkdown from '../../CREDITS.md?raw';
import { t } from '../i18n';
import { h, mdWindow } from '../ui/window';

/**
 * The Credits screen: the fan-project notice, the sprite artists read from
 * CREDITS.md (so the screen never drifts from the generated file), the font
 * and the audio.
 */
export interface CreditedArtist {
  name: string;
  /** Null when the table says "-". */
  contact: string | null;
  sprites: string;
}

/** Rows of the artist table in CREDITS.md (`| Artist | Contact | Sprites |`). */
export function creditedArtists(markdown: string): CreditedArtist[] {
  const out: CreditedArtist[] = [];
  let inTable = false;
  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      inTable = false;
      continue;
    }
    const cells = trimmed.slice(1, trimmed.endsWith('|') ? -1 : undefined).split('|').map((c) => c.trim());
    if (cells[0] === 'Artist') {
      inTable = true;
      continue;
    }
    if (!inTable || cells.every((c) => /^-+$/.test(c)) || cells.length < 3) continue;
    out.push({ name: cells[0]!, contact: cells[1] === '-' || !cells[1] ? null : cells[1], sprites: cells[2]! });
  }
  return out;
}

const isUrl = (text: string) => /^https?:\/\//.test(text);

/** The credits window; `footer` holds the way back. */
export function creditsWindow(footer: HTMLElement): HTMLElement {
  const artists = creditedArtists(creditsMarkdown).map((artist) => {
    const contact = artist.contact
      ? isUrl(artist.contact)
        ? h('a', { href: artist.contact, target: '_blank', rel: 'noopener noreferrer', textContent: artist.contact.replace(/^https?:\/\//, '') })
        : h('span', { textContent: artist.contact })
      : null;
    return h('li', {}, [h('strong', { textContent: artist.name }), contact ? h('span', { className: 'dim' }, [' · ', contact]) : null, h('div', { className: 'dim credit-sprites', textContent: artist.sprites })]);
  });
  return mdWindow({ title: t('credits.title'), className: 'wide credits' }, [
    h('div', { className: 'credit-scroll' }, [
      h('p', { textContent: t('notice.fanProject') }),
      h('p', { textContent: t('credits.sprites') }),
      h('ul', { className: 'credit-list' }, artists),
      h('p', { textContent: t('credits.font') }),
      h('p', { textContent: t('credits.audio') }),
    ]),
    footer,
  ]);
}
