/**
 * Pure decision of "click outside closes the menu" (src/ui/dismiss.ts wires
 * it to the page). A press counts only when it starts AND ends on the
 * backdrop: outside every window, not on a control, the game canvas or a
 * dropdown popup, with no text selected, and only while a menu is what the
 * page shows (never a run, the walking town or the title hub).
 */
export interface PathNode {
  tag: string;
  classes: readonly string[];
  id?: string;
}

/** What the page is showing. `overlay`: a window over the town or a run (service windows, the pause menu). `menu`: a full-screen menu screen. */
export interface Scene {
  kind: 'menu' | 'overlay' | 'hub' | 'run' | 'town' | 'other';
}

export type PathKind = 'window' | 'control' | 'game' | 'backdrop' | 'other';

const CONTROL_TAGS = new Set(['button', 'a', 'input', 'textarea', 'select', 'label', 'summary']);
/** Classes of things that are not the backdrop although they sit on it. */
const CONTROL_CLASSES = ['dd-popup', 'dd-option', 'notice', 'achievement-toast', 'toast', 'touch-back', 'touch-chrome', 'rotate-hint'];
/** Roots whose bare surface is a backdrop. */
const BACKDROP_CLASSES = ['town-shop', 'overlay'];

/** What a press landed on, from the target up to the root (`path[0]` is the target). */
export function classifyPath(path: readonly PathNode[]): PathKind {
  if (path.some((node) => node.classes.includes('md-window'))) return 'window';
  if (path.some((node) => node.tag === 'canvas' && node.classes.includes('game'))) return 'game';
  if (path.some((node) => CONTROL_TAGS.has(node.tag) || CONTROL_CLASSES.some((c) => node.classes.includes(c)) || node.classes.includes('no-dismiss'))) return 'control';
  if (path.some((node) => node.id === 'app' || BACKDROP_CLASSES.some((c) => node.classes.includes(c)))) return 'backdrop';
  return 'other';
}

export interface DismissInput {
  down: readonly PathNode[];
  up: readonly PathNode[];
  scene: Scene;
  /** A non-collapsed text selection exists when the press ends. */
  selecting: boolean;
  /** A dropdown popup was open when the press began: that press only closes it. */
  popupOpen: boolean;
}

export function decideDismiss(input: DismissInput): boolean {
  if (input.scene.kind !== 'menu' && input.scene.kind !== 'overlay') return false;
  if (input.selecting || input.popupOpen) return false;
  return classifyPath(input.down) === 'backdrop' && classifyPath(input.up) === 'backdrop';
}
