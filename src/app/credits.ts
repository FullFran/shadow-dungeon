import creditsMarkdown from '../../CREDITS.md?raw';
import { MUSIC_TRACKS } from '../data/music';
import { buildLabel } from './build-info';
import { t } from '../i18n';
import { CREDITS_CONTROLS_ICONS } from '../ui/icons/credits-controls-icons';
import { pixelSvgOf } from '../ui/pixel-icons';
import { h, mdWindow } from '../ui/window';
import '../styles/credits-controls.css';

/**
 * The Credits screen (odd/tasks/title-hub.md T11): sections with a pixel icon each
 * (team, sprites, fonts, tiles, music and sound, libraries and data, legal
 * notice). The sprite artists are read from CREDITS.md (so the screen never
 * drifts from the generated file) and shown as compact cards whose species list
 * opens with a disclosure button; nothing of the attribution is dropped.
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

/** A person behind the game. */
export interface TeamMember {
  id: string;
  name: string;
  roleKey: string;
  icon: string;
  link?: string;
}

/** The creator is Fran (the repository owner, github.com/FullFran); Álvaro Fernández designed and built the frontend. */
export const TEAM: readonly TeamMember[] = [
  { id: 'fran', name: 'Fran', roleKey: 'credits.role.creator', icon: 'creator', link: 'https://github.com/FullFran' },
  { id: 'alvaro', name: 'Álvaro Fernández', roleKey: 'credits.role.frontend', icon: 'designer' },
];

export interface CreditsSection {
  id: 'team' | 'sprites' | 'fonts' | 'tiles' | 'music' | 'libraries' | 'legal';
  titleKey: string;
  icon: string;
}

/** Seven sections, in reading order (Miller: well under the limit). */
export const CREDITS_SECTIONS: readonly CreditsSection[] = [
  { id: 'team', titleKey: 'credits.section.team', icon: 'team' },
  { id: 'sprites', titleKey: 'credits.section.sprites', icon: 'sprites' },
  { id: 'fonts', titleKey: 'credits.section.fonts', icon: 'font' },
  { id: 'tiles', titleKey: 'credits.section.tiles', icon: 'tiles' },
  { id: 'music', titleKey: 'credits.section.music', icon: 'music' },
  { id: 'libraries', titleKey: 'credits.section.libraries', icon: 'code' },
  { id: 'legal', titleKey: 'credits.section.legal', icon: 'legal' },
];

/** The species entries of one artist ("abra (0063), mimikyu (0778/0001)"), split on the commas outside parentheses. */
export function splitSprites(text: string): string[] {
  return text.split(/,\s*(?![^()]*\))/).filter((entry) => entry.length > 0);
}

const isUrl = (text: string) => /^https?:\/\//.test(text);
const SPRITE_LICENCE = { label: 'CC BY-NC 4.0', url: 'https://creativecommons.org/licenses/by-nc/4.0/' };
const SPRITE_SOURCE = 'https://github.com/PMDCollab/SpriteCollab';

const icon = (id: string, className = 'cc-icon') => pixelSvgOf(CREDITS_CONTROLS_ICONS[id]!, className);
const link = (href: string, text: string, className = 'cc-nav') => h('a', { className, href, target: '_blank', rel: 'noopener noreferrer', textContent: text });
const chip = (text: string, href?: string) => (href ? link(href, text, 'cc-chip cc-nav') : h('span', { className: 'cc-chip', textContent: text }));

function section(def: CreditsSection, children: Node[]): HTMLElement {
  return h('section', { className: `cc-section cc-${def.id}` }, [h('header', { className: 'cc-head' }, [icon(def.icon, 'cc-icon cc-icon-head'), h('h3', { textContent: t(def.titleKey) })]), ...children]);
}

function teamCard(member: TeamMember): HTMLElement {
  return h('li', { className: `cc-card cc-member cc-member-${member.id}` }, [
    icon(member.icon, 'cc-icon cc-icon-role'),
    h('div', { className: 'cc-member-text' }, [member.link ? link(member.link, member.name, 'cc-name cc-nav') : h('span', { className: 'cc-name', textContent: member.name }), h('span', { className: 'cc-role', textContent: t(member.roleKey) })]),
  ]);
}

/** One artist: name, contact, how many sprites, and a disclosure button for the species list. */
function artistCard(artist: CreditedArtist, index: number): HTMLElement {
  const species = splitSprites(artist.sprites);
  const listId = `cc-species-${index}`;
  const contact = artist.contact ? (isUrl(artist.contact) ? link(artist.contact, artist.contact.replace(/^https?:\/\//, '').replace(/\/$/, ''), 'cc-contact cc-nav') : h('span', { className: 'cc-contact', textContent: artist.contact })) : null;
  const list = h('ul', { className: 'cc-species', id: listId }, species.map((entry) => h('li', { textContent: entry })));
  list.hidden = true;
  const label = h('span', { textContent: t('credits.showSprites') });
  const toggle = h('button', { type: 'button', className: 'cc-toggle cc-nav' }, [icon('chevron', 'cc-icon cc-chevron'), label]);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', listId);
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    list.hidden = !open;
    label.textContent = t(open ? 'credits.hideSprites' : 'credits.showSprites');
  });
  return h('li', { className: 'cc-card cc-artist' }, [
    h('span', { className: 'cc-name', textContent: artist.name }),
    h('div', { className: 'cc-artist-meta' }, [chip(species.length === 1 ? t('credits.spriteOne') : t('credits.spriteCount').replace('{n}', String(species.length))), contact]),
    toggle,
    list,
  ]);
}

/** Up/Down/Left/Right/Home/End walk the links and buttons of the list; Enter and Space stay with the focused control (never the screen's "back"). */
function walkKeys(scroll: HTMLElement): void {
  scroll.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const target = e.target as HTMLElement;
    const items = [...scroll.querySelectorAll<HTMLElement>('.cc-nav')].filter((el) => el.offsetParent !== null);
    const at = items.indexOf(target);
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key as 'ArrowDown'];
    if (step || e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : at < 0 ? (step! > 0 ? 0 : items.length - 1) : Math.min(items.length - 1, Math.max(0, at + step!));
      items[next]?.focus();
      items[next]?.scrollIntoView?.({ block: 'nearest' });
    } else if ((e.key === 'Enter' || e.key === ' ') && at >= 0) e.stopPropagation();
  });
}

/** The credits window; `footer` holds the way back (Esc is its "back"). */
export function creditsWindow(footer: HTMLElement): HTMLElement {
  const artists = creditedArtists(creditsMarkdown).map(artistCard);
  const [team, sprites, fonts, tiles, music, libraries, legal] = CREDITS_SECTIONS as readonly [CreditsSection, CreditsSection, CreditsSection, CreditsSection, CreditsSection, CreditsSection, CreditsSection];
  const tracks = Object.values(MUSIC_TRACKS).filter((track) => !track.variantOf);
  const scroll = h('div', { className: 'cc-scroll' }, [
    section(team, [h('ul', { className: 'cc-grid cc-team-grid' }, TEAM.map(teamCard))]),
    section(sprites, [
      h('p', { textContent: t('credits.sprites') }),
      h('p', { className: 'cc-chips' }, [chip(`${t('credits.licence')}: ${SPRITE_LICENCE.label}`, SPRITE_LICENCE.url), chip('PMDCollab SpriteCollab', SPRITE_SOURCE)]),
      h('ul', { className: 'cc-grid cc-artist-grid' }, artists),
    ]),
    section(fonts, [h('p', { textContent: t('credits.font') }), h('p', { textContent: t('credits.fontText') })]),
    section(tiles, [h('p', { textContent: t('credits.tiles') })]),
    section(music, [
      h('p', { textContent: t('credits.music') }),
      h('ul', { className: 'cc-tracks' }, tracks.map((track) => h('li', {}, [chip(track.license), link(track.sourceUrl, track.attribution, 'cc-track cc-nav')]))),
      h('p', { textContent: t('credits.audio') }),
    ]),
    section(libraries, [h('p', { textContent: t('credits.effects') }), h('p', { textContent: t('credits.data') }), h('p', { textContent: t('credits.code') })]),
    section(legal, [h('p', { textContent: t('notice.fanProject') }), h('p', { className: 'cc-version', textContent: `${t('credits.version')}: ${buildLabel()}` })]),
  ]);
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', t('credits.scrollLabel'));
  walkKeys(scroll);
  return mdWindow({ title: t('credits.title'), className: 'wide credits-screen' }, [scroll, footer]);
}
