import type { KeyValueStore } from '../adapters/storage';
import { familyProgress } from '../core/achievements';
import { ACHIEVEMENT_FAMILIES, ACHIEVEMENTS, type AchievementDef } from '../data/achievements';
import { dungeonById, guardianOf } from '../data/dungeons';
import { t } from '../i18n';
import { cursorList } from '../ui/cursor-list';
import { h, mdWindow, statLine } from '../ui/window';
import { coinText } from './coin-lines';
import { loadSave } from './save';

/**
 * The achievements on screen (odd/tasks/achievements-missions.md): names
 * and descriptions filled from i18n templates with the content's own names
 * (a new dungeon or species needs no new text), the unlock toast and the
 * achievements window (families with their progress, and the list of the
 * family under the cursor). `tr` is the i18n lookup.
 */
type Tr = (key: string) => string;

const fill = (text: string, values: Record<string, string>): string => Object.entries(values).reduce((out, [k, v]) => out.split(`{${k}}`).join(v), text);

/** The placeholders of an achievement's texts. */
function values(def: AchievementDef, tr: Tr): Record<string, string> {
  const r = def.rule;
  switch (r.kind) {
    case 'clear':
      return { dungeon: tr(dungeonById(r.dungeon).lore.nameKey), difficulty: tr(`difficulty.${r.tier}`) };
    case 'flawless': {
      const guardian = guardianOf(dungeonById(r.dungeon));
      return { dungeon: tr(dungeonById(r.dungeon).lore.nameKey), guardian: guardian ? tr(`species.${guardian}`) : '' };
    }
    case 'depth':
      return { dungeon: tr(dungeonById(r.dungeon).lore.nameKey), floor: String(r.floor) };
    case 'species':
    case 'evolve':
      return { species: tr(`species.${r.species}`) };
    case 'earned':
      return { n: String(r.coins) };
    default:
      return {};
  }
}

/** The i18n key stem of an achievement's texts: its rule kind. */
const stem = (def: AchievementDef): string => `achievement.${def.rule.kind}`;

export const achievementTitle = (def: AchievementDef, tr: Tr): string => fill(tr(`${stem(def)}.title`), values(def, tr));

export const achievementText = (def: AchievementDef, tr: Tr): string => fill(tr(`${stem(def)}.text`), values(def, tr));

/** A row of the window: the title (or "???" while a hidden one is locked), its text and its reward. */
export function achievementLine(def: AchievementDef, unlocked: string | undefined, tr: Tr): { title: string; text: string; done: boolean } {
  const done = unlocked !== undefined;
  if (def.hidden && !done) return { title: tr('achievement.hidden'), text: tr('achievement.hidden.text'), done };
  const reward = def.reward > 0 ? ` ${tr('achievement.reward').replace('{coins}', coinText(def.reward, tr))}` : '';
  return { title: achievementTitle(def, tr), text: achievementText(def, tr) + reward, done };
}

const TOAST_MS = 4500;
/** Toast lines shown at once; the rest are summed up in one more line. */
const TOAST_LINES = 3;

/**
 * The unlock toast: a small window at the top of the page (over any screen,
 * like the install banner) naming the new achievements, gone after a few
 * seconds or a tap. Nothing when the list is empty.
 */
export function achievementToast(defs: readonly AchievementDef[], tr: Tr = (key) => t(key)): void {
  if (defs.length === 0 || typeof document === 'undefined') return;
  const shown = defs.slice(0, TOAST_LINES).map((d) => h('p', { textContent: `★ ${achievementTitle(d, tr)}` }));
  const more = defs.length > TOAST_LINES ? [h('p', { className: 'dim', textContent: tr('achievement.toast.more').replace('{n}', String(defs.length - TOAST_LINES)) })] : [];
  const coins = defs.reduce((sum, d) => sum + d.reward, 0);
  const paid = coins > 0 ? [h('p', { className: 'dim', textContent: tr('achievement.reward').replace('{coins}', coinText(coins, tr)) })] : [];
  const toast = h('div', { className: 'achievement-toast' }, [mdWindow({ title: tr('achievement.toast.title') }, [...shown, ...more, ...paid])]);
  const close = () => toast.remove();
  toast.addEventListener('click', close);
  document.body.append(toast);
  setTimeout(close, TOAST_MS);
}

export interface AchievementsOptions {
  store: KeyValueStore;
  onBack(): void;
}

/** The achievements window: one row per family (unlocked / total); the cursor's family is listed beside it. */
export function achievementsWindow(options: AchievementsOptions): { element: HTMLElement; dispose(): void } {
  const unlocked = loadSave(options.store).achievements ?? {};
  const progress = familyProgress(unlocked);
  const total = progress.reduce((sum, p) => sum + p.done, 0);
  const detail = h('div', { className: 'shop-effect achievement-list' });

  const describe = (index: number) => {
    const family = ACHIEVEMENT_FAMILIES[index];
    if (!family) return detail.replaceChildren(h('p', { className: 'dim', textContent: t('achievement.pick') }));
    detail.replaceChildren(
      ...ACHIEVEMENTS.filter((d) => d.family === family).map((d) => {
        const line = achievementLine(d, unlocked[d.id], (key) => t(key));
        return h('div', { className: line.done ? 'achievement is-done' : 'achievement' }, [
          h('p', { textContent: `${line.done ? '★' : '·'} ${line.title}` }),
          h('p', { className: 'dim', textContent: line.text }),
        ]);
      }),
    );
  };

  const list = cursorList({
    items: [
      ...progress.map((p) => ({ label: t(`achievement.family.${p.family}`), value: `${p.done}/${p.total}`, tapToSelect: true, onConfirm: () => undefined })),
      { label: t('menu.back'), onConfirm: options.onBack },
    ],
    onBack: options.onBack,
    onCursor: describe,
    label: t('achievement.title'),
    className: 'shop-list',
  });
  describe(list.index());
  const element = mdWindow({ title: t('achievement.title'), className: 'shop achievements' }, [
    h('p', { textContent: t('achievement.intro') }),
    h('div', { className: 'shop-balance' }, [statLine(t('achievement.total'), `${total}/${ACHIEVEMENTS.length}`)]),
    list.element,
    detail,
  ]);
  return { element, dispose: () => list.dispose() };
}
