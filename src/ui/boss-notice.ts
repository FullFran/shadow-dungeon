import type { BossMoment } from '../core/boss-moment';
import { spellCardKey } from '../data/enemies';
import type { SpeciesId } from '../data/species';
import { t } from '../i18n';

/**
 * The big, centred notice of a boss moment: a phase change ("¡CAMBIO DE FASE!" and the name of what comes) or the
 * boss's final defeat. It holds the screen for about three seconds (a slow reader, a short-sighted player), with a
 * brief white flash at the start. The first phase change a player ever sees also carries a one-line tip saying what
 * a phase change means. Pure: `adapters/intro-card.ts` draws it.
 */
export const NOTICE_MS = { enter: 200, hold: 2700, exit: 500 } as const;
export const NOTICE_LIFE_MS = NOTICE_MS.enter + NOTICE_MS.hold + NOTICE_MS.exit;

/** Opacity at `ageMs` since the notice appeared. */
export function noticeAlpha(ageMs: number): number {
  if (ageMs <= 0) return 0;
  if (ageMs < NOTICE_MS.enter) return ageMs / NOTICE_MS.enter;
  if (ageMs < NOTICE_MS.enter + NOTICE_MS.hold) return 1;
  const out = ageMs - NOTICE_MS.enter - NOTICE_MS.hold;
  return out >= NOTICE_MS.exit ? 0 : 1 - out / NOTICE_MS.exit;
}

/** The screen flash on the notice's first moments (a white pulse that dies in 350 ms). */
export const FLASH_MS = 350;
export const flashAlpha = (ageMs: number): number => (ageMs < 0 || ageMs >= FLASH_MS ? 0 : 0.55 * (1 - ageMs / FLASH_MS));

export interface BossNotice {
  kind: BossMoment['kind'];
  /** The large line: what happened. */
  heading: string;
  /** The boss's name (a final defeat) or the name of what comes (a phase change). */
  name: string;
  /** The one-time explanation of a phase change, when it is the player's first. */
  tip: string | null;
  /** When it appeared (real time, ms). */
  shownAtMs: number;
}

const has = (key: string): boolean => t(key) !== key;

/** The text of a boss moment; `showTip` adds the phase-change tip (never to a final defeat). `shownAtMs` is set by the caller. */
export function bossNotice(moment: Pick<BossMoment, 'kind' | 'species' | 'stance'>, options: { showTip: boolean; shownAtMs?: number }): BossNotice {
  const species = t(`species.${moment.species}`);
  const shownAtMs = options.shownAtMs ?? 0;
  if (moment.kind === 'finale') return { kind: 'finale', heading: t('boss.moment.finale'), name: species, tip: null, shownAtMs };
  const key = moment.stance ? spellCardKey(moment.species as SpeciesId, moment.stance) : null;
  // The phase's own name ("El Rey desenvaina"), else the stance's, else the boss's.
  const raw = key && has(key) ? t(key) : moment.stance && has(`boss.stance.${moment.stance}`) ? t(`boss.stance.${moment.stance}`) : species;
  // "Signo X «Name»" shows as its name alone.
  const quoted = /[«“"](.+?)[»”"]\s*$/.exec(raw);
  return { kind: 'phase', heading: t('boss.moment.phase'), name: quoted ? quoted[1]! : raw, tip: options.showTip ? t('boss.moment.tip') : null, shownAtMs };
}

/**
 * Whether a boss's item pick must wait (owner, 2026-11-12: "que primero te
 * salga que lo has vencido y despues para elegir objeto"): while the defeat
 * notice is still on screen, or while a story line (its last words) is open.
 * A phase change never holds a pick.
 */
export function pickWaits(notice: BossNotice | null, nowMs: number, storyOpen: boolean): boolean {
  if (storyOpen) return true;
  return notice?.kind === 'finale' && nowMs - notice.shownAtMs < NOTICE_LIFE_MS;
}

/** The one-time tip: true the first time (and marks it as seen), false after, or when the run has no tip store. */
export function takePhaseTip(tip: { seen(): boolean; mark(): void } | undefined): boolean {
  if (!tip || tip.seen()) return false;
  tip.mark();
  return true;
}
