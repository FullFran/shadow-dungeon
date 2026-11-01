import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Development server only: the effect gallery (tools/fx-gallery.html) saves the
 * owner's verdict on each move to `reports/fx/feedback.json`, where the agent
 * applying them can read it. Never part of a build.
 */

export const FEEDBACK_URL = '/__fx-feedback';

export type FeedbackChoice = 'old' | 'new' | 'neither';
export interface FeedbackEntry {
  choice?: FeedbackChoice;
  comment: string;
}
export type Feedback = Record<string, FeedbackEntry>;

const CHOICES: readonly string[] = ['old', 'new', 'neither'];
const ID = /^[a-z0-9_-]{1,40}$/;
const MAX_COMMENT = 2000;
const MAX_BODY_BYTES = 512 * 1024;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function sanitizeFeedback(raw: unknown): Feedback {
  if (!isRecord(raw)) return {};
  const out: Feedback = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!ID.test(id) || !isRecord(value)) continue;
    const choice = typeof value.choice === 'string' && CHOICES.includes(value.choice) ? (value.choice as FeedbackChoice) : undefined;
    const comment = typeof value.comment === 'string' ? value.comment.slice(0, MAX_COMMENT) : '';
    if (choice || comment) out[id] = { ...(choice ? { choice } : {}), comment };
  }
  return out;
}

export function readFeedback(file: string): Feedback {
  try {
    return sanitizeFeedback(JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    return {};
  }
}

/** Written whole through a temporary file: a crash never leaves half a verdict list. */
export function writeFeedback(file: string, feedback: Feedback): void {
  mkdirSync(dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(feedback, null, 2)}\n`);
  renameSync(temporary, file);
}

/** Another site open in the browser must not be able to write here. */
export function sameOrigin(origin: string | undefined, host: string | undefined): boolean {
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function fxFeedbackPlugin(root: string = process.cwd()): Plugin {
  const file = join(root, 'reports', 'fx', 'feedback.json');
  return {
    name: 'fx-feedback',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(FEEDBACK_URL, (req, res) => {
        const reply = (status: number, body: unknown): void => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        if (req.method === 'GET') return reply(200, readFeedback(file));
        if (req.method !== 'POST') return reply(405, { error: 'method' });
        if (!sameOrigin(req.headers.origin, req.headers.host)) return reply(403, { error: 'origin' });
        let body = '';
        let tooLong = false;
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString('utf8');
          if (body.length > MAX_BODY_BYTES) tooLong = true;
        });
        req.on('end', () => {
          if (tooLong) return reply(413, { error: 'size' });
          try {
            const feedback = sanitizeFeedback(JSON.parse(body));
            writeFeedback(file, feedback);
            reply(200, { saved: Object.keys(feedback).length });
          } catch {
            reply(400, { error: 'json' });
          }
        });
      });
    },
  };
}
