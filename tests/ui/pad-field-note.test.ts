import { describe, expect, it } from 'vitest';
import { padFieldLimit, PAD_LIMIT_KEYS } from '../../src/ui/pad-field-note';
import es from '../../src/i18n/es.json';
import en from '../../src/i18n/en.json';

/**
 * Text fields and the pad (issue #32, owner's answer in odd/tasks/gamepad.md L4): no on-screen keyboard, a clear
 * limit. A field focused while the pad is the device in use says it needs a keyboard.
 */
describe('what a pad cannot do in a field', () => {
  it('typing: every text field, whatever its type, a text area and an editable box', () => {
    for (const type of ['text', 'search', 'email', 'password', 'url', 'tel', 'number']) expect(padFieldLimit({ tag: 'INPUT', type })).toBe('type');
    expect(padFieldLimit({ tag: 'TEXTAREA' })).toBe('type');
    expect(padFieldLimit({ tag: 'DIV', editable: true })).toBe('type');
  });
  it("choosing a file: the system's file dialog, or a button that opens it", () => {
    expect(padFieldLimit({ tag: 'INPUT', type: 'file' })).toBe('file');
    expect(padFieldLimit({ tag: 'BUTTON', limit: 'file' })).toBe('file');
  });
  it('a button, a checkbox or the page itself is no limit', () => {
    expect(padFieldLimit({ tag: 'BUTTON' })).toBeNull();
    expect(padFieldLimit({ tag: 'INPUT', type: 'checkbox' })).toBeNull();
    expect(padFieldLimit({ tag: 'INPUT', type: 'button' })).toBeNull();
    expect(padFieldLimit({ tag: 'BODY' })).toBeNull();
  });
  it('each limit has its line in Spanish and English', () => {
    for (const key of Object.values(PAD_LIMIT_KEYS)) {
      expect((es as Record<string, string>)[key], key).toBeTruthy();
      expect((en as Record<string, string>)[key], key).toBeTruthy();
    }
  });
});
