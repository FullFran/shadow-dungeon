import { linkKind, pushRing, type LinkInfo, type SessionDiagnostics, type Transition } from '../net/diagnostics';

/**
 * The technical report (issue #6, docs/gdd.md §12): a plain JSON snapshot of
 * this session (build, screen, run, recent errors and, in a room, the
 * connection) that a bug report carries when the player keeps "Adjuntar
 * información técnica" on, and that the room menu copies to the clipboard.
 * Nothing runs in the background and nothing is sent on its own.
 *
 * Private by construction: only the fields listed here are copied, peers go
 * by player id, links by candidate kind, and error messages lose emails,
 * addresses and token-like strings. Never nicknames, accounts or the save.
 */

/** The server's cap on `diagnostics` (server/internal/reports). */
export const DIAGNOSTICS_MAX_BYTES = 16 * 1024;
export const MAX_ERRORS = 20;
const MAX_APP_TRANSITIONS = 20;
const MESSAGE_CHARS = 300;

export interface ErrorEntry {
  tMs: number;
  message: string;
  /** Script file basename and line ("index-AbC123.js:88"); empty when unknown. */
  source: string;
}

/** Strips what could point at a person: URL queries, emails, tokens, IP addresses, long id-like strings. */
export function scrub(text: string): string {
  return text
    .replace(/(\b[a-z][\w+.-]*:\/\/[^\s?#]+)[?#]\S*/gi, '$1')
    .replace(/[^\s@"'<>()/]+@[^\s@"'<>()]+/g, '[email]')
    .replace(/\beyJ[\w-]*(?:\.[\w-]*){0,2}/g, '[token]')
    .replace(/(?:\b[0-9a-f]{1,4}:){2,}[0-9a-f:]*|::[0-9a-f]{1,4}(?::[0-9a-f]{1,4})*/gi, '[ip]')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[ip]')
    .replace(/\b(?=[\w-]*\d)(?=[\w-]*[a-z])[\w-]{12,}\b/gi, '[id]');
}

/** A script's file name without its folders, query or odd characters ("index-AbC123.js"). */
const basename = (file: string): string => {
  const path = file.split(/[?#]/)[0] ?? '';
  return path.slice(path.lastIndexOf('/') + 1).replace(/[^\w.-]/g, '').slice(0, 80);
};

/** One error: when (page clock, ms), a short scrubbed message, and where (file basename and line). */
export function errorEntry(tMs: number, message: unknown, file?: string, line?: number): ErrorEntry {
  const text = message instanceof Error ? message.message : String(message);
  const name = file ? basename(file) : '';
  return { tMs: Math.round(tMs), message: scrub(text).slice(0, MESSAGE_CHARS), source: name ? `${name}${line ? `:${line}` : ''}` : '' };
}

/** The page's recent errors and app-level transitions (joined a room…), kept in memory only. */
export interface DiagnosticsLog {
  error(message: unknown, file?: string, line?: number): void;
  transition(event: string): void;
  errors(): readonly ErrorEntry[];
  transitions(): readonly Transition[];
}

export function createDiagnosticsLog(now: () => number): DiagnosticsLog {
  const errors: ErrorEntry[] = [];
  const transitions: Transition[] = [];
  return {
    error: (message, file, line) => pushRing(errors, errorEntry(now(), message, file, line), MAX_ERRORS),
    transition: (event) => pushRing(transitions, { tMs: Math.round(now()), event }, MAX_APP_TRANSITIONS),
    errors: () => [...errors],
    transitions: () => [...transitions],
  };
}

export interface DiagnosticsInput {
  build: string;
  protocol: number;
  lang: string;
  touch: boolean;
  /** Where the player is: title, town, room town, run… */
  screen: string;
  run?: { dungeon: string; floor: number; difficulty: string; coop: boolean };
  errors: readonly ErrorEntry[];
  /** App-level transitions (joined a room). */
  transitions: readonly Transition[];
  coop?: {
    session: SessionDiagnostics;
    /** The lobby's view of this player: in, connecting, unreachable. */
    roomStatus: string;
    /** Relay (TURN) servers received with the room. */
    turnServers: number;
    links: Record<string, LinkInfo | null>;
    linkEvents: readonly Transition[];
  };
}

export interface DiagnosticsPeer {
  id: string;
  rttMs?: number;
  msSinceLastMessage?: number;
  link: LinkInfo | null;
  via?: 'direct' | 'relay';
}

export interface Diagnostics {
  build: string;
  protocol: number;
  lang: string;
  touch: boolean;
  screen: string;
  run?: { dungeon: string; floor: number; difficulty: string; mode: 'solo' | 'coop' };
  errors: ErrorEntry[];
  transitions?: Transition[];
  coop?: {
    role: 'host' | 'guest' | null;
    localId: string | null;
    roomStatus: string;
    admitted: boolean;
    started: boolean;
    refused: 'full' | 'version' | null;
    hostLeft: boolean;
    roster: number;
    peersConnected: number;
    turnServers: number;
    peers: DiagnosticsPeer[];
    transitions: Transition[];
  };
}

/** UTF-8 size of the snapshot as sent. */
export const diagnosticsBytes = (snapshot: Diagnostics): number => new TextEncoder().encode(JSON.stringify(snapshot)).length;

const byTime = (a: Transition, b: Transition) => a.tMs - b.tMs;

/** The snapshot: only the listed fields, at most `maxBytes`, the oldest errors and transitions dropped first. */
export function buildDiagnostics(input: DiagnosticsInput, maxBytes = DIAGNOSTICS_MAX_BYTES): Diagnostics {
  const errors = input.errors.map((e) => ({ tMs: e.tMs, message: scrub(e.message).slice(0, MESSAGE_CHARS), source: e.source }));
  const appTransitions = input.transitions.map((e) => ({ tMs: e.tMs, event: e.event }));
  const snapshot: Diagnostics = {
    build: input.build,
    protocol: input.protocol,
    lang: input.lang,
    touch: input.touch,
    screen: input.screen,
    ...(input.run ? { run: { dungeon: input.run.dungeon, floor: input.run.floor, difficulty: input.run.difficulty, mode: input.run.coop ? 'coop' : 'solo' } } : {}),
    errors,
  };
  let transitions = appTransitions;
  const coop = input.coop;
  if (coop) {
    const s = coop.session;
    transitions = [...appTransitions, ...s.transitions.map((e) => ({ tMs: e.tMs, event: e.event })), ...coop.linkEvents.map((e) => ({ tMs: e.tMs, event: e.event }))].sort(byTime);
    snapshot.coop = {
      role: s.role,
      localId: s.localId,
      roomStatus: coop.roomStatus,
      admitted: s.admitted,
      started: s.started,
      refused: s.refused,
      hostLeft: s.hostLeft,
      roster: s.rosterSize,
      peersConnected: s.peersConnected,
      turnServers: coop.turnServers,
      peers: s.peers.map((p) => {
        const link = coop.links[p.peer] ?? null;
        return {
          // A peer not listed yet goes by the start of its random transport id, never by name.
          id: p.id ?? `peer:${p.peer.slice(0, 4)}`,
          ...(p.rttMs !== undefined ? { rttMs: p.rttMs } : {}),
          ...(p.msSinceLastMessage !== undefined ? { msSinceLastMessage: p.msSinceLastMessage } : {}),
          link: link ? { local: link.local, remote: link.remote, protocol: link.protocol, ...(link.relayProtocol ? { relayProtocol: link.relayProtocol } : {}) } : null,
          ...(link ? { via: linkKind(link) } : {}),
        };
      }),
      transitions,
    };
  } else if (transitions.length > 0) snapshot.transitions = transitions;
  // Over the cap: drop the oldest entry of the two lists, one at a time.
  while (diagnosticsBytes(snapshot) > maxBytes && (errors.length > 0 || transitions.length > 0)) {
    const oldestError = errors[0]?.tMs ?? Number.POSITIVE_INFINITY;
    const oldestTransition = transitions[0]?.tMs ?? Number.POSITIVE_INFINITY;
    if (oldestError <= oldestTransition) errors.shift();
    else transitions.shift();
  }
  return snapshot;
}

/** The snapshot as the room menu copies it: pretty-printed JSON. */
export const diagnosticsText = (snapshot: Diagnostics): string => JSON.stringify(snapshot, null, 2);
