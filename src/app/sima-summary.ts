import type { SimaRecord } from '../core/sima-events';

/** At most this many events are listed on the end screen (the latest), with a count of the rest. */
export const SUMMARY_LINES = 4;

/**
 * The Sima's end screen block: the floor events of the run in plain words
 * ("Planta 4 · Altar del Eclipse: pacto aceptado"), the latest last.
 */
export function simaEventLines(records: readonly SimaRecord[], t: (key: string) => string): string[] {
  const shown = records.slice(-SUMMARY_LINES);
  const lines = shown.map((r) =>
    t('sima.summary.line').replace('{floor}', String(r.floor)).replace('{event}', t(`sima.event.${r.kind}`)).replace('{outcome}', t(`sima.outcome.${r.outcome}`)),
  );
  const rest = records.length - shown.length;
  return rest > 0 ? [...lines, t('sima.summary.more').replace('{count}', String(rest))] : lines;
}
