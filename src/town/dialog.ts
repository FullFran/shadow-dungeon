/**
 * The typewriter of the town's dialog box, pure: a line reveals at
 * DIALOG_CPS characters per second; the first confirm shows the whole line,
 * the next one moves to the next line, and the last one closes the dialog.
 */
export const DIALOG_CPS = 40;

export interface DialogState {
  lines: readonly string[];
  index: number;
  /** Time spent on the current line (Infinity once it was finished by a confirm). */
  elapsedMs: number;
  /** Reduced motion: every line shows whole at once, no typewriter. */
  instant?: boolean;
}

export const openDialog = (lines: readonly string[], instant = false): DialogState => ({ lines, index: 0, elapsedMs: instant ? Number.POSITIVE_INFINITY : 0, ...(instant ? { instant } : {}) });

export const tickDialog = (dialog: DialogState, ms: number): DialogState => ({ ...dialog, elapsedMs: dialog.elapsedMs + ms });

const chars = (dialog: DialogState): string[] => [...(dialog.lines[dialog.index] ?? '')];

/** The part of the current line revealed so far. */
export function shownText(dialog: DialogState): string {
  const all = chars(dialog);
  const count = Math.min(all.length, Math.floor((dialog.elapsedMs * DIALOG_CPS) / 1000));
  return all.slice(0, count).join('');
}

export const lineDone = (dialog: DialogState): boolean => shownText(dialog).length === (dialog.lines[dialog.index] ?? '').length;

/** Confirm: finish the line, else go to the next one; null when the last line was already shown. */
export function advanceDialog(dialog: DialogState): DialogState | null {
  if (!lineDone(dialog)) return { ...dialog, elapsedMs: Number.POSITIVE_INFINITY };
  if (dialog.index + 1 < dialog.lines.length) return { ...dialog, index: dialog.index + 1, elapsedMs: dialog.instant ? Number.POSITIVE_INFINITY : 0 };
  return null;
}

/**
 * What an NPC says on its `talks`-th conversation (0 first): every line in
 * order, or, for a `rotate` NPC (the storyteller), one line per talk in turn.
 */
export function npcLines(npc: { lines: readonly string[]; rotate?: boolean }, talks: number): readonly string[] {
  if (!npc.rotate || npc.lines.length === 0) return npc.lines;
  return [npc.lines[talks % npc.lines.length]!];
}

/** What the dialogue box shows for a state: the page text (so far and whole), the page counter and the continue verb. */
export interface DialogueView {
  /** The part of the page revealed so far. */
  text: string;
  /** The whole page (the box reserves its height from it, so nothing jumps while it types). */
  full: string;
  /** 1-based page and the page count. */
  page: number;
  pages: number;
  /** Only a multi-page dialogue shows a counter. */
  showPages: boolean;
  /** The page is fully revealed: the continue glyph shows and a press moves on. */
  done: boolean;
  continueKey: 'dialogue.next' | 'dialogue.close';
}

export function dialogueView(dialog: DialogState): DialogueView {
  const pages = dialog.lines.length;
  return {
    text: shownText(dialog),
    full: dialog.lines[dialog.index] ?? '',
    page: dialog.index + 1,
    pages,
    showPages: pages > 1,
    done: lineDone(dialog),
    continueKey: dialog.index + 1 < pages ? 'dialogue.next' : 'dialogue.close',
  };
}
