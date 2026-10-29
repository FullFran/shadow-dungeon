/**
 * Sends a player's bug report to the game API (`POST /api/sd/reports`,
 * server/README.md "Bug reports"). Anonymous: no token, no account id, no
 * save; only what the player typed plus, when they agree, the game version
 * and a coarse device summary. The server answers a reference (SD-XXXXXX)
 * the player can quote to the owner.
 */

export const REPORT_CATEGORIES = ['bug', 'online', 'performance', 'interface', 'progress', 'suggestion', 'other'] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/** What the game posts (the server also takes `diagnostics`, not sent yet). */
export interface ReportPayload {
  category: ReportCategory;
  description: string;
  steps: string;
  expected: string;
  observed: string;
  version: string;
  device: string;
}

export type ReportResult =
  | { kind: 'ok'; ref: string }
  /** Too many reports from this connection (5 per 10 minutes). */
  | { kind: 'rate-limited' }
  /** The server refused a field; `field` names it when it said which. */
  | { kind: 'invalid'; field?: string }
  /** Offline, timed out, the daily cap, or the server failing. */
  | { kind: 'unavailable' };

export const REPORT_TIMEOUT_MS = 15_000;

const REF = /^SD-[A-Z0-9]{6}$/;

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function sendReport(baseUrl: string, report: ReportPayload, fetchFn: FetchFn = (input, init) => globalThis.fetch(input, init), timeoutMs = REPORT_TIMEOUT_MS): Promise<ReportResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(`${baseUrl}/api/sd/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `website` is the server's honeypot: people never fill it.
      body: JSON.stringify({ ...report, website: '' }),
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
    });
    const body = (await readJson(res)) as { ref?: unknown; field?: unknown } | null;
    if (res.status === 201 || res.status === 200) {
      return typeof body?.ref === 'string' && REF.test(body.ref) ? { kind: 'ok', ref: body.ref } : { kind: 'unavailable' };
    }
    if (res.status === 429) return { kind: 'rate-limited' };
    if (res.status === 400 || res.status === 413) return typeof body?.field === 'string' ? { kind: 'invalid', field: body.field } : { kind: 'invalid' };
    return { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}
