import { h } from './window';

/**
 * The Crypt's tutorial sign as a carved stone inscription (odd/tasks/menu-redesign.md
 * T7, owner: "hazlos mas bonitos"): an engraved title over the text, with the
 * keys and buttons written in [brackets] raised as keycaps. Original look, CSS
 * only (index.html `.tutorial-sign`).
 */
export interface SignPart {
  key: boolean;
  text: string;
}

/** The text cut into plain words and [bracketed] keys, brackets dropped. */
export function signParts(text: string): SignPart[] {
  const parts: SignPart[] = [];
  const pattern = /\[([^\]]+)\]/g;
  let at = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > at) parts.push({ key: false, text: text.slice(at, match.index) });
    parts.push({ key: true, text: match[1]! });
    at = match.index + match[0].length;
  }
  if (at < text.length) parts.push({ key: false, text: text.slice(at) });
  return parts;
}

/** The sign element: emblem, engraved title, the text with its keycaps. */
export function tutorialSign(title: string, text: string): HTMLElement {
  const body = h(
    'p',
    { className: 'tutorial-sign-text' },
    signParts(text).map((part) => (part.key ? h('kbd', { textContent: part.text }) : document.createTextNode(part.text))),
  );
  return h('div', { className: 'tutorial-sign', role: 'status' }, [
    h('div', { className: 'tutorial-sign-head' }, [h('span', { className: 'tutorial-sign-emblem' }), h('span', { className: 'tutorial-sign-title', textContent: title })]),
    body,
  ]);
}
