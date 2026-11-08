import type { SheetStore } from '../adapters/assets';
import { PLAYABLE_SPECIES, SPECIES, type SpeciesId } from '../data/species';
import { t } from '../i18n';
import { pixelIconSvg } from '../ui/pixel-icons';
import { TYPE_COLORS } from '../ui/tokens';
import { attachPager } from '../ui/pager';
import { h, mdWindow } from '../ui/window';
import { hubStep } from './title-hub';
import '../styles/species-picker.css';

/**
 * The Pokémon picker (owner, 2026-11-03: "Mejora muchísimo más el selector de pokemon"):
 * a grid of cards (animated sprite, name, types, the current pick marked) beside a large
 * sheet for the card in focus (sprite on a rune circle lit in its type's colour, types,
 * life and speed bars, its passive or a plain "no passive"). Arrows move across the grid,
 * Enter or a click picks, Esc goes back. Fixed geometry: nothing resizes with the content.
 */

const maxHp = Math.max(...PLAYABLE_SPECIES.map((id) => SPECIES[id].maxHp));
const maxSpeed = Math.max(...PLAYABLE_SPECIES.map((id) => SPECIES[id].speedScale ?? 1));

/** Life and speed as shares of the roster's best (0..1]. */
export const speciesStats = (id: SpeciesId): { hp: number; speed: number } => ({
  hp: SPECIES[id].maxHp / maxHp,
  speed: (SPECIES[id].speedScale ?? 1) / maxSpeed,
});

/** The species' passive as i18n keys, or null when it has none. */
export const passiveOf = (id: SpeciesId): { nameKey: string; descriptionKey: string } | null => {
  const passive = SPECIES[id].passive;
  return passive ? { nameKey: `passive.${passive}`, descriptionKey: `passive.${passive}.description` } : null;
};

export interface SpeciesPickerOptions {
  roster: readonly SpeciesId[];
  current: SpeciesId;
  sheets: Promise<SheetStore>;
  portrait(sheets: Promise<SheetStore>, id: SpeciesId, scale: number): HTMLElement;
  typeBadge(type: (typeof SPECIES)[SpeciesId]['types'][number]): HTMLElement;
  /** Wears its shiny skin (the sheet shows a chip). */
  shiny(id: SpeciesId): boolean;
  context?: string;
  onPick(id: SpeciesId): void;
  onBack(): void;
}

export function speciesPicker(options: SpeciesPickerOptions): HTMLElement[] {
  const { roster } = options;
  const stage = h('div', { className: 'sp-stage' });
  const name = h('h2', { className: 'sp-name' });
  const types = h('div', { className: 'sp-types' });
  const stats = h('div', { className: 'sp-stats' });
  const passive = h('div', { className: 'sp-passive' });
  const choose = h('button', { className: 'sp-choose', type: 'button' }, [pixelIconSvg('play', 'px-icon'), h('span', { textContent: t('loadout.choose') })]);
  let focused: SpeciesId = roster.includes(options.current) ? options.current : roster[0]!;

  const fill = (share: number) => {
    const i = h('i');
    i.style.width = `${Math.round(share * 100)}%`;
    return i;
  };
  const bar = (label: string, share: number) =>
    h('div', { className: 'sp-stat' }, [h('span', { className: 'sp-stat-label', textContent: label }), h('span', { className: 'sp-stat-bar' }, [fill(share)])]);

  const show = (id: SpeciesId) => {
    focused = id;
    const species = SPECIES[id];
    const glow = TYPE_COLORS[species.types[0]!];
    stage.style.setProperty('--sp-glow', glow.core);
    stage.replaceChildren(h('div', { className: 'sp-stage-glow' }), h('div', { className: 'sp-stage-sprite sprite-box' }, [options.portrait(options.sheets, id, 5)]), h('div', { className: 'sp-stage-sign' }));
    name.textContent = t(`species.${id}`);
    types.replaceChildren(...species.types.map(options.typeBadge), ...(options.shiny(id) ? [h('span', { className: 'sp-chip sp-chip-shiny', textContent: t('loadout.shiny') })] : []));
    const s = speciesStats(id);
    stats.replaceChildren(bar(t('loadout.stat.hp'), s.hp), bar(t('loadout.stat.speed'), s.speed));
    const p = passiveOf(id);
    passive.replaceChildren(
      ...(p
        ? [h('p', { className: 'sp-passive-name' }, [h('span', { className: 'sp-gem' }), h('span', { textContent: t(p.nameKey) })]), h('p', { className: 'sp-passive-text', textContent: t(p.descriptionKey) })]
        : [h('p', { className: 'sp-passive-none', textContent: t('loadout.noPassive') })]),
    );
    choose.classList.toggle('is-current', id === options.current);
    for (const card of cards) card.classList.toggle('is-focused', card.dataset.species === id);
  };

  const cards = roster.map((id) => {
    const card = h('button', { className: `sp-card${id === options.current ? ' is-current' : ''}`, type: 'button' }, [
      h('span', { className: 'sp-card-art sprite-box' }, [options.portrait(options.sheets, id, 2)]),
      h('span', { className: 'sp-card-name', textContent: t(`species.${id}`) }),
      h('span', { className: 'sp-card-types' }, SPECIES[id].types.map(options.typeBadge)),
      ...(id === options.current ? [h('span', { className: 'sp-card-picked', textContent: t('loadout.picked') })] : []),
    ]);
    card.dataset.species = id;
    card.setAttribute('aria-label', `${t(`species.${id}`)}${id === options.current ? `, ${t('loadout.picked')}` : ''}`);
    card.addEventListener('mouseenter', () => show(id));
    card.addEventListener('focus', () => show(id));
    card.addEventListener('click', () => options.onPick(id));
    return card;
  });
  choose.addEventListener('click', () => options.onPick(focused));

  const grid = h('div', { className: 'sp-grid' }, cards);
  grid.setAttribute('aria-label', t('loadout.pick'));
  // Phones: the cards that do not fit turn into pages (src/ui/pager.ts) instead of a scrolling grid.
  const column = h('div', { className: 'sp-col' }, [grid]);
  const pager = attachPager(grid);
  const back = h('button', { className: 'sp-back', type: 'button', textContent: t('menu.back') });
  back.addEventListener('click', () => options.onBack());

  const sheet = h('section', { className: 'sp-sheet' }, [stage, name, types, stats, passive, choose]);
  const win = mdWindow({ title: t('loadout.pick'), className: 'sp-window' }, [
    ...(options.context ? [h('p', { className: 'dim sp-context', textContent: options.context })] : []),
    h('div', { className: 'sp-body' }, [sheet, column]),
    h('div', { className: 'sp-foot' }, [back, h('p', { className: 'sp-hint', textContent: t('hub.hint') })]),
  ]);

  const KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
  const onKey = (e: KeyboardEvent) => {
    if (!win.isConnected) {
      window.removeEventListener('keydown', onKey);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      options.onBack();
      return;
    }
    const dir = KEYS[e.code];
    if (!dir) return;
    e.preventDefault();
    const shown = new Set(pager.visible());
    const controls = [...cards.filter((c) => shown.has(c)), ...(pager.nav.hidden ? [] : [...pager.nav.querySelectorAll('button')].filter((b) => !b.disabled)), choose, back];
    const at = controls.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) {
      const card = cards.find((c) => c.dataset.species === focused);
      if (card) pager.focusItem(card);
      return;
    }
    const points = controls.map((el, i) => {
      const r = el.getBoundingClientRect();
      return { id: String(i), x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    controls[Number(hubStep(points, String(at), dir))]?.focus();
  };
  window.addEventListener('keydown', onKey);

  show(focused);
  queueMicrotask(() => {
    pager.refresh();
    const card = cards.find((c) => c.dataset.species === focused);
    if (card) pager.focusItem(card);
  });
  return [win];
}
