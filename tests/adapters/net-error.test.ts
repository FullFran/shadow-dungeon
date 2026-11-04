import { describe, expect, it } from 'vitest';
import { ERROR_KINDS, errorMessageKey, fromFetchFailure, fromStatus, isRetryable, subscribeErrors, reportError } from '../../src/adapters/net-error';
import { catalog } from '../../src/i18n';

const timeout = () => new DOMException('signal timed out', 'TimeoutError');
const aborted = () => new DOMException('aborted', 'AbortError');

describe('fetch failures map to a kind', () => {
  it('a timeout or an abort is a timeout', () => {
    expect(fromFetchFailure(timeout()).kind).toBe('timeout');
    expect(fromFetchFailure(aborted()).kind).toBe('timeout');
  });
  it('a TypeError from fetch is the network being gone', () => {
    expect(fromFetchFailure(new TypeError('Failed to fetch')).kind).toBe('offline');
  });
  it('a browser that reports offline wins over the error shape', () => {
    expect(fromFetchFailure(timeout(), false).kind).toBe('offline');
  });
  it('anything else is unexpected', () => {
    expect(fromFetchFailure(new Error('boom')).kind).toBe('unexpected');
    expect(fromFetchFailure('weird').kind).toBe('unexpected');
  });
});

describe('HTTP codes map to a kind', () => {
  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [408, 'timeout'],
    [504, 'timeout'],
    [429, 'rate-limited'],
    [500, 'server'],
    [502, 'server'],
    [503, 'server'],
    [400, 'unexpected'],
    [404, 'unexpected'],
  ] as const)('%i is %s', (status, kind) => {
    expect(fromStatus(status).kind).toBe(kind);
  });
});

describe('what is worth retrying', () => {
  it('offline, timeout and server errors are; auth, rate limits, assets and the unexpected are not', () => {
    expect(ERROR_KINDS.filter(isRetryable).sort()).toEqual(['offline', 'server', 'timeout']);
    expect(fromFetchFailure(new TypeError('x')).retryable).toBe(true);
    expect(fromStatus(401).retryable).toBe(false);
  });
});

describe('messages', () => {
  it('every kind has a title and a hint in Spanish and English', () => {
    for (const kind of ERROR_KINDS) {
      for (const part of ['title', 'hint']) {
        const key = `${errorMessageKey(kind)}.${part}`;
        expect(catalog('es')[key], `es ${key}`).toBeTruthy();
        expect(catalog('en')[key], `en ${key}`).toBeTruthy();
      }
    }
  });
});

describe('the error sink', () => {
  it('reports each failure to every subscriber until it unsubscribes', () => {
    const seen: string[] = [];
    const off = subscribeErrors((e, scope) => seen.push(`${scope}:${e.kind}`));
    reportError(fromStatus(503), 'ranking');
    off();
    reportError(fromStatus(503), 'ranking');
    expect(seen).toEqual(['ranking:server']);
  });
});
