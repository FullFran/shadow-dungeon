import { speakerFace } from '../adapters/portrait';
import type { PadStyle } from '../app/gamepad-help-data';
import { glyphSvg } from '../app/gamepad-pad';
import type { PortraitEmotion } from '../data/portraits';
import { t } from '../i18n';
import type { DialogueView } from '../town/dialog';
import { interactGlyphs, type HintDevice } from './play-hints-model';
import '../styles/credits-controls.css';
import '../styles/dialogue-box.css';
import './sprite-fit';

/**
 * The in-game dialogue box (.agents/DESIGN.md §4 "Dialogue box"), replacing the canvas box of the town (owner,
 * 2026-11-04: "rediseña también los diálogos"): a relic slab at the bottom edge with the speaker's Mystery Dungeon
 * portrait (issue #47; none, and no frame, for a speaker without one), a name plate, the page in Atkinson Hyperlegible, a typewriter reveal the model drives
 * (src/town/dialog.ts: a press completes the page, instant under reduced motion), a page counter when there are
 * several pages and a continue glyph of the device in use. The content and flows are unchanged: the scene opens the same
 * dialogues and advances them with the same keys; a click or tap on the slab advances too.
 */
export interface DialogueBoxState {
  speaker: string;
  view: DialogueView;
  /** Sprite key of the speaker's look, for its portrait; none for signs and statues. */
  portrait?: string;
  /** The speaker's face on this line (Normal by default). */
  emotion?: PortraitEmotion;
}

export interface DialogueBox {
  /** Once a frame; null hides the box. */
  update(state: DialogueBoxState | null, timeMs: number): void;
  dispose(): void;
}

export interface DialogueBoxOptions {
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
  const portrait = el('div', 'db-portrait');
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
  let face = '';
  let device = '';
  let fullText = '';
  let done: boolean | null = null;
  let visible = false;

  /** The portrait of a look in an emotion, loaded now; a look without one (or a file that fails) leaves no frame. */
  const showFace = (sprite: string | undefined, emotion: PortraitEmotion): void => {
    const hide = (): void => {
      portrait.replaceChildren();
      portrait.hidden = true;
      root.classList.remove('has-portrait');
    };
    const img = sprite ? speakerFace(sprite, emotion, hide) : null;
    if (!img) return hide();
    portrait.replaceChildren(img);
    portrait.hidden = false;
    root.classList.add('has-portrait');
  };

  const setGlyphs = (style: PadStyle, kind: HintDevice): void => {
    const parts = interactGlyphs(kind, style).map((g) => (g.kind === 'pad' ? glyphSvg(g.id, style) : el('kbd', 'db-key', [g.label])));
    glyphs.replaceChildren(...parts);
    glyphs.hidden = parts.length === 0;
  };

  return {
    update(state) {
      if (!state) {
        if (visible) {
          visible = false;
          root.hidden = true;
          speaker = '';
          face = '';
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
      const emotion = state.emotion ?? 'Normal';
      const look = `${state.portrait ?? ''}|${emotion}`;
      if (state.speaker !== speaker) {
        speaker = state.speaker;
        name.textContent = speaker;
        root.setAttribute('aria-label', `${t('dialogue.region')}: ${speaker}`);
      }
      if (look !== face) {
        face = look;
        showFace(state.portrait, emotion);
      }
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
