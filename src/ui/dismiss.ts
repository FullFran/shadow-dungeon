import { decideDismiss, type PathNode, type Scene } from './dismiss-model';
import { sendEscape } from './touch-chrome';

/**
 * Click outside closes the menu. One mechanism for every menu of the game: a
 * pointer press that starts AND ends on the backdrop (outside every window)
 * sends the same Escape key the menus already answer to (cursor lists, the
 * town's service windows, the pause menu), so each closes the way its Back
 * row does. The decision is pure and tested (dismiss-model.ts); this file
 * only reads the page. It does nothing during a run, in the walking town, on
 * the title hub itself, on cinematics and result screens, while text is
 * selected, or while a dropdown popup is open (that press only closes it).
 */

/** What a node of the event path looks like to the model. */
function nodeOf(el: Element): PathNode {
  return { tag: el.tagName.toLowerCase(), classes: [...el.classList], ...(el.id ? { id: el.id } : {}) };
}

/** The target and its ancestors, nearest first. */
export function pathOf(event: Event): PathNode[] {
  return event.composedPath().filter((node): node is Element => node instanceof Element).map(nodeOf);
}

/** What the page shows now. A service window or the pause menu over anything counts as an overlay. */
export function sceneOf(doc: ParentNode = document): Scene {
  if (doc.querySelector('.town-shop, .overlay.pause')) return { kind: 'overlay' };
  if (doc.querySelector('canvas.town')) return { kind: 'town' };
  if (doc.querySelector('canvas.game')) return { kind: 'run' };
  if (doc.querySelector('.hub')) return { kind: 'hub' };
  // Full pages with their own Back (the /gacha page) are not menus to close by pressing outside.
  if (doc.querySelector('.result, .prologue, .quiz-black, .gp')) return { kind: 'other' };
  return { kind: 'menu' };
}

const selecting = (): boolean => {
  const selection = window.getSelection?.();
  return !!selection && !selection.isCollapsed && selection.toString().length > 0;
};

/** Installs the listeners once; returns the function that removes them. */
export function installDismiss(close: () => void = sendEscape): () => void {
  let down: { path: PathNode[]; popupOpen: boolean; id: number } | null = null;

  const onDown = (e: PointerEvent): void => {
    // Only a primary press counts (left button, a finger, a pen tip).
    down = e.isPrimary && e.button === 0 ? { path: pathOf(e), popupOpen: document.querySelector('.dd-popup') !== null, id: e.pointerId } : null;
  };
  const onUp = (e: PointerEvent): void => {
    const start = down;
    down = null;
    if (!start || start.id !== e.pointerId) return;
    if (decideDismiss({ down: start.path, up: pathOf(e), scene: sceneOf(), selecting: selecting(), popupOpen: start.popupOpen })) close();
  };
  const onCancel = (): void => {
    down = null;
  };

  window.addEventListener('pointerdown', onDown, true);
  window.addEventListener('pointerup', onUp, true);
  window.addEventListener('pointercancel', onCancel, true);
  return () => {
    window.removeEventListener('pointerdown', onDown, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onCancel, true);
  };
}
