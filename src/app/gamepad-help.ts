import { t } from '../i18n';
import { isCompactTouch } from '../ui/compact-touch';
import { cursorList } from '../ui/cursor-list';
import { CREDITS_CONTROLS_ICONS } from '../ui/icons/credits-controls-icons';
import { attachPager, type Pager } from '../ui/pager';
import { pixelSvgOf } from '../ui/pixel-icons';
import { h, mdWindow } from '../ui/window';
import { GAMEPAD_HELP, buttonName, type HelpContext, type HelpRow, type PadStyle } from './gamepad-help-data';
import { glyphSvg, padSvg } from './gamepad-pad';
import '../styles/credits-controls.css';

/**
 * "Controles del mando" (odd/tasks/title-hub.md T11): a drawn gamepad with a callout from each
 * button to its action, two tabs (in combat, in menus and in town), an Xbox / PlayStation
 * toggle that swaps the glyphs, and a legend with the same glyph chips. The table lives in
 * gamepad-help-data.ts (held to adapters/gamepad.ts by tests/app/gamepad-help.test.ts).
 */
export { GAMEPAD_HELP, buttonName };
export type { HelpRow, PadStyle };

const STYLE_KEY = 'mazmorra-sombria.padStyle';
const CONTEXTS: readonly HelpContext[] = ['combat', 'menus'];
const STYLES: readonly { id: PadStyle; label: string }[] = [
  { id: 'xbox', label: 'Xbox' },
  { id: 'playstation', label: 'PlayStation' },
];

/** The layout last chosen, else the one of the connected pad, else Xbox. */
export function initialStyle(): PadStyle {
  try {
    const saved = localStorage.getItem(STYLE_KEY);
    if (saved === 'xbox' || saved === 'playstation') return saved;
  } catch {
    /* storage blocked: fall through */
  }
  try {
    const pads = navigator.getGamepads?.() ?? [];
    if (pads.some((pad) => pad && /054c|playstation|dualshock|dualsense|wireless controller/i.test(pad.id))) return 'playstation';
  } catch {
    /* no Gamepad API */
  }
  return 'xbox';
}

function remember(style: PadStyle): void {
  try {
    localStorage.setItem(STYLE_KEY, style);
  } catch {
    /* storage blocked: the choice lasts for this window only */
  }
}

/** The legend: one row per action with its glyph chips, the same rows the callouts draw. */
function legend(context: HelpContext, style: PadStyle): HTMLElement {
  const list = h('ul', { className: 'pc-legend', id: 'pc-legend' });
  list.setAttribute('aria-labelledby', 'pc-legend-title');
  list.append(...GAMEPAD_HELP[context].map((row) => h('li', {}, [h('span', { className: 'pc-keys' }, row.buttons.map((button) => glyphSvg(button, style))), h('span', { className: 'pc-action', textContent: t(`controls.${row.action}`) })])));
  return list;
}

/** Arrows move inside a group of buttons (and select, like a tab bar), Up/Down jump between groups; Enter and Space stay with the focused button. */
function barKeys(bar: HTMLElement, groups: () => HTMLElement[][]): void {
  bar.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const target = e.target as HTMLElement;
    const all = groups();
    const gi = all.findIndex((group) => group.includes(target));
    if (gi < 0) return;
    const group = all[gi]!;
    const at = group.indexOf(target);
    let next: HTMLElement | undefined;
    if (e.key === 'ArrowRight') next = group[Math.min(group.length - 1, at + 1)];
    else if (e.key === 'ArrowLeft') next = group[Math.max(0, at - 1)];
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const other = all[gi + (e.key === 'ArrowDown' ? 1 : -1)];
      next = other?.find((button) => button.tabIndex === 0 || button.getAttribute('aria-pressed') === 'true') ?? other?.[0];
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.stopPropagation();
      return;
    } else return;
    e.preventDefault();
    e.stopPropagation();
    if (next && next !== target) {
      next.focus();
      // An arrow on a tab or a style also picks it; on a page button it only moves the focus.
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !next.classList.contains('pg-btn')) next.click();
    }
  });
}

export function controlsWindow(onBack: () => void): { element: HTMLElement; dispose(): void } {
  const list = cursorList({ onBack, label: t('title.controls'), items: [{ label: t('menu.back'), onConfirm: onBack }] });
  let context: HelpContext = 'combat';
  let style: PadStyle = initialStyle();

  const stage = h('div', { className: 'pc-stage', id: 'pc-panel' });
  stage.setAttribute('role', 'tabpanel');

  const tabs = CONTEXTS.map((id) => {
    const button = h('button', { type: 'button', className: 'pc-tab', id: `pc-tab-${id}` }, [pixelSvgOf(CREDITS_CONTROLS_ICONS[id === 'combat' ? 'combat' : 'menus']!, 'pc-icon'), h('span', { textContent: t(`controls.${id}`) })]);
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', 'pc-panel');
    button.addEventListener('click', () => {
      context = id;
      render();
    });
    return button;
  });
  const styles = STYLES.map(({ id, label }) => {
    const button = h('button', { type: 'button', className: 'pc-style', textContent: label });
    button.addEventListener('click', () => {
      style = id;
      remember(id);
      render();
    });
    return button;
  });

  const tabList = h('div', { className: 'pc-tabs' }, tabs);
  tabList.setAttribute('role', 'tablist');
  tabList.setAttribute('aria-label', t('controls.contextLabel'));
  const styleGroup = h('div', { className: 'pc-styles' }, styles);
  styleGroup.setAttribute('role', 'group');
  styleGroup.setAttribute('aria-label', t('controls.styleLabel'));
  // A short touch screen keeps only the tabs up top; the pad style sits beside the page buttons and the note is the legend's last card.
  const compact = isCompactTouch();
  const bar = h('div', { className: 'pc-bar' }, compact ? [tabList] : [tabList, styleGroup]);
  // On a short touch screen the legend pages beside the note instead of scrolling; the page buttons are one more group for the keys.
  const foot = h('div', { className: 'pc-foot' });
  let pager: Pager | null = null;
  const pageButtons = (): HTMLElement[] => [...foot.querySelectorAll<HTMLElement>('.pg-btn:not(:disabled)')].filter((button) => !button.closest('[hidden]'));

  function render(): void {
    tabs.forEach((button, i) => {
      const on = CONTEXTS[i] === context;
      button.setAttribute('aria-selected', String(on));
      button.tabIndex = on ? 0 : -1;
    });
    styles.forEach((button, i) => button.setAttribute('aria-pressed', String(STYLES[i]!.id === style)));
    stage.setAttribute('aria-labelledby', `pc-tab-${context}`);
    const rows = legend(context, style);
    if (compact) rows.append(h('li', { className: 'pc-note-card' }, [h('span', { className: 'pc-note', textContent: t('controls.note') })]));
    stage.replaceChildren(h('div', { className: 'pc-pad' }, [padSvg(context, style)]), h('h3', { className: 'pc-legend-title', id: 'pc-legend-title', textContent: t('controls.legend') }), rows);
    pager?.dispose();
    const pages = h('div', { className: 'pc-pages' });
    foot.replaceChildren(compact ? styleGroup : h('p', { className: 'pc-note', textContent: t('controls.note') }), pages);
    pager = attachPager(rows, { nav: pages, enabled: isCompactTouch });
  }
  render();

  const element = mdWindow({ title: t('title.controls'), className: 'shop controls-window' }, [bar, stage, foot, list.element]);
  barKeys(element, () => [tabs, styles, pageButtons()]);
  return { element, dispose: () => (pager?.dispose(), list.dispose()) };
}
