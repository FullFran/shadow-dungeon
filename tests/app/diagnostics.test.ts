import { describe, expect, it } from 'vitest';
import { buildDiagnostics, createDiagnosticsLog, diagnosticsBytes, DIAGNOSTICS_MAX_BYTES, errorEntry, MAX_ERRORS, type DiagnosticsInput } from '../../src/app/diagnostics';
import type { PerformanceSnapshot } from '../../src/adapters/perf-sampler';
import { SPECIES } from '../../src/data/species';
import { selectedPair } from '../../src/net/diagnostics';
import { createSession } from '../../src/net/session';
import { createFakeScheduler, createMemoryHub } from '../../src/net/transport';

/** Issue #6: the technical report attached to a bug report or copied from the room menu. */
const base = (over: Partial<DiagnosticsInput> = {}): DiagnosticsInput => ({
  build: 'v0.9.1 · abc1234',
  protocol: 5,
  lang: 'es',
  touch: false,
  screen: 'title',
  errors: [],
  transitions: [],
  ...over,
});

describe('diagnostics snapshot', () => {
  it('solo, outside a run: build, protocol, language, touch, screen and errors only', () => {
    const snap = buildDiagnostics(base());
    expect(snap).toEqual({ build: 'v0.9.1 · abc1234', protocol: 5, lang: 'es', touch: false, screen: 'title', errors: [] });
  });

  it('in a run: dungeon, floor, difficulty and solo or co-op', () => {
    expect(buildDiagnostics(base({ screen: 'run', run: { dungeon: 'crypt', floor: 3, difficulty: 'hard', coop: false } })).run).toEqual({ dungeon: 'crypt', floor: 3, difficulty: 'hard', mode: 'solo' });
    expect(buildDiagnostics(base({ run: { dungeon: 'crypt', floor: 1, difficulty: 'easy', coop: true } })).run?.mode).toBe('coop');
  });

  it('in co-op: role, admission, roster, peers with round trip, silence and link kind, relays received and the transitions in time order', () => {
    const snap = buildDiagnostics(
      base({
        screen: 'room town',
        transitions: [{ tMs: 10, event: 'joinedRoom' }],
        coop: {
          roomStatus: 'in',
          turnServers: 2,
          links: { hostpeer01: { local: 'srflx', remote: 'relay', protocol: 'udp' }, other: null },
          linkEvents: [{ tMs: 30, event: 'ice:connected' }],
          session: {
            role: 'guest',
            localId: 'p2',
            admitted: true,
            started: false,
            refused: null,
            hostLeft: false,
            rosterSize: 2,
            peersConnected: 2,
            peers: [{ peer: 'hostpeer01', id: 'p1', rttMs: 52, msSinceLastMessage: 120 }, { peer: 'other' }],
            transitions: [{ tMs: 20, event: 'knock' }, { tMs: 40, event: 'admitted' }],
          },
        },
      }),
    );
    expect(snap.coop).toEqual({
      role: 'guest',
      localId: 'p2',
      roomStatus: 'in',
      admitted: true,
      started: false,
      refused: null,
      hostLeft: false,
      roster: 2,
      peersConnected: 2,
      turnServers: 2,
      peers: [
        { id: 'p1', rttMs: 52, msSinceLastMessage: 120, link: { local: 'srflx', remote: 'relay', protocol: 'udp' }, via: 'relay' },
        { id: 'peer:othe', link: null },
      ],
      transitions: [
        { tMs: 10, event: 'joinedRoom' },
        { tMs: 20, event: 'knock' },
        { tMs: 30, event: 'ice:connected' },
        { tMs: 40, event: 'admitted' },
      ],
    });
  });

  it('an error keeps a short message and the source file basename with its line', () => {
    const entry = errorEntry(1234.6, 'x'.repeat(500), 'https://example.org/assets/index-AbC123.js?v=2#x', 88);
    expect(entry.tMs).toBe(1235);
    expect(entry.message.length).toBe(300);
    expect(entry.source).toBe('index-AbC123.js:88');
    expect(errorEntry(1, new Error('boom')).message).toBe('boom');
    expect(errorEntry(1, undefined).message).toBe('undefined');
  });

  it('the log keeps the last 20 errors', () => {
    let now = 0;
    const log = createDiagnosticsLog(() => now);
    for (let i = 0; i < 25; i++) {
      now = i;
      log.error(`e${i}`);
    }
    expect(log.errors().length).toBe(MAX_ERRORS);
    expect(log.errors()[0]!.message).toBe('e5');
  });

  it('stays within 16 KB, dropping the oldest entries first', () => {
    const errors = Array.from({ length: 20 }, (_, i) => errorEntry(i * 10, `${i}:` + 'é'.repeat(400), 'a.js', i));
    const transitions = Array.from({ length: 60 }, (_, i) => ({ tMs: i * 10 + 5, event: `ice:${'c'.repeat(200)}` }));
    const snap = buildDiagnostics(base({ errors, transitions: [] , coop: { roomStatus: 'in', turnServers: 0, links: {}, linkEvents: transitions, session: { role: 'host', localId: 'p1', admitted: true, started: true, refused: null, hostLeft: false, rosterSize: 1, peersConnected: 0, peers: [], transitions: [] } } }));
    expect(diagnosticsBytes(snap)).toBeLessThanOrEqual(DIAGNOSTICS_MAX_BYTES);
    expect(snap.errors.length).toBeGreaterThan(0);
    expect(snap.errors.at(-1)!.message.startsWith('19:')).toBe(true);
    expect(snap.coop!.transitions.at(-1)!.tMs).toBe(595);
    // The oldest go first: whatever is left is the newest stretch of both lists.
    const oldestKept = Math.min(snap.errors[0]!.tMs, snap.coop!.transitions[0]!.tMs);
    const dropped = [...errors.filter((e) => !snap.errors.some((k) => k.tMs === e.tMs)), ...transitions.filter((e) => !snap.coop!.transitions.some((k) => k.tMs === e.tMs))];
    expect(dropped.length).toBeGreaterThan(0);
    expect(dropped.every((e) => e.tMs <= oldestKept)).toBe(true);
  });
});

describe('diagnostics privacy', () => {
  it('never carries addresses, nicknames, emails, tokens, account ids or save data', () => {
    const SECRETS = ['192.168.1.23', '81.40.12.7', '2a02:9130::1', 'Paquito', 'Lola', 'fran@example.com', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIn0.c2lnbmF0dXJl', 'acct_9f8e7d6c5b4a', 'coins', 'turnpass-xyz'];
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const host = createSession({ transport: hub.connect('hostpeer01'), scheduler });
    host.host(1, 1, 'mimikyu', { lobby: true, name: 'Paquito' });
    const guest = createSession({ transport: hub.connect('guestpeer2'), scheduler });
    guest.join('mimikyu', SPECIES.mimikyu.defaultLoadout, 'Lola');
    const stats = [
      { id: 'T', type: 'transport', selectedCandidatePairId: 'P' },
      { id: 'P', type: 'candidate-pair', state: 'succeeded', localCandidateId: 'L', remoteCandidateId: 'R' },
      { id: 'L', type: 'local-candidate', candidateType: 'relay', protocol: 'udp', relayProtocol: 'tcp', address: '81.40.12.7', ip: '81.40.12.7', url: 'turn:turnpass-xyz@relay.example' },
      { id: 'R', type: 'remote-candidate', candidateType: 'srflx', protocol: 'udp', address: '2a02:9130::1' },
    ];
    const log = createDiagnosticsLog(() => 5);
    log.error('Failed for fran@example.com at 192.168.1.23 with token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIn0.c2lnbmF0dXJl', 'https://fran@example.com/app.js?token=acct_9f8e7d6c5b4a', 3);
    log.error('account acct_9f8e7d6c5b4a lost 2a02:9130::1');
    log.transition('joinedRoom');
    const snap = buildDiagnostics(
      base({
        screen: 'room town',
        errors: log.errors(),
        transitions: log.transitions(),
        coop: { roomStatus: 'in', turnServers: 1, links: { hostpeer01: selectedPair(stats) }, linkEvents: [], session: guest.diagnostics() },
      }),
    );
    const json = JSON.stringify(snap);
    for (const secret of SECRETS) expect(json).not.toContain(secret);
    expect(json).not.toMatch(/"(email|token|password|accountId|account|nickname|name|address|ip|save)"\s*:/);
    // Still useful: the error kept its shape and the peer its link.
    expect(snap.errors[0]!.source).toBe('app.js:3');
    expect(snap.coop!.peers[0]!.via).toBe('relay');
  });
});

/** Issue #71: the performance summary rides in the same snapshot, allowlisted and within the same 16 KiB. */
const perf = (): PerformanceSnapshot => ({
  schema: 1,
  scene: 'run',
  frameSamples: 540,
  windowMs: 9984,
  ageMs: 1200,
  refreshHz: 60,
  frameMs: { p50: 16.7, p95: 33.4, max: 120.5 },
  lowFpsRatio: 0.04,
  missedRatio: 0.12,
  simMs: { p50: 2.1, p95: 6.3 },
  renderMs: { p50: 5.2, p95: 11 },
  enemies: { mean: 14.2, peak: 24 },
  visibleEnemies: { mean: 6.1, peak: 11 },
  bullets: { mean: 80.3, peak: 212 },
  byEnemies: [
    { enemies: '5-9', frames: 120, p50: 16.7, p95: 16.7 },
    { enemies: '20+', frames: 8 },
  ],
  canvas: { width: 2500, height: 1200, dpr: 3 },
});

describe('diagnostics performance summary', () => {
  it('carries the summary as given when the sampler has one', () => {
    expect(buildDiagnostics(base({ performance: perf() })).performance).toEqual(perf());
  });

  it('has no performance field when nothing was sampled', () => {
    expect(buildDiagnostics(base({ performance: null }))).not.toHaveProperty('performance');
    expect(buildDiagnostics(base())).not.toHaveProperty('performance');
  });

  it('copies only the allowlisted keys and finite numbers (defense in depth)', () => {
    const tampered = {
      ...perf(),
      token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIn0.c2lnbmF0dXJl',
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
      frames: [16.7, 16.6, 33.4],
      frameMs: { p50: 16.7, p95: Number.NaN, max: 'slow', trace: [1, 2] },
      enemies: { mean: 3, peak: 4, ids: ['e1'] },
      byEnemies: [{ enemies: '0-4', frames: 70, p50: 16.7, p95: 17, peer: 'guestpeer2' }, { enemies: 'all', frames: 3 }],
    } as unknown as PerformanceSnapshot;
    const out = buildDiagnostics(base({ performance: tampered })).performance!;
    const json = JSON.stringify(out);
    for (const leak of ['eyJ', 'Mozilla', 'guestpeer2', 'trace', 'ids', 'secret', 'slow']) expect(json).not.toContain(leak);
    expect(out).not.toHaveProperty('frames');
    expect(out).not.toHaveProperty('token');
    expect(out.frameMs).toBeUndefined();
    expect(out.enemies).toEqual({ mean: 3, peak: 4 });
    expect(out.byEnemies).toEqual([{ enemies: '0-4', frames: 70, p50: 16.7, p95: 17 }]);
  });

  it('leaves out a summary of an unknown version or scene', () => {
    expect(buildDiagnostics(base({ performance: { ...perf(), schema: 2 } as unknown as PerformanceSnapshot }))).not.toHaveProperty('performance');
    expect(buildDiagnostics(base({ performance: { ...perf(), scene: 'dungeon://secret' } as unknown as PerformanceSnapshot }))).not.toHaveProperty('performance');
  });

  it('keeps the summary within 16 KB by dropping the oldest errors first', () => {
    const errors = Array.from({ length: 20 }, (_, i) => errorEntry(i * 10, `${i}:` + 'é'.repeat(1200), 'a.js', i));
    const snap = buildDiagnostics(base({ errors, performance: perf() }));
    expect(diagnosticsBytes(snap)).toBeLessThanOrEqual(DIAGNOSTICS_MAX_BYTES);
    expect(snap.performance).toEqual(perf());
  });

  it('drops the density split, then the whole summary, only when nothing else is left to drop', () => {
    const bare = buildDiagnostics(base());
    const withSplit = buildDiagnostics(base({ performance: perf() }));
    const { byEnemies: _split, ...withoutSplit } = perf();
    const noSplitBytes = diagnosticsBytes({ ...bare, performance: withoutSplit });
    expect(buildDiagnostics(base({ performance: perf() }), noSplitBytes).performance).toEqual(withoutSplit);
    expect(buildDiagnostics(base({ performance: perf() }), noSplitBytes - 1)).toEqual(bare);
    expect(diagnosticsBytes(withSplit)).toBeGreaterThan(noSplitBytes);
  });
});
