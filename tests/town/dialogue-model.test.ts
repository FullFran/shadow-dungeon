import { describe, expect, it } from 'vitest';
import { SIMA_PLEA } from '../../src/data/sima-plea';
import { TOWN_TOUR } from '../../src/data/town-tour';
import { WORLD } from '../../src/data/world';
import { catalog } from '../../src/i18n';
import { advanceDialog, DIALOG_CPS, dialogueView, lineDone, openDialog, shownText, tickDialog } from '../../src/town/dialog';
import { dialogueSources } from '../../src/town/dialogue-sources';

/** Owner, 2026-11-04: "rediseña también los diálogos". Same content and flows; a new model for pages, reveal and the continue glyph. */
const msPerChar = 1000 / DIALOG_CPS;

describe('pages', () => {
  it('a single line has no page counter, a multi-line one counts from 1', () => {
    expect(dialogueView(openDialog(['Hola'])).showPages).toBe(false);
    const d = openDialog(['uno', 'dos', 'tres']);
    expect(dialogueView(d)).toMatchObject({ page: 1, pages: 3, showPages: true });
    const second = advanceDialog(advanceDialog(d)!)!;
    expect(dialogueView(second)).toMatchObject({ page: 2, pages: 3 });
  });

  it('the continue verb is "next" until the last page, then "close"', () => {
    const d = openDialog(['uno', 'dos']);
    expect(dialogueView(d).continueKey).toBe('dialogue.next');
    const last = advanceDialog(advanceDialog(d)!)!;
    expect(dialogueView(last).continueKey).toBe('dialogue.close');
  });
});

describe('typewriter', () => {
  it('reveals text over time and reports done only when the page is complete', () => {
    const d = openDialog(['Hola mundo']);
    const view = dialogueView(tickDialog(d, msPerChar * 4));
    expect(view.text).toBe('Hola');
    expect(view.full).toBe('Hola mundo');
    expect(view.done).toBe(false);
    expect(dialogueView(tickDialog(d, 10_000)).done).toBe(true);
  });

  it('a press completes the page before moving on', () => {
    const d = tickDialog(openDialog(['Hola mundo', 'Adiós']), msPerChar * 2);
    const completed = advanceDialog(d)!;
    expect(shownText(completed)).toBe('Hola mundo');
    expect(lineDone(completed)).toBe(true);
    expect(dialogueView(completed).done).toBe(true);
  });

  it('is instant under reduced motion, on every page', () => {
    const d = openDialog(['Hola mundo', 'Adiós amigo'], true);
    expect(shownText(d)).toBe('Hola mundo');
    expect(dialogueView(d).done).toBe(true);
    const next = advanceDialog(d)!;
    expect(shownText(next)).toBe('Adiós amigo');
  });
});

describe('every existing dialogue source renders', () => {
  const sources = dialogueSources();

  it('covers every NPC of every map, every lore point, every plea villager, the tour guide and the fixed speakers', () => {
    const ids = new Set(sources.map((s) => s.id));
    for (const map of Object.values(WORLD)) {
      for (const npc of map.npcs) expect(ids.has(`npc:${npc.id}`), `npc ${npc.id}`).toBe(true);
      for (const point of map.lore) expect(ids.has(`lore:${point.id}`), `lore ${point.id}`).toBe(true);
    }
    for (const actor of SIMA_PLEA) expect(ids.has(`plea:${actor.id}`), `plea ${actor.id}`).toBe(true);
    expect(ids.has(`tour:${TOWN_TOUR.npcId}`)).toBe(true);
    for (const fixed of ['shrine', 'beacon', 'beacon-room', 'board']) expect(ids.has(`fixed:${fixed}`), fixed).toBe(true);
    expect(sources.length).toBeGreaterThan(30);
  });

  for (const language of ['es', 'en'] as const) {
    it(`${language}: each source has a speaker and non-empty text on every page, with a portrait where a Pokémon speaks`, () => {
      const messages = catalog(language);
      for (const source of sources) {
        expect(messages[source.speakerKey], `${source.id} speaker`).toBeTruthy();
        expect(source.lineKeys.length, source.id).toBeGreaterThan(0);
        const lines = source.lineKeys.map((key) => messages[key] ?? '');
        for (const [i, line] of lines.entries()) expect(line.trim(), `${source.id} line ${i}`).not.toBe('');
        const view = dialogueView(tickDialog(openDialog(lines), 600_000));
        expect(view.pages).toBe(lines.length);
        expect(view.text).toBe(lines[0]);
        expect(view.done).toBe(true);
        if (source.id.startsWith('npc:') || source.id.startsWith('plea:') || source.id.startsWith('tour:')) expect(source.portrait, source.id).toBeTruthy();
      }
    });
  }
});
