import type { SheetStore } from '../adapters/assets';
import { cursorList } from '../ui/cursor-list';
import { pixelIconSvg } from '../ui/pixel-icons';
import { h, mdWindow } from '../ui/window';
import type { EndActionId, EndCard, EndLine, EndView } from './end-model';
import { portrait } from './loadout';
import '../styles/end-screen.css';

/**
 * The relic end screen shared by every win and loss (owner, 2026-11-04): a header with the outcome
 * and the creature in the sprite box, cards that group the figures (Common Region), the Pokémonedas
 * with their pixel coin, and at most two actions, the primary (ember) first. It scrolls inside
 * its own cards region, never the page. Arrows or WASD move between the actions, Enter confirms,
 * Esc takes the primary one.
 */
export interface EndScreenOptions {
  view: EndView;
  sheets?: Promise<SheetStore>;
  onAction(id: EndActionId): void;
}

function lineEl(line: EndLine): HTMLElement {
  const value = h('span', { className: 'rs-value', textContent: line.value });
  return h('div', { className: `rs-line${line.tone ? ` is-${line.tone}` : ''}` }, [
    h('span', { className: 'rs-label', textContent: line.label }),
    h('span', { className: 'rs-figure' }, [line.badge ? h('span', { className: 'rs-badge', textContent: line.badge }) : null, line.tone === 'coin' ? pixelIconSvg('coin', 'px-icon rs-coin') : null, value]),
  ]);
}

function cardEl(card: EndCard): HTMLElement {
  const el = h('section', { className: `rs-card rs-card-${card.id}` }, [
    h('h3', { className: 'rs-card-title', textContent: card.title }),
    ...card.lines.map(lineEl),
    ...(card.notes ?? []).map((note) => h('p', { className: 'rs-note', textContent: note })),
  ]);
  el.dataset.card = card.id;
  return el;
}

export function endScreen(options: EndScreenOptions): HTMLElement {
  const { view } = options;
  const primary = view.actions[0]!;
  const list = cursorList({
    items: view.actions.map((a, i) => ({ label: a.label, className: i === 0 ? 'rs-primary' : 'rs-quiet', onConfirm: () => options.onAction(a.id) })),
    layout: 'horizontal',
    onBack: () => options.onAction(primary.id),
    label: view.title,
    className: 'rs-actions',
  });
  const art = h('div', { className: 'rs-art sprite-box' }, options.sheets ? [portrait(options.sheets, view.species, 3)] : []);
  const head = h('header', { className: 'rs-head' }, [
    art,
    h('div', { className: 'rs-head-text' }, [
      h('h1', { className: 'rs-title', textContent: view.title }),
      ...(view.subtitle ? [h('p', { className: 'rs-sub', textContent: view.subtitle })] : []),
      ...view.notes.map((note) => h('p', { className: 'rs-note', textContent: note })),
    ]),
  ]);
  const cards = h('div', { className: `rs-cards rs-cards-${Math.min(view.cards.length, 3)}` }, view.cards.map(cardEl));
  return mdWindow({ className: `result rs-window ${view.outcome}` }, [head, cards, list.element]);
}

/** The dim layer an end screen sits in over the frozen last frame of the run (never over the title's backdrop). */
export function endVeil(window: HTMLElement): HTMLElement {
  return h('div', { className: 'rs-veil' }, [window]);
}
