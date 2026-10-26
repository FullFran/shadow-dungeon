import { GACHA, GACHA_POOL, type GachaRarity } from '../data/gacha';
import type { SpeciesId } from '../data/species';
import { pull, type PullResult } from '../core/gacha';
import type { SheetStore } from '../adapters/assets';
import type { KeyValueStore } from '../adapters/storage';
import { t } from '../i18n';
import { cursorList } from '../ui/cursor-list';
import { describedMenu, ghost, reservedBox } from '../ui/describe';
import { h, mdWindow, statLine } from '../ui/window';
import { coinText } from './coin-lines';
import { portrait } from './loadout';
import { loadSave, writeSave, type SaveData } from './save';

/**
 * Mimikyu's gacha stall (odd/tasks/gacha-evolutions.md T5): an MD-style
 * window over the town with the balance, the price, the rates per rarity
 * and the pulls left to a sure rare, and one Pull row. A pull is saved at
 * once and plays a short reveal in the rarity's colour (a tap on it or the
 * next pull ends it early): the species' idle sprite in a frame of that
 * colour, a silhouette until the name shows. The numbers come from data/gacha.ts. Evolving
 * is Phantump's window (app/evolve.ts). A shiny pull (odd/tasks/shiny-echo.md)
 * reveals the shiny sheet with a sparkle and "¡Shiny!"; the window also shows
 * the shiny rate and the pulls left to a sure one.
 */
export interface StallInfo {
  cost: number;
  canPull: boolean;
  /** Pulls until a rare is sure (the hard pity). */
  pityLeft: number;
  /** The shiny chance per pull (%) and the pulls until a shiny is sure. */
  shiny: { percent: number; pityLeft: number };
  rates: { rarity: GachaRarity; percent: number; species: SpeciesId[] }[];
}

export function stallInfo(save: SaveData): StallInfo {
  const rate = (rarity: GachaRarity) => Math.round((rarity === 'rare' ? GACHA.rareRate : 1 - GACHA.rareRate) * 100);
  return {
    cost: GACHA.cost,
    canPull: save.coins >= GACHA.cost,
    pityLeft: GACHA.hardPity - (save.pity ?? 0),
    shiny: { percent: GACHA.shinyRate * 100, pityLeft: GACHA.shinyPity - (save.shinyPity ?? 0) },
    rates: (['common', 'rare'] as const).map((rarity) => ({ rarity, percent: rate(rarity), species: GACHA_POOL.filter((e) => e.rarity === rarity).map((e) => e.species) })),
  };
}

/** One pull from the stored save, written at once; null (nothing written) without the Pokémonedas. */
export function pullAt(store: KeyValueStore, rng: number): { result: PullResult; save: SaveData } | null {
  const save = loadSave(store);
  const pulled = pull(save, rng);
  if (!pulled) return null;
  writeSave(store, { ...save, ...pulled.state, owned: [...(pulled.state.owned ?? [])] });
  return { result: pulled.result, save: loadSave(store) };
}

/** "¡Abra! (rara)", or a duplicate with its refund; a shiny starts with "¡Shiny!". */
export function revealText(result: PullResult): string {
  const key = result.duplicate ? 'gacha.reveal.duplicate' : 'gacha.reveal.new';
  return (result.shiny ? `${t('gacha.reveal.shiny')} ` : '') + t(key)
    .replace('{species}', t(`species.${result.species}`))
    .replace('{rarity}', t(`gacha.rarity.${result.rarity}`))
    .replace('{refund}', coinText(result.refund, (k) => t(k)));
}

/** How long the reveal holds the suspense before it shows the result. */
export const REVEAL_MS = 1500;

export interface GachaOptions {
  store: KeyValueStore;
  /** The sprite sheets (the reveal's portrait). */
  sheets: Promise<SheetStore>;
  play?(sound: 'coin' | 'denied'): void;
  onBack(): void;
}

export function gachaWindow(options: GachaOptions): { element: HTMLElement; dispose(): void } {
  let save = loadSave(options.store);
  const balance = h('div', { className: 'shop-balance' });
  const text = h('p', {});
  const art = h('div', {});
  const reveal = h('div', { className: 'gacha-reveal' }, [art, text]);
  const effect = h('div', { className: 'shop-effect' }, [reveal, h('p', { className: 'dim', textContent: t('gacha.text') })]);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let shown: (() => void) | null = null;

  /** Ends a running reveal at once (the next pull, a tap or closing). */
  const finishReveal = () => {
    clearTimeout(timer);
    shown?.();
    shown = null;
  };
  reveal.addEventListener('click', finishReveal);

  const revealFrame = (sprite: HTMLElement) => {
    const frame = h('div', { className: 'portrait-frame' }, [sprite]);
    frame.style.cssText = 'border: 2px solid currentColor; background: none';
    return frame;
  };
  // The reveal's room is kept from the start, one ghost per species of the pool (src/ui/describe.ts): a pull never resizes the window under the Pull row.
  const reserved = GACHA_POOL.map((entry) =>
    ghost([
      h('div', { className: 'shop-effect' }, [
        h('div', { className: 'gacha-reveal' }, [
          h('div', {}, [revealFrame(portrait(options.sheets, entry.species))]),
          h('p', { textContent: revealText({ species: entry.species, rarity: entry.rarity, duplicate: true, refund: GACHA.cost, shiny: true }) }),
        ]),
        h('p', { className: 'dim', textContent: t('gacha.text') }),
      ]),
    ]),
  );

  const startReveal = (result: PullResult) => {
    finishReveal();
    reveal.className = `gacha-reveal is-${result.rarity}`;
    // The frame takes the rarity's colour from the reveal (`currentColor`).
    const sprite = portrait(options.sheets, result.species, undefined, result.shiny);
    sprite.style.filter = 'brightness(0)';
    const frame = revealFrame(sprite);
    art.replaceChildren(frame);
    text.textContent = t('gacha.reveal.wait');
    shown = () => {
      sprite.style.filter = '';
      text.textContent = revealText(result);
      // A shiny: the sparkle over the frame (index.html `.is-shiny`).
      if (result.shiny) {
        reveal.classList.add('is-shiny');
        frame.append(h('span', { className: 'shiny-sparkle', textContent: '✦' }));
      }
    };
    timer = setTimeout(finishReveal, REVEAL_MS);
  };

  const list = cursorList({ items: [], onBack: options.onBack, label: t('gacha.title'), className: 'shop-list' });

  function refresh(): void {
    const info = stallInfo(save);
    balance.replaceChildren(
      statLine(t('screen.coins.balance'), coinText(save.coins, (k) => t(k))),
      ...info.rates.map((r) => statLine(`${t(`gacha.rarity.${r.rarity}`)} ${r.percent} %`, r.species.map((s) => t(`species.${s}`)).join(', '))),
      statLine(t('gacha.pity'), t('gacha.pulls').replace('{n}', String(info.pityLeft))),
      statLine(`${t('gacha.shiny')} ${String(info.shiny.percent).replace('.', t('gacha.decimal'))} %`, t('gacha.pulls').replace('{n}', String(info.shiny.pityLeft))),
    );
    list.setItems([
      {
        label: t('gacha.pull'),
        value: coinText(info.cost, (k) => t(k)),
        className: info.canPull ? 'shop-row' : 'shop-row is-disabled',
        onConfirm: () => {
          const pulled = pullAt(options.store, (Math.random() * 2 ** 31) | 0);
          if (!pulled) {
            options.play?.('denied');
            return;
          }
          options.play?.('coin');
          save = pulled.save;
          startReveal(pulled.result);
          refresh();
        },
      },
      { label: t('menu.back'), onConfirm: options.onBack },
    ]);
  }

  refresh();
  const element = mdWindow({ title: t('gacha.title'), className: 'shop gacha stall' }, [h('p', { textContent: t('gacha.intro') }), balance, describedMenu(list.element, reservedBox([effect], reserved))]);
  return {
    element,
    dispose: () => {
      clearTimeout(timer);
      list.dispose();
    },
  };
}
