import { describe, expect, it } from 'vitest';
import { sendReport, type ReportPayload } from '../../src/adapters/report-api';

const report: ReportPayload = { category: 'bug', description: 'The boss froze', steps: '', expected: '', observed: '', version: '1.2.3', device: 'Firefox / Linux / no touch' };

const respond = (status: number, body: unknown) => async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });

describe('report API', () => {
  it('posts the report as JSON to /api/sd/reports and returns its ref', async () => {
    let url = '';
    let init: RequestInit | undefined;
    const result = await sendReport('https://api.example', report, async (u, i) => {
      url = u;
      init = i;
      return respond(201, { ref: 'SD-AB12CD' })();
    });
    expect(result).toEqual({ kind: 'ok', ref: 'SD-AB12CD' });
    expect(url).toBe('https://api.example/api/sd/reports');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(init?.body))).toEqual({ ...report, website: '' });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('maps throttling, rejection, outage and a bad answer', async () => {
    expect(await sendReport('b', report, respond(429, { message: 'slow down' }))).toEqual({ kind: 'rate-limited' });
    expect(await sendReport('b', report, respond(400, { error: 'description is required', field: 'description' }))).toEqual({ kind: 'invalid', field: 'description' });
    expect(await sendReport('b', report, respond(413, { error: 'report too large' }))).toEqual({ kind: 'invalid' });
    expect(await sendReport('b', report, respond(503, { error: 'too many reports today' }))).toEqual({ kind: 'unavailable' });
    expect(await sendReport('b', report, respond(500, 'oops'))).toEqual({ kind: 'unavailable' });
    expect(await sendReport('b', report, respond(201, { ref: '<script>' }))).toEqual({ kind: 'unavailable' });
  });

  it('is unavailable when the network fails or the server never answers', async () => {
    expect(
      await sendReport('b', report, async () => {
        throw new TypeError('Failed to fetch');
      }),
    ).toEqual({ kind: 'unavailable' });
    const hang = (_: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    expect(await sendReport('b', report, hang, 10)).toEqual({ kind: 'unavailable' });
  });
});
