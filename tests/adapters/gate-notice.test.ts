import { describe, expect, it } from 'vitest';
import { GATE_NOTICE_MS, gateNotice, gateNoticeText, gateText } from '../../src/adapters/hud';
import type { GateState } from '../../src/core/gates';
import en from '../../src/i18n/en.json';
import es from '../../src/i18n/es.json';

const shut: GateState = { kind: 'key', target: 'e2', doors: [10, 11], done: false, stuckMs: 0 };
const opened: GateState = { ...shut, done: true, outcome: 'opened' };

describe('gate notice (the key is taken with its bearer)', () => {
  it('the shut key gate reads only "the marked enemy carries the key", never a key to pick up', () => {
    const legacy: GateState = { ...shut, key: { x: 0, y: 0 } };
    expect(gateText(legacy)).toBe(gateText(shut));
    expect(es).not.toHaveProperty('gate.key.dropped');
    expect(en).not.toHaveProperty('gate.key.dropped');
  });

  it('starts the moment a seal or key gate opens by its enemy\'s fall, with its doors', () => {
    expect(gateNotice(shut, opened, 1000)).toEqual({ kind: 'key', doors: [10, 11], atMs: 1000 });
    const seal: GateState = { kind: 'seal', target: 'e1', done: false, stuckMs: 0 };
    expect(gateNotice(seal, { ...seal, done: true, outcome: 'opened' }, 5)).toEqual({ kind: 'seal', doors: [], atMs: 5 });
  });

  it('stays quiet while shut, once already open, when broken, for a wave room, and on a new floor', () => {
    expect(gateNotice(shut, shut, 0)).toBeNull();
    expect(gateNotice(opened, opened, 0)).toBeNull();
    expect(gateNotice(undefined, opened, 0)).toBeNull();
    expect(gateNotice(shut, { ...shut, done: true, outcome: 'broken' }, 0)).toBeNull();
    const waves: GateState = { kind: 'waves', done: false, stuckMs: 0 };
    expect(gateNotice(waves, { ...waves, done: true, outcome: 'opened' }, 0)).toBeNull();
    expect(gateNotice(shut, undefined, 0)).toBeNull();
  });

  it('says the key was taken and the door opens, in both languages', () => {
    expect(es['gate.key.taken']).toBe('¡Has conseguido la llave! La puerta se abre.');
    expect(en['gate.key.taken']).toBe('You got the key! The door opens.');
    expect(es['gate.seal.opened']).toBeTruthy();
    expect(en['gate.seal.opened']).toBeTruthy();
    expect(gateNoticeText('key')).not.toBe('gate.key.taken');
    expect(gateNoticeText('seal')).not.toBe('gate.seal.opened');
    expect(GATE_NOTICE_MS).toBeGreaterThanOrEqual(2000);
  });
});
