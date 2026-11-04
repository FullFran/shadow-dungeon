import { memoryStore } from '../adapters/storage';
import { CHANGELOG } from '../data/changelog';
import { installNotice, newsNotice, updateNotice } from '../pwa/notices';
import { notices } from '../ui/notice';

/**
 * Dev only (imported behind `import.meta.env.DEV` in main.ts): `?notice=install,update,news` forces the system notices onto
 * the queue so they can be looked at without a service worker, an install prompt or a new release. Nothing is stored and the
 * update never reloads; the queue still waits for the hub as it does in production.
 */
export function queueDevNotices(search: string): void {
  const wanted = new URLSearchParams(search).get('notice')?.split(',') ?? [];
  for (const kind of wanted) {
    if (kind === 'install') {
      const notice = installNotice('prompt', memoryStore(), () => {});
      if (notice) notices.enqueue(notice);
    } else if (kind === 'update') notices.enqueue(updateNotice(() => {}, () => {}));
    else if (kind === 'news' && CHANGELOG[0]) notices.enqueue(newsNotice(CHANGELOG[0], () => {}));
  }
}
