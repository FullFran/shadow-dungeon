import type { SheetStore } from '../adapters/assets';
import { speakerFace } from '../adapters/portrait';
import { drawPrologue, STAGE, type SceneTime } from '../adapters/prologue-scenes';
import type { PortraitEmotion } from '../data/portraits';
import { PROLOGUE, type CinematicPanel, type PrologueScene, type Shot } from '../data/prologue';
import '../styles/prologue-face.css';
import { t } from '../i18n';
import { mountCinematicControls } from '../ui/cinematic-controls';
import { cameraAt, holdAtMs, holdProgress, panelAlpha, panelAt, revealedChars, revealEndMs, SKIP, skipAvailable, stageScale, startOf } from '../ui/cinematic';
import { h } from '../ui/window';

/**
 * The prologue player: plays PROLOGUE on a low-res canvas scaled up by a
 * whole number (pixelated; below 2x, the exact fit: `stageScale`), with the
 * narration typed out in the DOM below the picture. Skippable after the first second by holding Esc or Enter, or by
 * holding the shared "Saltar" button (src/ui/cinematic-controls.ts). When it ends or is skipped it calls `onDone` once; the
 * caller decides what comes next (the route name is PROLOGUE_ROUTE). It
 * cleans up by itself when it leaves the page.
 */
export const PROLOGUE_ROUTE = 'prologue';

export interface PrologueMusic {
  /** Starts the prologue track `offsetS` in (0 is the top). */
  start(offsetS: number): void;
  /** Fades it out (skip or end). */
  stop(): void;
}

export interface PrologueOptions {
  /** The loaded sprite sheets, or null while they load (figures are left out until then). */
  sheets: () => SheetStore | null;
  onDone: () => void;
  /** Runs once when the player goes away: it ended, was skipped (after `onDone`), or another screen replaced it. */
  onClose?: () => void;
  /** When «Saltar» (and the held key or finger) starts to count (default `SKIP.availableAfterMs`; 0 shows it from the first frame). */
  skipAfterMs?: number;
  music?: PrologueMusic;
  /** Start this far in (development screenshots). */
  startMs?: number;
  /** Another cinematic on the same player (the guardian ones): its panels and how to draw them. Default: the prologue. */
  panels?: readonly CinematicPanel[];
  draw?(ctx: CanvasRenderingContext2D, panel: CinematicPanel, time: SceneTime, camera: Shot, alpha: number): void;
  /** Accessible name of the screen (default: the Prologue title entry). */
  label?: string;
  /** Reads a narration key (default: the i18n `t`); the Sima's scenes fill in the floor reached. */
  text?(key: string): string;
  /** Who speaks a panel's words, for their Mystery Dungeon portrait beside the text (issue #47); null or absent: narration, no frame. */
  face?(panel: CinematicPanel): { sprite: string; emotion: PortraitEmotion } | null;
  /** Styles the narration lines when a panel starts (a herald's title card: its name big, in its colour). */
  styleLines?(panel: CinematicPanel, lines: readonly HTMLElement[]): void;
}

/** The stage's scale in the window: whole numbers from 2x, the exact fit below (`stageScale`). */
const windowScale = (): number => stageScale(window.innerWidth, window.innerHeight, STAGE.w, STAGE.h);

const isSkipKey = (key: string): boolean => key === 'Escape' || key === 'Enter';

/** Enter, Space or a tap moves the text on (odd/tasks/menu-redesign.md S13); holding Esc or Enter still skips the whole scene. */
const isAdvanceKey = (key: string): boolean => key === 'Enter' || key === ' ';

/**
 * Auto (the default, owner 2026-11-02: "que por defecto sea auto") plays the
 * text by itself, as before; turned off, each panel waits for a press after
 * its words. Only an explicit "off" on this device turns it off.
 */
const AUTO_KEY = 'mazmorra-sombria.cinematicAuto';
function readAuto(): boolean {
  try {
    return localStorage.getItem(AUTO_KEY) !== '0';
  } catch {
    return true;
  }
}
function writeAuto(on: boolean): void {
  try {
    localStorage.setItem(AUTO_KEY, on ? '1' : '0');
  } catch {
    // Private mode: the choice lasts for this scene only.
  }
}

export function prologueScreen(options: PrologueOptions): HTMLElement {
  const canvas = h('canvas', { className: 'prologue-canvas' });
  canvas.width = STAGE.w;
  canvas.height = STAGE.h;
  // Two lines of narration, or as many as the longest panel needs (a herald's title card has three).
  const lines = Array.from({ length: Math.max(2, ...(options.panels ?? []).map((p) => p.lines.length)) }, () => h('p'));
  const face = h('span', { className: 'prologue-face' });
  face.hidden = true;
  const text = h('div', { className: 'prologue-text' }, [face, ...lines]);
  text.setAttribute('aria-live', 'polite');
  const stage = h('div', { className: 'prologue-stage' }, [canvas, text]);
  // Press to advance or Auto (odd/tasks/menu-redesign.md S13): the pill shows and toggles the mode; ▼ marks a panel waiting for a press.
  let auto = readAuto();
  const nextMark = h('span', { className: 'prologue-next', textContent: '▼' });
  nextMark.setAttribute('aria-hidden', 'true');
  text.append(nextMark);
  const controls = mountCinematicControls({
    auto,
    onAuto: (on) => {
      auto = on;
      writeAuto(on);
    },
    onSkip: () => finish(),
  });
  const element = h('section', { className: 'prologue' }, [stage, controls.element]);
  element.setAttribute('aria-label', options.label ?? t('title.prologue'));
  const panels = options.panels ?? PROLOGUE;
  const skipAfterMs = options.skipAfterMs ?? SKIP.availableAfterMs;
  const ctx = canvas.getContext('2d');
  let started: number | null = null;
  let pressedAt: number | null = null;
  let finished = false;
  let scale = 0;
  let shownPanel = -1;
  let shownText = '';
  let elapsed = options.startMs ?? 0;
  /** Panels whose wait was answered by a press (manual play): they go on to their fade. */
  const released = new Set<number>();
  const lengthsOf = (index: number) => panels[index]!.lines.map((key) => [...(options.text ?? t)(key)].length);
  /** A press: finish typing the panel's words, or, once they are out, let the panel go on. */
  const advance = () => {
    const moment = panelAt(panels, elapsed);
    if (!moment || started === null) return;
    const end = revealEndMs(moment.panel, lengthsOf(moment.index));
    if (moment.localMs < end) {
      elapsed = startOf(panels, moment.index) + end;
      started = performance.now() - elapsed;
    } else released.add(moment.index);
  };

  const cleanup = () => {
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    controls.dispose();
    options.music?.stop();
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    cleanup();
    options.onDone();
    options.onClose?.();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (isAdvanceKey(e.key) && !e.repeat) advance();
    if (e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!isSkipKey(e.key)) return;
    // Keep the key from the menus behind and from page scrolling.
    e.preventDefault();
    e.stopPropagation();
    if (!e.repeat && pressedAt === null && skipAvailable(elapsed, skipAfterMs)) pressedAt = performance.now();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (isSkipKey(e.key)) pressedAt = null;
  };
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  // Touch: holding a finger anywhere on the picture is the held skip key (the same progress bar).
  element.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || (e.target instanceof Node && controls.element.contains(e.target)) || pressedAt !== null || !skipAvailable(elapsed, skipAfterMs)) return;
    pressedAt = performance.now();
  });
  const letGo = (e: PointerEvent) => {
    if (e.pointerType === 'touch') pressedAt = null;
  };
  // A click or a tap on the picture (not on its buttons) moves the text on.
  stage.addEventListener('click', () => advance());
  element.addEventListener('pointerup', letGo);
  element.addEventListener('pointercancel', letGo);

  /** The speaker's portrait, loaded when its panel starts; none (or a file that fails) leaves no frame. */
  const showFace = (who: { sprite: string; emotion: PortraitEmotion } | null): void => {
    const hide = (): void => {
      face.replaceChildren();
      face.hidden = true;
      text.classList.remove('has-face');
    };
    const img = who ? speakerFace(who.sprite, who.emotion, hide) : null;
    if (!img) return hide();
    face.replaceChildren(img);
    face.hidden = false;
    text.classList.add('has-face');
  };

  const renderText = (index: number, localMs: number, alpha: number) => {
    const panel = panels[index]!;
    const strings = panel.lines.map((key) => [...(options.text ?? t)(key)]);
    const counts = revealedChars(panel, localMs, strings.map((s) => s.length));
    const key = `${index}:${counts.join(',')}`;
    if (index !== shownPanel) {
      shownPanel = index;
      text.classList.toggle('is-voice', panel.scene === 'voice');
      showFace(options.face?.(panel) ?? null);
      options.styleLines?.(panel, lines);
    }
    if (key !== shownText) {
      shownText = key;
      lines.forEach((p, i) => {
        const chars = strings[i] ?? [];
        const n = counts[i] ?? 0;
        p.replaceChildren(h('span', { textContent: chars.slice(0, n).join('') }), h('span', { className: 'rest', textContent: chars.slice(n).join('') }));
      });
    }
    text.style.opacity = String(Math.max(0, Math.min(1, alpha * 1.15)));
  };

  const frame = (now: number) => {
    if (finished) return;
    if (!element.isConnected) {
      // Left the page some other way (another screen replaced it).
      if (started !== null) {
        finished = true;
        cleanup();
        options.onClose?.();
      } else requestAnimationFrame(frame);
      return;
    }
    if (started === null) {
      started = now - elapsed;
      options.music?.start(elapsed / 1000);
    }
    elapsed = now - started;
    // Manual play: a panel with words waits once they are out, until a press.
    const waiting = panelAt(panels, elapsed);
    let held = false;
    if (!auto && waiting && !released.has(waiting.index)) {
      const hold = holdAtMs(waiting.panel, lengthsOf(waiting.index));
      if (hold !== null && waiting.localMs >= hold) {
        elapsed = startOf(panels, waiting.index) + hold;
        started = now - elapsed;
        held = true;
      }
    }
    nextMark.classList.toggle('is-visible', held);
    if (holdProgress(pressedAt, now) >= 1) {
      finish();
      return;
    }
    const moment = panelAt(panels, elapsed);
    if (!moment) {
      finish();
      return;
    }
    const next = windowScale();
    if (next !== scale) {
      scale = next;
      canvas.style.width = `${Math.floor(STAGE.w * scale)}px`;
      canvas.style.height = `${Math.floor(STAGE.h * scale)}px`;
      text.style.fontSize = `${scale >= 5 ? 33 : scale >= 3 ? 22 : 16}px`;
    }
    const alpha = panelAlpha(moment.panel, moment.localMs);
    if (ctx) {
      const time = { localMs: moment.localMs, progress: moment.localMs / moment.panel.durationMs, sheets: options.sheets() };
      const camera = cameraAt(moment.panel, moment.localMs);
      if (options.draw) options.draw(ctx, moment.panel, time, camera, alpha);
      else drawPrologue(ctx, moment.panel.scene as PrologueScene, time, camera, alpha);
    }
    renderText(moment.index, moment.localMs, alpha);
    controls.update(now, skipAvailable(elapsed, skipAfterMs), holdProgress(pressedAt, now));
    requestAnimationFrame(frame);
  };
  // The first frame draws as soon as the caller has put the screen on the page (no black flash).
  queueMicrotask(() => frame(performance.now()));
  return element;
}
