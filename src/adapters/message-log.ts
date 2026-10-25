import type { GameEvent } from '../core/state';
import { t } from '../i18n';
import { drawPanel, pixelText } from '../ui/canvas';
import { FONT, PALETTE } from '../ui/tokens';
import { levelUpText } from './hud';

/**
 * The Mystery Dungeon-style message log at the bottom left: the last few
 * lines ("¡Mimikyu subió al nivel 5!", an enemy defeated, a berry eaten, the
 * disguise broken, an item equipped, the collapse warning), each fading out
 * a few seconds after it appeared. The log is a pure value updated with the
 * game's real (pause-aware) clock; drawing is separate.
 */
export const LOG = {
  /** Lines kept on screen at once. */
  capacity: 4,
  /** A line's whole life, fade included. */
  lifeMs: 5000,
  /** The last part of its life during which it fades out. */
  fadeMs: 800,
} as const;

export type LogTone = 'info' | 'good' | 'warn' | 'level' | 'item';

export interface LogEntry {
  id: number;
  text: string;
  tone: LogTone;
  atMs: number;
}

export interface MessageLog {
  /** Oldest first. */
  entries: readonly LogEntry[];
  nextId: number;
}

export const emptyLog = (): MessageLog => ({ entries: [], nextId: 1 });

/** Adds a line at `nowMs`; past the cap the oldest line goes. */
export function pushMessage(log: MessageLog, text: string, tone: LogTone, nowMs: number): MessageLog {
  const entries = [...log.entries, { id: log.nextId, text, tone, atMs: nowMs }];
  return { entries: entries.slice(Math.max(0, entries.length - LOG.capacity)), nextId: log.nextId + 1 };
}

/** Drops the lines whose life is over at `nowMs` (the same log when nothing expired). */
export function pruneLog(log: MessageLog, nowMs: number): MessageLog {
  const entries = log.entries.filter((e) => nowMs - e.atMs < LOG.lifeMs);
  return entries.length === log.entries.length ? log : { ...log, entries };
}

/** Opacity of a line: 1, then a linear fade over the last `fadeMs` of its life. */
export function logAlpha(entry: Pick<LogEntry, 'atMs'>, nowMs: number): number {
  const left = LOG.lifeMs - (nowMs - entry.atMs);
  return Math.max(0, Math.min(1, left / LOG.fadeMs));
}

export function visibleMessages(log: MessageLog, nowMs: number): { text: string; tone: LogTone; alpha: number }[] {
  return log.entries.map((e) => ({ text: e.text, tone: e.tone, alpha: logAlpha(e, nowMs) })).filter((m) => m.alpha > 0);
}

/** Lines for the events of one step; `speciesOf` names a defeated enemy by id. */
export function eventMessages(events: readonly GameEvent[], speciesOf: (enemyId: string) => string | null, species: string): { text: string; tone: LogTone }[] {
  const name = t(`species.${species}`);
  const out: { text: string; tone: LogTone }[] = [];
  for (const event of events) {
    if (event.type === 'levelUp') out.push({ text: levelUpText(species, event.level), tone: 'level' });
    else if (event.type === 'enemyDefeated') {
      const enemy = speciesOf(event.enemyId);
      if (enemy) out.push({ text: t('log.defeated').replace('{name}', t(`species.${enemy}`)), tone: 'good' });
    } else if (event.type === 'berryEaten') out.push({ text: t('log.berry').replace('{name}', name).replace('{heal}', String(Math.round(event.heal))), tone: 'good' });
    else if (event.type === 'disguiseBroken') out.push({ text: t('hud.disguiseBroken'), tone: 'warn' });
    else if (event.type === 'passiveTriggered') out.push({ text: t(`log.passive.${event.passive}${event.kindled ? '.kindled' : ''}`).replace('{name}', name), tone: event.passive === 'illusion' ? 'warn' : 'good' });
  }
  return out;
}

/** "Mimikyu se equipó Restos.": the line for a picked held item. */
export const itemPickedText = (species: string, item: string): string => t('log.item').replace('{name}', t(`species.${species}`)).replace('{item}', t(`item.${item}`));

const TONE_COLORS: Record<LogTone, string> = { info: PALETTE.text, good: PALETTE.good, warn: PALETTE.eclipseGlow, level: PALETTE.xp, item: PALETTE.cursor };

const LINE = 13;
const WIDTH = 236;

/** Draws the log at the bottom left of the view (view units; the caller has applied the pixel scale). */
export function drawMessageLog(ctx: CanvasRenderingContext2D, log: MessageLog, nowMs: number, viewHeight: number): void {
  const lines = visibleMessages(log, nowMs);
  if (lines.length === 0) return;
  const height = lines.length * LINE + 9;
  const x = 6;
  const y = viewHeight - 6 - height;
  const frame = Math.max(...lines.map((l) => l.alpha));
  drawPanel(ctx, x, y, WIDTH, height, { alpha: 0.88 * frame });
  ctx.font = `${FONT.hudPx}px "${FONT.family}"`;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 3, y + 2, WIDTH - 6, height - 4);
  ctx.clip();
  lines.forEach((line, i) => {
    ctx.globalAlpha = line.alpha;
    pixelText(ctx, line.text, x + 7, y + 13 + i * LINE, TONE_COLORS[line.tone]);
  });
  ctx.restore();
  ctx.globalAlpha = 1;
}
