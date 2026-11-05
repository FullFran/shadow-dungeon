import { glyphSvg } from '../app/gamepad-pad';
import type { PadStyle } from '../app/gamepad-help-data';
import { t } from '../i18n';
import { interactGlyphs, type HintDevice } from './play-hints-model';
import { interactLabelKey, placeTooltip, type Box, type InteractKind } from './world-tooltip-model';
import '../styles/credits-controls.css';
import '../styles/world-tooltip.css';

/**
 * The world tooltip (.agents/DESIGN.md §4): one relic chip with a pointer, anchored over the target `interact` would
 * pick, with the verb of what it does and the glyph of the device used last (a keycap, the pad's confirm button, or
 * on touch the chip itself is the button). The model (verb, placement) is pure: src/ui/world-tooltip-model.ts.
 * Only one exists at a time: the scene passes the single target, or null.
 */
export interface WorldTooltipState {
  kind: InteractKind;
  /** The target's on-screen box, CSS px of the viewport. */
  target: Box;
  /** The player's on-screen box: the tooltip stays off it. */
  avoid: Box | null;
}

export interface WorldTooltip {
  /** Once a frame; null hides it. */
  update(state: WorldTooltipState | null): void;
  dispose(): void;
}

export interface WorldTooltipOptions {
  device(): HintDevice;
  padStyle?(): PadStyle;
  /** The press on touch (and a click with the mouse). */
  onActivate(): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, children: (Node | string)[] = []): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  node.append(...children);
  return node;
};

export function mountWorldTooltip(parent: HTMLElement, options: WorldTooltipOptions): WorldTooltip {
  const glyphs = el('span', 'wt-glyphs');
  const verb = el('span', 'wt-verb');
  const chip = el('button', 'wt-chip', [glyphs, verb]);
  chip.type = 'button';
  // Never in the Tab order (Tab is the quick wheel in the town) nor left focused (Space would press it again).
  chip.tabIndex = -1;
  const arrow = el('span', 'wt-arrow');
  const root = el('div', 'wt', [chip, arrow]);
  root.setAttribute('role', 'status');
  parent.append(root);
  chip.addEventListener('pointerdown', (e) => e.stopPropagation());
  chip.addEventListener('click', () => {
    chip.blur();
    options.onActivate();
  });

  let content = '';
  let size = { w: 0, h: 0 };
  let on = false;
  let side: 'above' | 'below' = 'above';

  return {
    update(state) {
      if (!state) {
        if (on) {
          on = false;
          root.classList.remove('is-on');
        }
        return;
      }
      const device = options.device();
      const style = options.padStyle?.() ?? 'xbox';
      const key = `${state.kind}|${device}|${device === 'gamepad' ? style : ''}|${t('interact.talk')}`;
      if (key !== content) {
        content = key;
        const parts = interactGlyphs(device, style).map((g) => (g.kind === 'pad' ? glyphSvg(g.id, style) : el('kbd', 'wt-key', [g.label])));
        glyphs.replaceChildren(...parts);
        glyphs.hidden = parts.length === 0;
        verb.textContent = t(interactLabelKey(state.kind));
        root.classList.toggle('is-touch', device === 'touch');
        size = { w: root.offsetWidth, h: root.offsetHeight };
      }
      const placement = placeTooltip({ target: state.target, size, viewport: { w: window.innerWidth, h: window.innerHeight }, avoid: state.avoid });
      root.style.transform = `translate(${Math.round(placement.x)}px, ${Math.round(placement.y)}px)`;
      root.style.setProperty('--wt-arrow-x', `${Math.round(placement.arrowX)}px`);
      if (placement.side !== side) {
        side = placement.side;
        root.dataset.side = side;
      }
      if (!on) {
        on = true;
        root.classList.add('is-on');
      }
    },
    dispose() {
      root.remove();
    },
  };
}
