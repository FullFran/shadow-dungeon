import type { SheetStore } from '../adapters/assets';
import type { SoundId } from '../adapters/audio';
import type { KeyValueStore } from '../adapters/storage';
import type { PullResult } from '../core/gacha';
import { GACHA, type GachaRarity } from '../data/gacha';
import { t } from '../i18n';
import { buildStall, cameraFor, STALL, STALL_LIGHTS } from '../ui/gacha-stall';
import { GACHA_ICONS } from '../ui/icons/gacha-icons';
import { pixelIconSvg, pixelSvgOf } from '../ui/pixel-icons';
import { RARITY } from '../ui/tokens';
import { h } from '../ui/window';
import { coinText } from './coin-lines';
import { pullAt, revealText, stallInfo } from './gacha';
import { collectionStrip, pityView, pullState, revealPlan, type PityBar, type RevealStep } from './gacha-model';
import { portrait } from './loadout';
import { loadSave } from './save';
import { hubStep } from './title-hub';
import '../styles/gacha-page.css';

/**
 * The gacha as a full page, /gacha (owner, 2026-11-03: "Gacha lo haremos todo completamente
 * visual en una pagina aparte"; odd/tasks/gacha-page.md; .agents/DESIGN.md). Mimikyu's stall
 * is the whole screen (src/ui/gacha-stall.ts, prerendered once, Mimikyu's real sprite
 * standing on the counter); the right dock holds the two pull buttons with their cost, the
 * odds and the pity counters, all always visible beside the buttons; the collection strip
 * sits under the stall. A pull plays a capsule that drops, shakes, cracks in the rarity's
 * colour and flips the result card; a ten reveals capsule by capsule. Every rule is
 * the window's (core/gacha.ts via `pullAt`): the cost, the odds, the pity, the shiny pity,
 * the refund of a duplicate, the sounds and the achievements settle on leaving (main.ts).
 * Motion has a reason (anticipation, then payoff), is skippable at any time and is
 * instant under prefers-reduced-motion. No timers, no scarcity, no pressure copy.
 */
export interface GachaPageOptions {
  store: KeyValueStore;
  sheets: Promise<SheetStore>;
  play?(sound: SoundId): void;
  touch: boolean;
  /** Reduced motion (default: the media query). */
  reduced?(): boolean;
  /** Back, Esc: the caller returns where the page was opened from. */
  onBack(): void;
}

const SHINY_COLOR = '#ff9be8';
const icon = (id: string, className = 'px-icon'): SVGSVGElement => pixelSvgOf(GACHA_ICONS[id]!, className);
const percentText = (value: number): string => String(value).replace('.', t('gacha.decimal'));
const coins = (n: number): string => coinText(n, (k) => t(k));

/** The sound a result gets when its capsule cracks: the rarer, the brighter. */
export const soundFor = (result: PullResult): SoundId => (result.shiny || result.rarity === 'rare' ? 'levelUp' : result.duplicate ? 'coin' : 'item');

const KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };

export function gachaPage(options: GachaPageOptions): { element: HTMLElement; focus(): void; dispose(): void } {
  let save = loadSave(options.store);
  const reduced = (): boolean => options.reduced?.() ?? (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const play = (sound: SoundId): void => options.play?.(sound);
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number): void => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };
  const clearTimers = (): void => {
    for (const id of timers) window.clearTimeout(id);
    timers.clear();
  };

  // --- The stall: a prerendered scene, Mimikyu's live sprite on its counter, and CSS lights (the only things that move).
  const art = Object.assign(document.createElement('canvas'), { width: STALL.w, height: STALL.h, className: 'gp-art' });
  art.getContext('2d')?.drawImage(buildStall(), 0, 0);
  const sprite = portrait(options.sheets, 'mimikyu', 1);
  const mimikyu = h('div', { className: 'gp-mimikyu' }, [sprite]);
  mimikyu.style.left = `${STALL.stand.x - 16}px`;
  mimikyu.style.top = `${STALL.stand.y - 28}px`;
  const lights = STALL_LIGHTS.map((light, i) => {
    const el = h('div', { className: `gp-light gp-light-${i}` });
    el.style.cssText = `left:${light.x - light.r}px;top:${light.y - light.r}px;width:${light.r * 2}px;height:${light.r * 2}px;--gp-light:${light.color};--gp-op:${light.op}`;
    return el;
  });
  const world = h('div', { className: 'gp-world' }, [art, mimikyu, ...lights, h('div', { className: 'gp-fog' })]);

  const say = h('p', { className: 'gp-say' });
  say.setAttribute('role', 'status');
  const bubble = h('div', { className: 'gp-bubble' }, [say]);
  const sayKey = (key: string): void => {
    say.textContent = t(key);
  };

  // --- Header: back, title, balance.
  const back = h('button', { className: 'gp-back', type: 'button' }, [icon('back', 'px-icon'), h('span', { textContent: t('gacha.page.back') })]);
  back.dataset.gp = 'back';
  back.addEventListener('click', () => options.onBack());
  const balanceValue = h('span', { className: 'gp-chip-value' });
  const balance = h('div', { className: 'gp-chip' }, [pixelIconSvg('coin'), balanceValue]);
  const header = h('header', { className: 'gp-top' }, [
    back,
    h('div', { className: 'gp-title' }, [h('h1', { textContent: t('gacha.title') }), h('p', { textContent: t('gacha.intro') })]),
    balance,
  ]);

  // --- The dock: pull buttons with cost, reason and odds beside them.
  const info = stallInfo(save);
  const pullButton = (count: 1 | 10): { column: HTMLElement; button: HTMLButtonElement; reason: HTMLElement } => {
    const button = h('button', { className: `gp-pull gp-pull-${count}`, type: 'button' }, [
      icon(count === 1 ? 'pull' : 'pullTen', 'px-icon gp-pull-icon'),
      h('span', { className: 'gp-pull-text' }, [h('span', { className: 'gp-pull-name', textContent: t(count === 1 ? 'gacha.page.pull1' : 'gacha.page.pull10') }), h('small', { className: 'gp-pull-cost', textContent: coins(GACHA.cost * count) })]),
    ]);
    button.dataset.gp = `pull${count}`;
    const reason = h('p', { className: 'gp-reason', id: `gp-reason-${count}` });
    button.setAttribute('aria-describedby', reason.id);
    button.addEventListener('click', () => doPull(count));
    return { column: h('div', { className: 'gp-pull-col' }, [button, reason]), button, reason };
  };
  const pull1 = pullButton(1);
  const pull10 = pullButton(10);
  const oddsLine = h('p', { className: 'gp-oddsline', textContent: [...info.rates.map((r) => t('gacha.page.odds.line').replace('{rarity}', t(`gacha.rarity.${r.rarity}`)).replace('{percent}', String(r.percent))), t('gacha.page.odds.shiny').replace('{percent}', percentText(info.shiny.percent))].join(' · ') });
  const pullDock = h('section', { className: 'gp-panel gp-pulls' }, [h('div', { className: 'gp-pull-row' }, [pull1.column, pull10.column]), oddsLine]);

  const rarityDot = (rarity: GachaRarity): HTMLElement => {
    const dot = h('i', { className: 'gp-dot' });
    dot.style.setProperty('--gp-rarity', RARITY[rarity]);
    return dot;
  };
  const odds = h('section', { className: 'gp-panel gp-odds' }, [
    h('div', { className: 'gp-panel-head' }, [h('h2', { textContent: t('gacha.page.odds.title') }), h('span', { textContent: t('gacha.page.lines.title') })]),
    ...info.rates.map((r) =>
      h('div', { className: 'gp-odds-row' }, [
        h('span', { className: 'gp-odds-rarity' }, [rarityDot(r.rarity), `${t(`gacha.rarity.${r.rarity}`)} ${r.percent} %`]),
        h('span', { className: 'gp-odds-lines', textContent: r.species.map((s) => t(`species.${s}`)).join(', ') }),
      ]),
    ),
    h('div', { className: 'gp-odds-row' }, [
      h('span', { className: 'gp-odds-rarity' }, [icon('sparkle', 'px-icon gp-odds-spark'), `${t('gacha.shiny')} ${percentText(info.shiny.percent)} %`]),
      h('span', { className: 'gp-odds-lines', textContent: t('gacha.page.collection.shiny') }),
    ]),
    h('p', { className: 'gp-note', textContent: t('gacha.page.odds.note') }),
  ]);

  const pity = h('section', { className: 'gp-panel gp-pity' });
  const meter = (label: string, bar: PityBar, segments: boolean): HTMLElement => {
    const track = h('div', { className: `gp-meter${segments ? ' is-segments' : ''}` });
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-label', label);
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', String(bar.total));
    track.setAttribute('aria-valuenow', String(bar.filled));
    if (segments) for (let i = 0; i < bar.total; i++) track.append(h('i', { className: i < bar.filled ? 'on' : '' }));
    else {
      const fill = h('i', { className: 'fill' });
      fill.style.width = `${Math.round((bar.filled / bar.total) * 100)}%`;
      track.append(fill);
    }
    const text = bar.nextSure ? t('gacha.page.pity.next') : t('gacha.page.pity.left').replace('{n}', String(bar.left));
    return h('div', { className: 'gp-pity-row' }, [h('span', { className: 'gp-pity-label', textContent: label }), track, h('span', { className: `gp-pity-text${bar.nextSure ? ' is-sure' : ''}`, textContent: text })]);
  };

  const collection = h('section', { className: 'gp-collection' });

  // --- Reveal overlay (built per pull).
  let overlay: HTMLElement | null = null;
  let state: 'idle' | 'revealing' | 'done' = 'idle';
  let trigger: HTMLElement | null = null;
  let finishReveal: () => void = () => undefined;
  let revealAction: () => void = () => undefined;

  const element = h('div', { className: `gp${options.touch ? ' is-touch' : ''}` }, [
    world,
    h('div', { className: 'gp-shade' }),
    bubble,
    header,
    h('div', { className: 'gp-dock' }, [pullDock, odds, pity, h('p', { className: 'gp-hint', textContent: t(options.touch ? 'gacha.page.hint.touch' : 'gacha.page.hint') })]),
    collection,
  ]);
  element.setAttribute('aria-label', t('gacha.page.aria'));

  const shortText = (count: number): string => {
    const st = pullState(save, count);
    return st.canPull ? '' : t('gacha.page.short').replace('{n}', String(st.missing));
  };

  /** Everything that follows the save: balance, button states, pity bars and the collection strip. */
  function refresh(): void {
    balanceValue.textContent = save.coins.toLocaleString();
    balance.setAttribute('aria-label', `${t('gacha.page.balance')}: ${save.coins}`);
    for (const [pullEl, count] of [[pull1, 1], [pull10, 10]] as const) {
      const text = shortText(count);
      pullEl.button.setAttribute('aria-disabled', String(text !== ''));
      pullEl.button.classList.toggle('is-short', text !== '');
      pullEl.reason.textContent = text;
    }
    const view = pityView(save);
    pity.replaceChildren(
      h('div', { className: 'gp-panel-head' }, [h('h2', { textContent: t('gacha.page.pity.title') })]),
      meter(t('gacha.page.pity.rare'), view.rare, true),
      meter(t('gacha.page.pity.shiny'), view.shiny, false),
      h('p', { className: 'gp-note', textContent: t('gacha.page.pity.reset') }),
    );
    const strip = collectionStrip(save);
    const owned = strip.filter((e) => e.owned).length;
    collection.replaceChildren(
      h('div', { className: 'gp-panel-head' }, [h('h2', { textContent: t('gacha.page.collection.title') }), h('span', { textContent: t('gacha.page.collection.count').replace('{owned}', String(owned)).replace('{total}', String(strip.length)) })]),
      h(
        'ul',
        { className: 'gp-own-list' },
        strip.map((e) => {
          const face = portrait(options.sheets, e.species, 1, e.shiny);
          const state = e.owned ? t('gacha.page.collection.owned') : t('gacha.page.collection.missing');
          const li = h('li', { className: `gp-own ${e.owned ? 'is-owned' : 'is-missing'}` }, [
            h('div', { className: 'gp-own-art' }, [face, ...(e.shiny ? [icon('sparkle', 'px-icon gp-own-spark')] : [])]),
            h('span', { className: 'gp-own-name', textContent: t(`species.${e.species}`) }),
            h('span', { className: 'gp-own-state' }, [icon(e.owned ? 'owned' : 'unknown'), state]),
          ]);
          li.setAttribute('aria-label', `${t(`species.${e.species}`)}: ${state}${e.shiny ? `, ${t('gacha.page.collection.shiny')}` : ''}`);
          li.title = e.shiny ? t('gacha.page.collection.shiny') : '';
          return li;
        }),
      ),
    );
  }

  // --- The pull.
  function doPull(count: 1 | 10): void {
    if (state !== 'idle') return;
    const wanted = pullState(save, count);
    if (!wanted.canPull) {
      play('denied');
      sayKey('gacha.page.say.short');
      return;
    }
    const results: PullResult[] = [];
    for (let i = 0; i < count; i++) {
      // Each pull is saved at once (a refund can only help the next one, so a paid ten always completes).
      const pulled = pullAt(options.store, (Math.random() * 2 ** 31) | 0);
      if (!pulled) break;
      results.push(pulled.result);
      save = pulled.save;
    }
    if (results.length === 0) return;
    play('coin');
    trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openReveal(results);
  }

  const bestSound = (results: PullResult[]): SoundId => (results.some((r) => r.shiny || r.rarity === 'rare') ? 'levelUp' : results.some((r) => !r.duplicate) ? 'item' : 'coin');

  const capsuleHalves = (): HTMLElement =>
    h('div', { className: 'gp-capsule' }, [h('span', { className: 'gp-half gp-lid' }, [icon('capsuleTop', 'px-icon')]), h('span', { className: 'gp-half gp-body' }, [icon('capsuleBottom', 'px-icon')])]);

  const slotFor = (step: RevealStep, many: boolean, total: number): HTMLElement => {
    const { result } = step;
    const long = result.rarity === 'rare' || result.shiny;
    const slot = h('div', { className: `gp-slot is-${result.rarity}${result.shiny ? ' is-shiny' : ''}${long ? ' is-long' : ''}` });
    slot.style.cssText = `--d:${step.startMs}ms;--c:${step.crackMs}ms;--k:${step.cardMs}ms;--glow:${result.shiny ? SHINY_COLOR : RARITY[result.rarity]};--gp-rarity:${RARITY[result.rarity]}`;
    slot.setAttribute('role', 'group');
    slot.setAttribute('aria-label', t('gacha.page.reveal.capsule').replace('{n}', String(step.index + 1)).replace('{total}', String(total)));
    const face = portrait(options.sheets, result.species, 1, result.shiny);
    const tag = result.duplicate ? `${t('gacha.page.reveal.again')} ${t('gacha.page.reveal.refund').replace('{refund}', String(result.refund))}` : t('gacha.page.reveal.new');
    slot.append(
      h('div', { className: 'gp-socket' }),
      capsuleHalves(),
      h('div', { className: 'gp-card' }, [
        h('div', { className: 'gp-card-art' }, [face, ...(result.shiny ? [icon('sparkle', 'px-icon gp-card-spark')] : [])]),
        h('h3', { className: 'gp-card-name', textContent: t(`species.${result.species}`) }),
        h('p', { className: 'gp-card-rarity', textContent: `${t(`gacha.rarity.${result.rarity}`)}${result.shiny ? ` · ${t('gacha.page.reveal.shiny')}` : ''}` }),
        h('p', { className: `gp-card-tag ${result.duplicate ? 'is-dup' : 'is-new'}`, textContent: tag }),
        ...(many ? [] : [h('p', { className: 'gp-card-line', textContent: revealText(result) })]),
      ]),
      h('div', { className: 'gp-burst' }),
    );
    return slot;
  };

  function openReveal(results: PullResult[]): void {
    clearTimers();
    const many = results.length > 1;
    const plan = revealPlan(results, reduced());
    const stage = h('div', { className: `gp-stage ${many ? 'is-many' : 'is-single'}` }, plan.steps.map((step) => slotFor(step, many, results.length)));
    const summary = h('p', { className: 'gp-summary', textContent: many ? t('gacha.page.summary').replace('{fresh}', String(plan.summary.fresh)).replace('{duplicates}', String(plan.summary.duplicates)).replace('{refund}', coins(plan.summary.refund)) : '' });
    const sr = h('p', { className: 'gp-sr' });
    sr.setAttribute('role', 'status');
    const button = h('button', { className: 'gp-reveal-btn', type: 'button' }, [icon('skip', 'px-icon'), h('span', { textContent: t('gacha.page.reveal.skip') })]);
    button.dataset.gp = 'reveal';
    const box = h('div', { className: `gp-overlay${many ? ' is-many' : ' is-single'}` }, [h('div', { className: 'gp-veil' }), stage, h('footer', { className: 'gp-reveal-foot' }, [summary, button]), sr]);
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', t('gacha.page.reveal.label'));
    overlay = box;
    state = 'revealing';
    say.textContent = t(many ? 'gacha.page.say.ten' : 'gacha.reveal.wait');

    finishReveal = () => {
      if (state !== 'revealing') return;
      clearTimers();
      state = 'done';
      box.classList.add('is-done');
      button.replaceChildren(icon('owned', 'px-icon'), h('span', { textContent: t('gacha.page.reveal.continue') }));
      sr.textContent = results.map(revealText).join(' ');
      button.focus({ preventScroll: true });
    };
    const skip = (): void => {
      if (state !== 'revealing') return;
      box.classList.add('is-skipped');
      play(bestSound(results));
      finishReveal();
    };
    const close = (): void => {
      if (state !== 'done') return;
      box.remove();
      overlay = null;
      state = 'idle';
      refresh();
      sayAfter(results);
      (trigger && trigger.isConnected ? trigger : pull1.button).focus({ preventScroll: true });
    };
    button.addEventListener('click', () => (state === 'revealing' ? skip() : close()));
    stage.addEventListener('click', () => skip());
    revealAction = () => (state === 'revealing' ? skip() : close());

    element.append(box);
    if (reduced() || plan.totalMs === 0) {
      play(bestSound(results));
      finishReveal();
    } else {
      for (const step of plan.steps) later(() => play(soundFor(step.result)), step.startMs + step.crackMs);
      later(finishReveal, plan.totalMs);
      button.focus({ preventScroll: true });
    }
  }

  /** Mimikyu's line once the reveal is over: the best thing that came out. */
  function sayAfter(results: PullResult[]): void {
    const best = results.find((r) => r.shiny) ?? results.find((r) => r.rarity === 'rare') ?? results.find((r) => !r.duplicate) ?? results[0]!;
    sayKey(best.shiny ? 'gacha.page.say.shiny' : best.rarity === 'rare' ? 'gacha.page.say.rare' : best.duplicate ? 'gacha.page.say.duplicate' : 'gacha.page.say.new');
  }

  // --- Keyboard: Enter pulls one, arrows move between the controls, Esc goes back (or skips/closes a reveal).
  const controls = (): HTMLElement[] => [...element.querySelectorAll<HTMLElement>('[data-gp]')].filter((el) => el.offsetParent !== null);
  const onKey = (e: KeyboardEvent): void => {
    if (!element.isConnected) {
      window.removeEventListener('keydown', onKey);
      return;
    }
    if (e.defaultPrevented) return;
    if (state !== 'idle') {
      if (e.code === 'Escape') {
        e.preventDefault();
        revealAction();
      }
      return;
    }
    if (e.code === 'Escape') {
      e.preventDefault();
      options.onBack();
      return;
    }
    if (e.code === 'Enter' && !(document.activeElement instanceof HTMLButtonElement)) {
      e.preventDefault();
      doPull(1);
      return;
    }
    const dir = KEYS[e.code];
    if (!dir) return;
    const list = controls();
    if (list.length === 0) return;
    e.preventDefault();
    const current = list.includes(document.activeElement as HTMLElement) ? (document.activeElement as HTMLElement) : null;
    if (!current) {
      pull1.button.focus();
      return;
    }
    const points = list.map((el, i) => {
      const r = el.getBoundingClientRect();
      return { id: String(i), x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    list[Number(hubStep(points, String(list.indexOf(current)), dir))]?.focus();
  };
  window.addEventListener('keydown', onKey);

  // --- The camera: the 320x200 stall covers the page in quarter steps; the bubble follows Mimikyu's head.
  const layout = (): void => {
    const w = element.clientWidth;
    const hgt = element.clientHeight;
    if (!w || !hgt) return;
    const cam = cameraFor(w, hgt);
    world.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.scale})`;
    bubble.style.left = `${Math.round(cam.x + STALL.stand.x * cam.scale)}px`;
    bubble.style.top = `${Math.round(Math.max(header.offsetHeight + 12, cam.y + (STALL.stand.y - 40) * cam.scale))}px`;
  };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(layout) : null;
  observer?.observe(element);

  refresh();
  sayKey(save.coins >= GACHA.cost ? 'gacha.page.say.idle' : 'gacha.page.say.short');
  const focus = (): void => pull1.button.focus({ preventScroll: true });
  queueMicrotask(focus);

  return {
    element,
    focus,
    dispose() {
      clearTimers();
      observer?.disconnect();
      window.removeEventListener('keydown', onKey);
      overlay?.remove();
    },
  };
}
