import type { KeyValueStore } from '../adapters/storage';
import { missionBoard, missionProgressOf, missionStatus, type Mission, type MissionReward, type MissionStatus } from '../core/missions';
import { dungeonById } from '../data/dungeons';
import { MISSIONS } from '../data/missions';
import { t } from '../i18n';
import { cursorList, type ListItem } from '../ui/cursor-list';
import { description, describedMenu } from '../ui/describe';
import { h, mdWindow, statLine } from '../ui/window';
import { achievementToast } from './achievements';
import { coinText } from './coin-lines';
import { acceptAt, claimAt, missionsAt } from './progress';
import { loadSave } from './save';

/**
 * The town notice board's missions (odd/tasks/achievements-missions.md), in
 * the style of the PMD job boards: today's missions and this week's, each
 * row with its state (take it, its progress, claim it). The cursor's mission
 * is told in full beside the list; the board also opens the achievements.
 * Texts are i18n templates filled with the content's own names. `tr` is
 * the i18n lookup.
 */
type Tr = (key: string) => string;

const fill = (text: string, values: Record<string, string>): string => Object.entries(values).reduce((out, [k, v]) => out.split(`{${k}}`).join(v), text);

function values(m: Mission, tr: Tr): Record<string, string> {
  const g = m.goal;
  switch (g.kind) {
    case 'floor':
      return { dungeon: tr(dungeonById(g.dungeon).lore.nameKey), floor: String(g.floor) };
    case 'clear':
      return { dungeon: tr(dungeonById(g.dungeon).lore.nameKey) };
    case 'defeat':
      return { type: tr(`type.${g.type}`), count: String(g.count) };
    case 'species':
      return { species: tr(`species.${g.line}`) };
  }
}

export const missionTitle = (m: Mission, tr: Tr): string => fill(tr(`mission.${m.goal.kind}.title`), values(m, tr));

export const missionText = (m: Mission, tr: Tr): string => fill(tr(`mission.${m.goal.kind}.text`), values(m, tr));

/** "120 P + 1 Esencias de Abra (Normal)". */
export function rewardText(reward: MissionReward, tr: Tr): string {
  const mat = reward.materials;
  const materials = mat ? ` + ${fill(tr('mission.materials'), { n: String(mat.count), species: tr(`species.${mat.line}`), difficulty: tr(`difficulty.${mat.tier}`) })}` : '';
  return coinText(reward.coins, tr) + materials;
}

/** A row's right-hand state: take it, its progress, claim it, or claimed. */
export function statusText(status: MissionStatus, progress: number, target: number, tr: Tr): string {
  if (status === 'accepted') return `${progress}/${target}`;
  return tr(`mission.status.${status}`);
}

export interface BoardOptions {
  store: KeyValueStore;
  /** The clock (UTC ms): the board of its day and week. */
  now(): number;
  play?(sound: 'coin' | 'denied'): void;
  /** Opens the achievements window (in place of the board). */
  onAchievements(): void;
  onBack(): void;
}

export function missionBoardWindow(options: BoardOptions): { element: HTMLElement; dispose(): void } {
  const tr: Tr = (key) => t(key);
  const header = h('div', { className: 'shop-balance' });
  const detail = h('div', { className: 'shop-effect mission-detail' });
  let board = missionBoard(options.now());
  let note = '';

  const state = () => missionsAt(loadSave(options.store), options.now());

  const describe = (index: number) => {
    const m = board[index];
    if (!m) return detail.replaceChildren(h('p', { className: 'dim', textContent: note || tr('mission.reset') }));
    const s = state();
    const status = missionStatus(s, m);
    detail.replaceChildren(
      h('p', { textContent: `${tr(`mission.period.${m.period}`)}: ${missionText(m, tr)}` }),
      h('p', { className: 'dim', textContent: fill(tr('mission.tier'), { difficulty: tr(`difficulty.${m.tier}`) }) }),
      h('p', { className: 'dim', textContent: `${tr('mission.reward')} ${rewardText(m.reward, tr)}` }),
      h('p', { className: 'mission-state', textContent: note || tr(`mission.hint.${status}`).replace('{progress}', `${missionProgressOf(s, m)}/${m.target}`) }),
    );
  };

  const act = (m: Mission) => {
    const now = options.now();
    const status = missionStatus(state(), m);
    note = '';
    if (status === 'open') {
      if (acceptAt(options.store, m.id, now)) options.play?.('coin');
      else {
        options.play?.('denied');
        note = fill(tr('mission.full'), { max: String(MISSIONS.maxAccepted) });
      }
    } else if (status === 'done') {
      const claimed = claimAt(options.store, m.id, now);
      if (claimed) {
        options.play?.('coin');
        note = fill(tr('mission.claimed'), { reward: rewardText(claimed.reward, tr) });
        achievementToast(claimed.unlocked, tr);
      }
    } else options.play?.('denied');
    refresh();
  };

  const items = (): ListItem[] => {
    const s = state();
    return [
      ...board.map((m): ListItem => {
        const status = missionStatus(s, m);
        return {
          label: `${m.period === 'weekly' ? '★ ' : ''}${missionTitle(m, tr)}`,
          value: statusText(status, missionProgressOf(s, m), m.target, tr),
          className: status === 'claimed' ? 'shop-row is-disabled' : 'shop-row',
          // Touch: tap once to read the mission, again to take or claim it.
          tapToSelect: true,
          onConfirm: () => act(m),
        };
      }),
      { label: tr('title.achievements'), onConfirm: options.onAchievements },
      { label: tr('menu.back'), onConfirm: options.onBack },
    ];
  };

  // A note (taken, claimed, no room) stays until the cursor moves to another row.
  let at = -1;
  const onCursor = (index: number) => {
    if (index !== at) note = '';
    at = index;
    describe(index);
  };
  const list = cursorList({ items: items(), onBack: options.onBack, onCursor, label: tr('mission.title'), className: 'shop-list' });
  const desc = description(list, { describe, children: [detail] });

  function refresh(): void {
    board = missionBoard(options.now());
    header.replaceChildren(statLine(tr('mission.accepted'), `${state().accepted.length}/${MISSIONS.maxAccepted}`), statLine(tr('screen.coins.balance'), coinText(loadSave(options.store).coins, tr)));
    list.setItems(items());
    desc.update();
  }

  refresh();
  const element = mdWindow({ title: tr('mission.title'), className: 'shop board' }, [h('p', { textContent: tr('mission.intro') }), header, describedMenu(list.element, desc.element)]);
  return { element, dispose: () => list.dispose() };
}
