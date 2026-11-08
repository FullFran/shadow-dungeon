/**
 * Long text for a phone that must not scroll: cut at sentence ends (and, inside a sentence too long for a page, at its commas,
 * semicolons and colons) so a pager can turn pages through it (odd/tasks/mobile-pass.md).
 * Rejoined with single spaces the pieces are the original text.
 */

/** A paragraph as its sentences. */
export function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡"(])/).filter((sentence) => sentence.length > 0);
}

/** A sentence as its clauses: cut after each comma, semicolon or colon that is followed by a space. */
export function splitClauses(sentence: string): string[] {
  return sentence.split(/(?<=[,;:])\s+/).filter((clause) => clause.length > 0);
}

/** Units packed greedily into pieces of at most `max` characters; a unit longer than that stays whole. */
function pack(units: readonly string[], max: number): string[] {
  const pieces: string[] = [];
  for (const unit of units) {
    const last = pieces[pieces.length - 1];
    if (last !== undefined && last.length + 1 + unit.length <= max) pieces[pieces.length - 1] = `${last} ${unit}`;
    else pieces.push(unit);
  }
  return pieces;
}

/**
 * The text in pieces of at most `max` characters: whole sentences packed together, a sentence longer than `max` cut at its clauses.
 * Only a stretch with no comma, semicolon or colon at all can stay longer than `max`.
 */
export function packSentences(text: string, max: number): string[] {
  return pack(
    splitSentences(text).flatMap((sentence) => (sentence.length <= max ? [sentence] : splitClauses(sentence))),
    max,
  );
}
