import { describe, expect, it } from 'vitest';
import { BOARD_VIEW_KEYS, boardCards, cardAction, missionIcon, requesterKey, slotCards } from '../../src/app/board-view';
import { utcDateKey } from '../../src/core/endless';
import { abandonMission, dailyMissions, EMPTY_MISSIONS, weeklyMission, type Mission, type MissionState } from '../../src/core/missions';
import { MISSIONS, type MissionKind } from '../../src/data/missions';
import { catalog, LANGUAGES } from '../../src/i18n';
import { PIXEL_ICONS } from '../../src/ui/pixel-icons';

/** The mission board as stone notices (owner, 2026-11-04: "rediseña el tablón"). */
const DAY = 86_400_000;
const days = Array.from({ length: 120 }, (_, i) => utcDateKey(Date.UTC(2026, 0, 1) + i * DAY));
const boards = days.map((d) => [...dailyMissions(d), weeklyMission(d)]);
const kinds = Object.keys(MISSIONS.kindWeights) as MissionKind[];
const tr = (key: string) => catalog('es')[key] ?? key;

describe('mission board cards', () => {
  it('has a pixel icon, a requester and a full card for every mission kind on the boards', () => {
    const seen = new Set<string>();
    for (const board of boards) {
      for (const card of boardCards(board, EMPTY_MISSIONS, tr)) {
        seen.add(card.kind);
        expect(PIXEL_ICONS[card.icon], card.id).toBeDefined();
        expect(card.title, card.id).toBeTruthy();
        expect(card.requester).toBe(tr(requesterKey(card.kind)));
        expect(`${card.title}${card.requester}${card.text}`, card.id).not.toMatch(/[{}]|(^|\s)(mission|species|type)\./);
        expect(card.status).toBe('open');
        expect(card.weekly).toBe(card.id.startsWith('w:'));
        expect(card.coins).toBeGreaterThan(0);
      }
    }
    for (const kind of kinds) expect(seen.has(kind), kind).toBe(true);
    for (const kind of kinds) expect(PIXEL_ICONS[missionIcon(kind)], kind).toBeDefined();
  });

  it('shows real progress and stands out only the missions ready to cash in', () => {
    const board = boards[0]!;
    const [a, b, c] = board as [Mission, Mission, Mission];
    const state: MissionState = { accepted: [{ id: a.id, progress: a.target }, { id: b.id, progress: 0 }], claimed: [c.id] };
    const cards = boardCards(board, state, tr);
    expect(cards.filter((x) => x.ready).map((x) => x.id)).toEqual([a.id]);
    expect(cards[0]).toMatchObject({ status: 'done', share: 1 });
    expect(cards[1]).toMatchObject({ status: 'accepted', share: 0 });
    expect(cards[2]!.status).toBe('claimed');
  });

  it('always shows the accepted slots, filled in order and empty after', () => {
    const board = boards[1]!;
    const state: MissionState = { accepted: [{ id: board[2]!.id, progress: 1 }], claimed: [] };
    const slots = slotCards(board, state, tr);
    expect(slots).toHaveLength(MISSIONS.maxAccepted);
    expect(slots[0]!.id).toBe(board[2]!.id);
    expect(slots.slice(1)).toEqual([null, null]);
  });

  it('picks one action per card: accept, claim, abandon, or none when full or claimed', () => {
    expect(cardAction('open', false)).toBe('accept');
    expect(cardAction('open', true)).toBe('full');
    expect(cardAction('accepted', true)).toBe('abandon');
    expect(cardAction('done', true)).toBe('claim');
    expect(cardAction('claimed', false)).toBe('none');
  });

  it('abandons an accepted mission without paying it or marking it claimed', () => {
    const [m] = boards[2]!;
    const state: MissionState = { accepted: [{ id: m!.id, progress: 2 }], claimed: [] };
    expect(abandonMission(state, m!.id)).toEqual({ accepted: [], claimed: [] });
    expect(abandonMission(state, 'nope')).toBeNull();
    expect(abandonMission({ accepted: [], claimed: [m!.id] }, m!.id)).toBeNull();
  });

  it('every key it uses is in both languages', () => {
    for (const language of LANGUAGES) for (const key of [...BOARD_VIEW_KEYS, ...kinds.map((k) => requesterKey(k))]) expect(catalog(language)[key], `${language} ${key}`).toBeTruthy();
  });
});
