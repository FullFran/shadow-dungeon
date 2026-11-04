import type { KeyValueStore } from '../adapters/storage';
import { CHANGELOG_SECTIONS, type Release } from '../data/changelog';
import { getLanguage, t } from '../i18n';
import { NEWS_SECTION_ICONS } from '../ui/icons/achievements-news-icons';
import type { NoticeAction, NoticeLine, NoticeSpec } from '../ui/notice-model';
import { installCard, runInstallAction, type InstallChoice, type InstallOffer } from './install';

/**
 * The three system notices as data (the view is src/ui/notice.ts). They keep the transitions the old toast,
 * install card and news screen had; only the presentation and the queueing changed (owner, 2026-11-04).
 */

/** The install invitation: the old card's choices, mapped onto `runInstallAction`. Null where nothing is offered. */
export function installNotice(offer: InstallOffer, store: KeyValueStore, install: () => void): NoticeSpec | null {
  const card = installCard(offer);
  if (!card) return null;
  const action = (choice: InstallChoice): NoticeAction => ({
    label: t(choice.label),
    run: () => {
      const result = runInstallAction(choice.action, store);
      if (result.install) install();
      return result.close ? 'close' : 'stay';
    },
  });
  const icons = ['fullscreen', 'install', 'star'];
  return {
    kind: 'install',
    title: t(card.titleKey),
    lines: card.bodyKeys.slice(0, 3).map((key, i): NoticeLine => ({ icon: card.bodyKeys.length === 1 ? 'install' : icons[i]!, text: t(key) })),
    primary: action(card.primary),
    ...(card.secondary ? { secondary: action(card.secondary) } : {}),
    tertiary: action(card.never),
  };
}

/**
 * A new service worker is waiting. "Actualizar ahora" activates it and reloads the page, so the notice stays up until then
 * (never a half state); "Más tarde" only puts the question off (`snooze`), the worker keeps waiting.
 */
export function updateNotice(apply: () => void, snooze: () => void): NoticeSpec {
  return {
    kind: 'update',
    title: t('pwa.update'),
    lines: [
      { icon: 'update', text: t('notice.update.line1') },
      { icon: 'seal', text: t('notice.update.line2') },
    ],
    primary: {
      label: t('notice.update.now'),
      run: () => {
        apply();
        return 'stay';
      },
    },
    secondary: {
      label: t('notice.later'),
      run: () => {
        snooze();
        return 'close';
      },
    },
  };
}

/** A change's first sentence, capped so a notice line stays short. */
export function shortLine(text: string, max = 110): string {
  const first = text.split(/(?<=[.!?])\s/)[0] ?? text;
  return first.length <= max ? first : `${first.slice(0, max - 1).trimEnd()}…`;
}

/** The first changes of a release, in the player's language (at most `max`). */
function headlines(release: Release, max: number): NoticeLine[] {
  const language = getLanguage();
  const lines: NoticeLine[] = [];
  for (const section of CHANGELOG_SECTIONS) {
    for (const item of release.sections[section] ?? []) {
      if (lines.length < max) lines.push({ icon: item.icon ?? NEWS_SECTION_ICONS[section], text: shortLine(item[language]) });
    }
  }
  return lines;
}

/** "Novedades": the update was installed; the primary opens the news screen (`open`), "Más tarde" leaves it for the Options entry. */
export function newsNotice(release: Release, open: () => void): NoticeSpec {
  const lines = headlines(release, 3);
  return {
    kind: 'news',
    title: t('notice.news.title').replace('{version}', release.version),
    lines: lines.length > 0 ? lines : [{ icon: 'star', text: t('notice.news.fallback') }],
    primary: {
      label: t('notice.news.view'),
      run: () => {
        open();
        return 'close';
      },
    },
    secondary: { label: t('notice.later'), run: () => 'close' },
  };
}
