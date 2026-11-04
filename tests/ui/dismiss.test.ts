import { describe, expect, it } from 'vitest';
import { classifyPath, decideDismiss, type PathNode, type Scene } from '../../src/ui/dismiss-model';

const n = (tag: string, ...classes: string[]): PathNode => ({ tag, classes });
const app: PathNode = { tag: 'div', classes: [], id: 'app' };
const base = { selecting: false, popupOpen: false };
const overlay: Scene = { kind: 'overlay' };

describe('classifyPath (leaf first)', () => {
  it('a press inside a window is "window"', () => {
    expect(classifyPath([n('span'), n('button', 'md-item'), n('section', 'md-window'), n('div', 'town-shop'), app])).toBe('window');
  });
  it('a press on the veil of an overlay is "backdrop"', () => {
    expect(classifyPath([n('div', 'town-shop'), app])).toBe('backdrop');
  });
  it('a press on the account drawer veil (a child of body) is "backdrop", inside the drawer is "window"', () => {
    expect(classifyPath([n('div', 'drawer-veil'), n('body'), n('html')])).toBe('backdrop');
    expect(classifyPath([n('p'), n('aside', 'md-window', 'ad-drawer'), n('div', 'drawer-veil'), n('body')])).toBe('window');
    expect(decideDismiss({ down: [n('div', 'drawer-veil'), n('body')], up: [n('div', 'drawer-veil'), n('body')], scene: overlay, ...base })).toBe(true);
  });
  it('a press on the empty page of a menu screen is "backdrop"', () => {
    expect(classifyPath([n('canvas', 'backdrop'), app])).toBe('backdrop');
    expect(classifyPath([n('div', 'screen-row'), app])).toBe('backdrop');
  });
  it('controls, popups, toasts and the footer notice are never a backdrop', () => {
    expect(classifyPath([n('button'), n('div', 'town-shop'), app])).toBe('control');
    expect(classifyPath([n('li', 'dd-option'), n('ul', 'dd-popup')])).toBe('control');
    expect(classifyPath([n('p'), n('footer', 'notice'), app])).toBe('control');
    expect(classifyPath([n('div', 'achievement-toast'), app])).toBe('control');
  });
  it('the game canvas is "game"', () => {
    expect(classifyPath([n('canvas', 'game', 'town'), app])).toBe('game');
  });
  it('anything outside the app is "other"', () => {
    expect(classifyPath([n('body'), n('html')])).toBe('other');
  });
});

describe('decideDismiss', () => {
  const backdropPath = [n('div', 'town-shop'), app];
  const windowPath = [n('section', 'md-window'), n('div', 'town-shop'), app];

  it('closes when the press starts and ends on the backdrop', () => {
    expect(decideDismiss({ down: backdropPath, up: backdropPath, scene: overlay, ...base })).toBe(true);
    expect(decideDismiss({ down: [n('div', 'screen-row'), app], up: [n('canvas', 'backdrop'), app], scene: { kind: 'menu' }, ...base })).toBe(true);
  });

  it('does not close when the press starts inside a window and ends outside (a selection drag)', () => {
    expect(decideDismiss({ down: windowPath, up: backdropPath, scene: overlay, ...base })).toBe(false);
  });

  it('does not close when it starts outside and ends inside', () => {
    expect(decideDismiss({ down: backdropPath, up: windowPath, scene: overlay, ...base })).toBe(false);
  });

  it('does not close while a text selection exists', () => {
    expect(decideDismiss({ down: backdropPath, up: backdropPath, scene: overlay, selecting: true, popupOpen: false })).toBe(false);
  });

  it('does not close while a dropdown popup is open (the press only closes the popup)', () => {
    expect(decideDismiss({ down: backdropPath, up: backdropPath, scene: overlay, selecting: false, popupOpen: true })).toBe(false);
  });

  it('never closes during a run, on the hub, in the walking town or on screens that are not menus', () => {
    const path = [n('div'), app];
    for (const kind of ['run', 'hub', 'town', 'other'] as const) {
      expect(decideDismiss({ down: path, up: path, scene: { kind }, ...base })).toBe(false);
    }
  });

  it('closes the pause overlay over a run', () => {
    const path = [n('div', 'overlay', 'pause'), app];
    expect(decideDismiss({ down: path, up: path, scene: overlay, ...base })).toBe(true);
  });

  it('does not close on a press on a control or the game canvas', () => {
    const control = [n('button'), n('div', 'town-shop'), app];
    expect(decideDismiss({ down: control, up: control, scene: overlay, ...base })).toBe(false);
    const game = [n('canvas', 'game'), app];
    expect(decideDismiss({ down: game, up: game, scene: overlay, ...base })).toBe(false);
  });
});
