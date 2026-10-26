import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ListItem } from '../../src/ui/cursor-list';
import { describedIndices, description } from '../../src/ui/describe';

/**
 * Owner report 2026-10-26: "los menús cambian de tamaño por los textos de
 * descripciones". The description of the cursor row resized its window, so
 * the rows moved under the finger. The description box now holds an
 * invisible copy of every row's description in one grid cell (its size is
 * the largest of them, whatever the cursor shows). These tests pin that
 * invariant without a browser; tools/mobile/menu-geometry.mjs measures the
 * real windows.
 */

/** Just enough DOM for `h` and the description box (the tests run in node). */
class FakeNode {
  childNodes: FakeNode[] = [];
  className = '';
  inert = false;
  attributes = new Map<string, string>();
  constructor(
    readonly tagName: string,
    public text = '',
  ) {}
  get textContent(): string {
    return this.tagName === '#text' ? this.text : this.childNodes.map((c) => c.textContent).join('');
  }
  set textContent(value: string) {
    this.childNodes = value ? [new FakeNode('#text', value)] : [];
  }
  get children(): FakeNode[] {
    return this.childNodes.filter((c) => c.tagName !== '#text');
  }
  append(...nodes: (FakeNode | string)[]): void {
    for (const n of nodes) this.childNodes.push(typeof n === 'string' ? new FakeNode('#text', n) : n);
  }
  replaceChildren(...nodes: (FakeNode | string)[]): void {
    this.childNodes = [];
    this.append(...nodes);
  }
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
  cloneNode(deep = false): FakeNode {
    const copy = new FakeNode(this.tagName, this.text);
    copy.className = this.className;
    copy.attributes = new Map(this.attributes);
    if (deep) copy.childNodes = this.childNodes.map((c) => c.cloneNode(true));
    return copy;
  }
}

const g = globalThis as { document?: unknown };
let saved: unknown;
beforeAll(() => {
  saved = g.document;
  g.document = { createElement: (tag: string) => new FakeNode(tag) };
});
afterAll(() => {
  g.document = saved;
});

const TEXTS = ['Short.', 'A much longer description that wraps over several lines of the box.', 'Mid length text.', 'Back'];

function setup(items: Partial<ListItem>[], cursor: number) {
  const list = { items: () => items as ListItem[], index: () => cursor };
  const line = document.createElement('p');
  const writes: number[] = [];
  const desc = description(list, {
    describe: (i) => {
      writes.push(i);
      line.textContent = TEXTS[i] ?? 'hint';
    },
    children: [line],
  });
  desc.update();
  const box = desc.element as unknown as FakeNode;
  const ghosts = box.children.filter((c) => c.className === 'md-desc-ghost');
  return { desc, box, ghosts, line, writes, move: (i: number) => ((cursor = i), desc.show(i)) };
}

describe('description box reserves the room of every row', () => {
  const rows: Partial<ListItem>[] = [{ label: 'a' }, { label: 'b' }, { label: 'c' }, { label: 'back' }];

  it('keeps one hidden copy of the description of every row the cursor can stop on', () => {
    const { box, ghosts } = setup(rows, 0);
    expect(box.className).toBe('md-desc');
    expect(box.children[0]!.className).toBe('md-desc-live');
    expect(ghosts.map((g) => g.textContent).sort()).toEqual([...TEXTS].sort());
    for (const g of ghosts) {
      expect(g.getAttribute('aria-hidden')).toBe('true');
      expect(g.inert).toBe(true);
    }
  });

  it('skips headers and disabled rows (the cursor never stops there)', () => {
    const items: Partial<ListItem>[] = [{ label: 'h', header: true }, { label: 'a' }, { label: 'x', disabled: true }, { label: 'back' }];
    expect(describedIndices({ items: () => items as ListItem[] })).toEqual([1, 3]);
    expect(setup(items, 1).ghosts.map((g) => g.textContent)).toEqual([TEXTS[3], TEXTS[1]]);
  });

  it('ends describing the row under the cursor', () => {
    const { box, writes } = setup(rows, 2);
    expect(writes.at(-1)).toBe(2);
    expect(box.children[0]!.textContent).toBe(TEXTS[2]);
  });

  it('moving the cursor changes only the live text, never the reserved copies', () => {
    const { box, ghosts, move } = setup(rows, 0);
    const reserved = ghosts.map((g) => g.textContent);
    for (const i of [1, 2, 3, 0]) {
      move(i);
      expect(box.children[0]!.textContent).toBe(TEXTS[i]);
      expect(box.children.filter((c) => c.className === 'md-desc-ghost').map((g) => g.textContent)).toEqual(reserved);
    }
  });

  it('with no row under the cursor (-1) the hint is reserved too', () => {
    expect(setup(rows, -1).ghosts.map((g) => g.textContent)).toContain('hint');
  });
});

describe('every menu with a cursor description uses the box', () => {
  const dir = join(__dirname, '../../src/app');
  const sources = readdirSync(dir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => ({ file: f, code: readFileSync(join(dir, f), 'utf8') }));

  it('each cursorList that describes its cursor row (onCursor) builds a description box', () => {
    const describing = sources.filter((s) => /cursorList\(\{[\s\S]*?onCursor/.test(s.code));
    expect(describing.length).toBeGreaterThanOrEqual(9);
    for (const s of describing) expect({ file: s.file, box: /\bdescription\(list,/.test(s.code) }).toEqual({ file: s.file, box: true });
  });

  it('nobody refreshes a description by hand after setItems (update() re-reserves it)', () => {
    for (const s of sources) expect({ file: s.file, stale: /setItems\([^)]*\)\);?\s*\n\s*describe\(/.test(s.code) }).toEqual({ file: s.file, stale: false });
  });
});

describe('the stacking CSS', () => {
  const html = readFileSync(join(__dirname, '../../index.html'), 'utf8');
  const rule = (selector: string) => html.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';

  it('stacks the live text and its copies in one grid cell, the copies invisible', () => {
    expect(rule('.md-desc')).toMatch(/display:\s*grid/);
    expect(rule('.md-desc > *')).toMatch(/grid-area:\s*1\s*\/\s*1/);
    expect(rule('.md-desc-ghost')).toMatch(/visibility:\s*hidden/);
    expect(rule('.md-desc-ghost')).toMatch(/pointer-events:\s*none/);
  });

  it('puts the description on the right of the list in a fixed-width column', () => {
    expect(rule('.md-menu')).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s+var\(--md-desc-width/);
  });

  it('never lets a scrolling list squeeze its rows', () => {
    expect(rule('.md-list > .md-item, .md-list > .md-list-header')).toMatch(/flex-shrink:\s*0/);
  });
});
