import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readFeedback, sameOrigin, sanitizeFeedback, writeFeedback } from '../../tools/fx-feedback-plugin';

const dirs: string[] = [];
const tempFile = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'fx-feedback-'));
  dirs.push(dir);
  return join(dir, 'nested', 'feedback.json');
};
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('effect gallery feedback', () => {
  it('keeps a choice and a comment per move', () => {
    expect(sanitizeFeedback({ 'fury-swipes': { choice: 'old', comment: 'me gusta más' }, slash: { choice: 'new' }, swift: { comment: 'la estrella mola' } })).toEqual({
      'fury-swipes': { choice: 'old', comment: 'me gusta más' },
      slash: { choice: 'new', comment: '' },
      swift: { comment: 'la estrella mola' },
    });
  });

  it('drops unknown choices, bad ids, empty entries and anything that is not an object', () => {
    expect(sanitizeFeedback({ slash: { choice: 'rm -rf' }, '../etc': { choice: 'old' }, swift: 3 })).toEqual({});
    expect(sanitizeFeedback('nope')).toEqual({});
    expect(sanitizeFeedback([{ choice: 'old' }])).toEqual({});
  });

  it('cuts a very long comment', () => {
    expect(sanitizeFeedback({ slash: { comment: 'x'.repeat(5000) } }).slash?.comment).toHaveLength(2000);
  });

  it('writes the file and reads it back, creating its folder', () => {
    const file = tempFile();
    expect(readFeedback(file)).toEqual({});
    writeFeedback(file, { slash: { choice: 'new', comment: 'ok' } });
    expect(readFeedback(file)).toEqual({ slash: { choice: 'new', comment: 'ok' } });
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ slash: { choice: 'new', comment: 'ok' } });
  });

  it('only takes writes from the page served by this same server', () => {
    expect(sameOrigin('http://localhost:5173', 'localhost:5173')).toBe(true);
    expect(sameOrigin('https://evil.example', 'localhost:5173')).toBe(false);
    expect(sameOrigin(undefined, 'localhost:5173')).toBe(false);
  });
});
