/**
 * TURN relay servers for co-op (issue #4): the API hands out short-lived
 * Cloudflare Realtime credentials (`GET /api/sd/turn`), fetched when a room
 * opens and given to Trystero, so two browsers that cannot reach each other
 * directly (strict NAT, mobile data, privacy settings) talk through the relay
 * instead of never connecting. Any failure means no relay: co-op then works
 * exactly as before, direct only.
 */
export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

/** How long opening a room waits for the credentials before going on without them. */
export const TURN_TIMEOUT_MS = 4_000;

const ICE_URL = /^(stun|turn|turns):[^\s]+$/;

/** The iceServers of the API's answer, keeping only well-formed ICE entries; [] for anything else. */
export function parseIceServers(body: unknown): IceServer[] {
  const list = (body as { iceServers?: unknown } | null)?.iceServers;
  if (!Array.isArray(list)) return [];
  const out: IceServer[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const { urls, username, credential } = entry as Record<string, unknown>;
    const valid = (Array.isArray(urls) ? urls : [urls]).filter((u): u is string => typeof u === 'string' && ICE_URL.test(u));
    if (valid.length === 0) continue;
    out.push({ urls: valid, ...(typeof username === 'string' ? { username } : {}), ...(typeof credential === 'string' ? { credential } : {}) });
  }
  return out;
}

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

/** The relay servers from the API at `baseUrl`, or [] when it fails or takes longer than `timeoutMs`. Never throws. */
export async function fetchIceServers(baseUrl: string, fetchFn: FetchFn = fetch, timeoutMs = TURN_TIMEOUT_MS): Promise<IceServer[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(`${baseUrl}/api/sd/turn`, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) return [];
    return parseIceServers(await res.json());
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
