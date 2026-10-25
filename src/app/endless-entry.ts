import { clockText, dailySeed, type EndlessMode } from '../core/endless';
import { ECLIPSE } from '../data/dungeons';
import { MUSIC_TRACKS } from '../data/music';
import { t } from '../i18n';
import { scoreLine, type ScoreEntry } from '../town/leaderboard';
import { cursorList } from '../ui/cursor-list';
import { h, mdWindow } from '../ui/window';

/**
 * The Sima del Eclipse's entry card, before its run: name and subtitle, the
 * rules (modo puro, the clock), "♪ title" of its first track, the best score
 * on this device and the two modes: the daily challenge (the UTC day's seed,
 * shown so a stream audience can check it) or a free run.
 */
export interface EndlessEntryOptions {
  /** Today's UTC date, "YYYY-MM-DD". */
  today: string;
  board: readonly ScoreEntry[];
  onStart(mode: EndlessMode): void;
  onBack(): void;
}

export function endlessEntryScreen(options: EndlessEntryOptions): HTMLElement[] {
  const endless = ECLIPSE.endless!;
  const best = options.board[0];
  const list = cursorList({
    label: t(ECLIPSE.lore.nameKey),
    onBack: options.onBack,
    items: [
      { label: t('endless.mode.daily'), value: options.today, onConfirm: () => options.onStart('daily') },
      { label: t('endless.mode.free'), onConfirm: () => options.onStart('free') },
      { label: t('menu.back'), onConfirm: options.onBack },
    ],
  });
  return [
    h('h1', { className: 'screen-title', textContent: t(ECLIPSE.lore.nameKey) }),
    h('div', { className: 'screen-row' }, [
      mdWindow({ title: t('endless.entry.title'), className: 'dungeon-about endless-entry' }, [
        h('p', { className: 'dim', textContent: t(ECLIPSE.lore.subtitleKey) }),
        h('p', { textContent: t('endless.entry.pure') }),
        h('p', { textContent: t('endless.entry.clock').replace('{time}', clockText(endless.clock.startMs)).replace('{bonus}', String(endless.clock.descendMs / 1000)) }),
        h('p', { className: 'dim', textContent: t('endless.entry.daily').replace('{date}', options.today).replace('{seed}', String(dailySeed(options.today))) }),
        h('p', { textContent: best ? `${t('endless.entry.best')} ${scoreLine(best, 1, t)}` : t('endless.board.none') }),
        h('p', { className: 'dim', textContent: `♪ ${MUSIC_TRACKS[endless.musicBands[0] ?? ECLIPSE.music.floor].title}` }),
      ]),
      mdWindow({ title: t('endless.entry.mode'), className: 'dungeons' }, [list.element]),
    ]),
  ];
}
