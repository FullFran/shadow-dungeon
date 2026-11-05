import type { SheetStore } from '../adapters/assets';
import { sheetKey } from '../adapters/assets';
import { frameAtTime } from '../adapters/sprite-anim';
import type { PadStyle } from '../app/gamepad-help-data';
import { glyphSvg } from '../app/gamepad-pad';
import { SPRITES } from '../data/sprites';
import { t } from '../i18n';
import type { DialogueView } from '../town/dialog';
import { interactGlyphs, type HintDevice } from './play-hints-model';
import { opaqueBounds, type Bounds } from './sprite-bounds';
import '../styles/credits-controls.css';
import '../styles/dialogue-box.css';
import './sprite-fit';

/**
 * The in-game dialogue box (.agents/DESIGN.md §4 "Dialogue box"), replacing the canvas box of the town (owner,
 * 2026-11-04: "rediseña también los diálogos"): a relic slab at the bottom edge with the speaker's portrait in a
 * sprite-fit box (never clipped), a name plate, the page in Atkinson Hyperlegible, a typewriter reveal the model drives
 * (src/town/dialog.ts: a press completes the page, instant under reduced motion), a page counter when there are
 * several pages and a continue glyph of the device in use. The content and flows are unchanged: the scene opens the same
 * dialogues and advances them with the same keys; a click or tap on the slab advances too.
 */
export interface DialogueBoxState {
  speaker: string;
  view: DialogueView;
  /** Sprite key of the speaker's sheet; none for signs and statues. */
  portrait?: string;
}

export interface DialogueBox {
  /** Once a frame; null hides the box. */
  update(state: DialogueBoxState | null, timeMs: number): void;
  dispose(): void;
}

export interface DialogueBoxOptions {
  sheets: SheetStore;
  device(): HintDevice;
  padStyle?(): PadStyle;
  /** A click or tap on the box (the same as the confirm key). */
  onAdvance(): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, children: (Node | string)[] = []): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  node.append(...children);
  return node;
};

export function mountDialogueBox(parent: HTMLElement, options: DialogueBoxOptions): DialogueBox {
  const canvas = el('canvas', 'db-canvas');
  const portrait = el('div', 'sprite-box db-portrait', [canvas]);
  const name = el('div', 'db-name');
  const shown = el('span', 'db-shown');
  const rest = el('span', 'db-rest');
  const text = el('p', 'db-text', [shown, rest]);
  text.setAttribute('aria-hidden', 'true');
  const reader = el('p', 'db-reader');
  reader.setAttribute('aria-live', 'polite');
  const pages = el('span', 'db-pages');
  const glyphs = el('span', 'db-glyphs');
  const label = el('span', 'db-continue-label');
  const arrow = el('span', 'db-arrow');
  arrow.setAttribute('aria-hidden', 'true');
  const next = el('button', 'db-continue', [glyphs, label, arrow]);
  next.type = 'button';
  // Space is the roll and E the interact key: a focused button would answer to them twice.
  next.tabIndex = -1;
  const foot = el('div', 'db-foot', [pages, next]);
  const body = el('div', 'db-body', [name, text, reader, foot]);
  const root = el('div', 'db', [portrait, body]);
  root.setAttribute('role', 'region');
  root.hidden = true;
  parent.append(root);
  const press = (e: Event): void => {
    e.stopPropagation();
    (document.activeElement as HTMLElement | null)?.blur?.();
    options.onAdvance();
  };
  root.addEventListener('pointerdown', (e) => e.stopPropagation());
  root.addEventListener('click', press);

  let speaker = '';
  let sprite: string | undefined;
  let device = '';
  let fullText = '';
  let done: boolean | null = null;
  let crop: Bounds | null = null;
  let cropFor = '';
  let visible = false;

  const drawPortrait = (timeMs: number): void => {
    const meta = sprite ? SPRITES.sprites[sprite]?.anims.Idle : undefined;
    const image = sprite && meta ? options.sheets.get(sheetKey(sprite, meta.file)) : undefined;
    if (!sprite || !meta || !image) return;
    if (!crop || cropFor !== sprite) {
      crop = opaqueBounds(image, meta.frameCount, meta.frameWidth, meta.frameHeight);
      cropFor = sprite;
      canvas.width = crop.w;
      canvas.height = crop.h;
    }
    const c = canvas.getContext('2d');
    if (!c) return;
    const frame = frameAtTime(meta.durations, timeMs, true);
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.drawImage(image, frame * meta.frameWidth + crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
  };

  const setGlyphs = (style: PadStyle, kind: HintDevice): void => {
    const parts = interactGlyphs(kind, style).map((g) => (g.kind === 'pad' ? glyphSvg(g.id, style) : el('kbd', 'db-key', [g.label])));
    glyphs.replaceChildren(...parts);
    glyphs.hidden = parts.length === 0;
  };

  return {
    update(state, timeMs) {
      if (!state) {
        if (visible) {
          visible = false;
          root.hidden = true;
          speaker = '';
          fullText = '';
          done = null;
        }
        return;
      }
      if (!visible) {
        visible = true;
        root.hidden = false;
      }
      const { view } = state;
      if (state.speaker !== speaker || state.portrait !== sprite) {
        speaker = state.speaker;
        sprite = state.portrait;
        crop = null;
        name.textContent = speaker;
        root.classList.toggle('has-portrait', sprite !== undefined);
        portrait.hidden = sprite === undefined;
        root.setAttribute('aria-label', `${t('dialogue.region')}: ${speaker}`);
      }
      if (sprite) drawPortrait(timeMs);
      if (view.full !== fullText) {
        fullText = view.full;
        reader.textContent = view.full;
        rest.textContent = '';
      }
      shown.textContent = view.text;
      rest.textContent = view.full.slice(view.text.length);
      pages.hidden = !view.showPages;
      if (view.showPages) pages.textContent = t('dialogue.page').replace('{page}', String(view.page)).replace('{pages}', String(view.pages));
      const kind = options.device();
      const style = options.padStyle?.() ?? 'xbox';
      const sig = `${kind}|${kind === 'gamepad' ? style : ''}|${view.continueKey}|${t('dialogue.next')}`;
      if (sig !== device) {
        device = sig;
        setGlyphs(style, kind);
        label.textContent = t(view.continueKey);
      }
      if (view.done !== done) {
        done = view.done;
        next.classList.toggle('is-ready', view.done);
      }
    },
    dispose() {
      root.remove();
    },
  };
}
