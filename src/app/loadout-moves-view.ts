import type { SheetStore } from '../adapters/assets';
import { isTouchUi } from '../adapters/touch-mode';
import { hasFemaleArt } from '../core/gender';
import { DIFFICULTIES, type Difficulty } from '../data/difficulty';
import { MOVES, type MoveId } from '../data/moves';
import type { SpeciesId } from '../data/species';
import type { SlotKind } from '../data/slots';
import { SPECIES } from '../data/species';
import { moveTier } from '../data/tutor';
import { t } from '../i18n';
import { TUTOR_ICONS } from '../ui/icons/tutor-icons';
import { pixelIconSvg, pixelSvgOf } from '../ui/pixel-icons';
import { TYPE_COLORS } from '../ui/tokens';
import { h, mdWindow } from '../ui/window';
import { abilityOf, defaultSlot, equipMove, rankPips, slotTiles, type SlotTile } from './loadout-moves';
import { createMovePreview, type MovePreview } from './move-preview-view';
import { moveInfoLines } from './move-info';
import { hubStep } from './title-hub';
import { tierName } from './tutor';
import '../styles/loadout-moves.css';

/**
 * The loadout's moves step (owner, 2026-11-03: "mejora y adapta la vista de Prepara a"), the pattern of the
 * Pokémon picker and the move tutor: the species' ability on top, the four equip slots as big tiles, a grid of
 * the moves the chosen slot can take beside one sheet for the move in focus (a live preview cast by this Pokémon,
 * three big numbers, what it does, its matchup and one action), and a compact run setup row (tier, shiny, gender,
 * Back and Start). Arrows move across everything, Enter acts, Q E switch slot, Esc goes back. Fixed geometry.
 */

export interface MovesViewOptions {
  species: SpeciesId;
  loadout: readonly (MoveId | null)[];
  known?: readonly MoveId[];
  ranks?: Readonly<Partial<Record<MoveId, number>>>;
  sheets: Promise<SheetStore>;
  title: string;
  context?: string;
  buildHint?: string;
  startLabel?: string;
  difficulty?: { value: Difficulty; onChange(next: Difficulty): void; allowed?(d: Difficulty): boolean };
  skin?: { unlocked: boolean; worn: boolean; wear(on: boolean): void };
  gender?: { female: boolean; set(female: boolean): void };
  portrait(scale: number): HTMLElement;
  typeBadge: (type: (typeof MOVES)[MoveId]['type']) => HTMLElement;
  onChange(loadout: (MoveId | null)[]): void;
  onStart(): void;
  onBack(): void;
}

const icon = (id: string): SVGSVGElement => pixelSvgOf(TUTOR_ICONS[id]!, 'px-icon');
const secs = (ms: number): string => String(Math.round(ms / 100) / 10);
const fill = (key: string, values: Record<string, string | number>): string => Object.entries(values).reduce((text, [k, v]) => text.replaceAll(`{${k}}`, String(v)), t(key));

/** Rank pips: filled for each owned rank. */
const pips = (rank: number): HTMLElement => {
  const { on, total } = rankPips(rank);
  const out = h('span', { className: 'lm-pips' }, Array.from({ length: total }, (_, i) => h('i', { className: i < on ? 'is-on' : '' })));
  out.setAttribute('role', 'img');
  out.setAttribute('aria-label', fill('tutor.pips', { n: on, max: total }));
  return out;
};

const KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };

/** A custom segmented control: one radio button per option (no native select). */
function segmented<T extends string>(label: string, options: { value: T; label: string; enabled: boolean }[], value: T, pick: (v: T) => void, className = ''): { element: HTMLElement; buttons: HTMLButtonElement[] } {
  const buttons = options.map((o) => {
    const b = h('button', { className: `lm-seg${o.value === value ? ' is-on' : ''}${o.enabled ? '' : ' is-off'}`, type: 'button', textContent: o.label });
    b.dataset.value = o.value;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(o.value === value));
    if (!o.enabled) b.setAttribute('aria-disabled', 'true');
    b.addEventListener('click', () => {
      if (o.enabled && o.value !== value) pick(o.value);
    });
    return b;
  });
  const element = h('div', { className: `lm-segmented ${className}`.trim() }, buttons);
  element.setAttribute('role', 'radiogroup');
  element.setAttribute('aria-label', label);
  return { element, buttons };
}

/** A custom on/off switch. */
function toggle(label: string, on: boolean, flip: () => void): HTMLButtonElement {
  const b = h('button', { className: `lm-switch${on ? ' is-on' : ''}`, type: 'button' }, [h('span', { className: 'lm-switch-track' }, [h('i')]), h('span', { className: 'lm-switch-label', textContent: label })]);
  b.setAttribute('role', 'switch');
  b.setAttribute('aria-checked', String(on));
  b.addEventListener('click', flip);
  return b;
}

export function loadoutMovesView(options: MovesViewOptions): HTMLElement {
  const species = SPECIES[options.species];
  let loadout = [...options.loadout];
  let tier = options.difficulty?.value;
  let tiles: SlotTile[] = slotTiles(options.species, loadout, options.known);
  let selected = defaultSlot(tiles);
  let focused: MoveId | null = null;
  let previewKey = '';
  const rankOf = (id: MoveId): number => options.ranks?.[id] ?? 0;
  const slotName = (kind: SlotKind): string => t(`slot.${kind}`);

  // Header: portrait, ability (or "no passive"), the run goal as a separate small line.
  const head = h('div', { className: 'lm-head' });
  const drawHead = (): void => {
    const ability = abilityOf(options.species);
    const name = ability.kind === 'passive' ? t(ability.nameKey) : null;
    const text = ability.kind === 'passive' ? t(ability.descriptionKey) : t(ability.key);
    head.replaceChildren(
      h('span', { className: 'lm-head-art' }, [options.portrait(2)]),
      h('div', { className: 'lm-head-types' }, species.types.map(options.typeBadge)),
      h('div', { className: 'lm-ability' }, [
        h('p', { className: 'lm-ability-label', textContent: t('loadout.ability') }),
        h('p', { className: 'lm-ability-text' }, [...(name ? [h('strong', { textContent: name }), ' · '] : []), text]),
      ]),
      h('p', { className: 'lm-objective', textContent: fill('loadout.objective', { goal: t('menu.goal') }), title: t('menu.goal') }),
    );
  };

  // Slot tiles.
  const slotRow = h('div', { className: 'lm-slots' });
  slotRow.setAttribute('role', 'group');
  slotRow.setAttribute('aria-label', t('loadout.slots'));
  const slotButtons: HTMLButtonElement[] = [];
  const drawSlots = (): void => {
    slotButtons.length = 0;
    slotRow.replaceChildren(
      ...tiles.map((tile) => {
        const move = tile.equipped;
        const b = h('button', { className: `lm-slot${tile.slot === selected ? ' is-on' : ''}${tile.choices.length === 0 ? ' is-none' : ''}`, type: 'button' }, [
          h('span', { className: 'lm-slot-kind' }, [icon(tile.kind), h('span', { textContent: slotName(tile.kind) }), ...(move ? [pips(rankOf(move))] : [])]),
          h('span', { className: 'lm-slot-move', textContent: move ? t(`move.${move}`) : tile.choices.length === 0 ? '-' : t('loadout.slot.empty') }),
        ]);
        if (move) b.style.setProperty('--lm-edge', TYPE_COLORS[MOVES[move].type].core);
        b.dataset.slot = String(tile.slot);
        b.setAttribute('aria-pressed', String(tile.slot === selected));
        b.setAttribute('aria-label', `${slotName(tile.kind)}: ${move ? t(`move.${move}`) : t('loadout.slot.empty')}`);
        if (tile.choices.length === 0) b.setAttribute('aria-disabled', 'true');
        b.addEventListener('click', () => chooseSlot(tile.slot));
        slotButtons.push(b);
        return b;
      }),
    );
  };

  // Grid.
  const grid = h('div', { className: 'lm-grid' });
  grid.setAttribute('aria-label', t('loadout.moves'));
  const cardFor = (id: MoveId, slot: number): HTMLButtonElement => {
    const move = MOVES[id];
    const equipped = tiles[slot]?.equipped === id;
    const tierId = moveTier(id);
    const b = h('button', { className: `lm-card${equipped ? ' is-equipped' : ''}`, type: 'button' }, [
      h('span', { className: 'lm-card-name', textContent: t(`move.${id}`) }),
      h('span', { className: 'lm-card-row' }, [pips(rankOf(id)), ...(tierId === 'basic' ? [] : [h('span', { className: `tier-badge tier-${tierId}`, textContent: tierName(tierId) })]), ...(equipped ? [h('span', { className: 'lm-equipped', textContent: t('loadout.equipped') })] : [])]),
    ]);
    b.style.setProperty('--lm-edge', TYPE_COLORS[move.type].core);
    b.dataset.move = id;
    b.setAttribute('aria-label', `${t(`move.${id}`)}, ${tierName(tierId)}${equipped ? `, ${t('loadout.equipped')}` : ''}`);
    let armed = false;
    b.addEventListener('pointerdown', () => {
      armed = focused === id;
    });
    b.addEventListener('mouseenter', () => showSheet(id));
    b.addEventListener('focus', () => showSheet(id));
    b.addEventListener('click', () => {
      // On touch the first tap shows the move, the second equips it.
      if (isTouchUi() && !armed) {
        showSheet(id);
        return;
      }
      equip(id);
    });
    return b;
  };
  const drawGrid = (): void => {
    const tile = tiles[selected];
    const choices = tile?.choices ?? [];
    grid.replaceChildren(...choices.map((id) => cardFor(id, selected)), ...(choices.length === 0 ? [h('p', { className: 'lm-empty', textContent: t('loadout.noMoves') })] : []));
  };

  // Sheet.
  const preview: MovePreview =createMovePreview({ sheets: options.sheets });
  const sName = h('h2', { className: 'lm-name' });
  const sBadges = h('div', { className: 'lm-badges' });
  const sStats = h('div', { className: 'lm-stats' });
  const sDesc = h('p', { className: 'lm-desc' });
  const sNote = h('p', { className: 'lm-note' });
  const actLabel = h('span');
  const act = h('button', { className: 'lm-act', type: 'button' }, [pixelIconSvg('play', 'px-icon'), actLabel]);
  act.addEventListener('click', () => {
    if (focused) equip(focused);
  });
  const sheet = h('section', { className: 'lm-sheet' }, [preview.element, h('div', { className: 'lm-sheet-head' }, [sName, sBadges]), sStats, sDesc, sNote, act]);
  const stat = (label: string, value: string): HTMLElement => h('div', { className: 'lm-stat' }, [h('span', { className: 'lm-stat-value', textContent: value }), h('span', { className: 'lm-stat-label', textContent: label })]);

  function showSheet(id: MoveId | null): void {
    sheet.classList.toggle('is-empty', id === null);
    if (!id) {
      sName.textContent = t('loadout.noMoves');
      for (const part of [sBadges, sStats, sDesc, sNote]) part.replaceChildren();
      act.hidden = true;
      focused = null;
      return;
    }
    act.hidden = false;
    focused = id;
    const def = MOVES[id];
    const kind = tiles[selected]!.kind;
    sheet.style.setProperty('--lm-edge', TYPE_COLORS[def.type].core);
    const key = `${options.species}:${id}:${rankOf(id)}`;
    if (key !== previewKey) {
      previewKey = key;
      preview.show(options.species, id, rankOf(id));
    }
    sName.textContent = t(`move.${id}`);
    const tierId = moveTier(id);
    sBadges.replaceChildren(options.typeBadge(def.type), h('span', { className: `tier-badge tier-${tierId}`, textContent: tierName(tierId) }), h('span', { className: 'lm-kind' }, [icon(kind), h('span', { textContent: slotName(kind) })]), pips(rankOf(id)));
    sStats.replaceChildren(
      stat(t('loadout.power'), def.power > 0 ? String(def.power) : '-'),
      stat(t('tutor.stat.stamina'), def.staminaCost > 0 ? String(def.staminaCost) : '-'),
      stat(t('tutor.stat.cooldown'), def.cooldownMs ? `${secs(def.cooldownMs)} s` : '-'),
    );
    sDesc.textContent = t(`move.${id}.description`);
    const matchup = moveInfoLines(id)[1];
    sNote.textContent = matchup;
    sNote.title = matchup;
    const equipped = tiles[selected]!.equipped === id;
    actLabel.textContent = equipped ? t('loadout.equipped') : fill('loadout.equipIn', { slot: slotName(kind) });
    act.classList.toggle('is-disabled', equipped);
    act.setAttribute('aria-disabled', String(equipped));
    for (const el of grid.querySelectorAll<HTMLElement>('.lm-card')) el.classList.toggle('is-focused', el.dataset.move === id);
  }

  function equip(id: MoveId): void {
    const tile = tiles[selected]!;
    if (tile.equipped === id) return;
    loadout = equipMove(loadout, selected, id);
    options.onChange(loadout);
    tiles = slotTiles(options.species, loadout, options.known);
    const keep = grid.contains(document.activeElement) ? id : null;
    drawSlots();
    drawGrid();
    showSheet(id);
    if (keep) grid.querySelector<HTMLElement>(`[data-move="${id}"]`)?.focus({ preventScroll: true });
  }

  function chooseSlot(slot: number): void {
    if (tiles[slot]?.choices.length === 0) return;
    selected = slot;
    drawSlots();
    drawGrid();
    const tile = tiles[slot]!;
    showSheet(tile.equipped && tile.choices.includes(tile.equipped) ? tile.equipped : (tile.choices[0] ?? null));
  }

  function stepSlot(delta: -1 | 1): void {
    const open = tiles.filter((x) => x.choices.length > 0).map((x) => x.slot);
    const at = open.indexOf(selected);
    const next = open[(at + delta + open.length) % open.length];
    if (next === undefined) return;
    const hadFocus = slotButtons.includes(document.activeElement as HTMLButtonElement);
    chooseSlot(next);
    if (hadFocus) slotButtons[next]?.focus({ preventScroll: true });
  }

  // Setup row.
  const setup = h('div', { className: 'lm-setup' });
  setup.setAttribute('role', 'group');
  setup.setAttribute('aria-label', t('loadout.setup'));
  const back = h('button', { className: 'lm-back', type: 'button', textContent: t('menu.back') });
  back.addEventListener('click', () => options.onBack());
  const start = h('button', { className: 'lm-start', type: 'button' }, [pixelIconSvg('play', 'px-icon'), h('span', { textContent: options.startLabel ?? t('menu.start') })]);
  start.addEventListener('click', () => options.onStart());
  let setupControls: HTMLButtonElement[] = [];
  const drawSetup = (): void => {
    const controls: HTMLButtonElement[] = [];
    const left = h('div', { className: 'lm-setup-main' });
    if (tier && options.difficulty) {
      const pick = options.difficulty;
      const allowed = pick.allowed ?? (() => true);
      const seg = segmented(
        t('difficulty.label'),
        DIFFICULTIES.map((d) => ({ value: d, label: t(`difficulty.${d}`), enabled: allowed(d) })),
        tier,
        (next) => {
          tier = next;
          pick.onChange(next);
          const had = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.value : undefined;
          drawSetup();
          if (had) setup.querySelector<HTMLElement>(`.lm-segmented[aria-label="${t('difficulty.label')}"] [data-value="${had}"]`)?.focus({ preventScroll: true });
        },
        `tier-${tier}`,
      );
      controls.push(...seg.buttons);
      left.append(h('div', { className: 'lm-field' }, [h('span', { className: 'lm-field-label', textContent: t('difficulty.label') }), seg.element]), h('p', { className: 'lm-hint', textContent: t(`difficulty.${tier}.hint`), title: t(`difficulty.${tier}.hint`) }));
    }
    const extras = h('div', { className: 'lm-extras' });
    if (options.skin?.unlocked) {
      const skin = options.skin;
      const sw = toggle(t('loadout.shiny'), skin.worn, () => {
        skin.wear(!skin.worn);
        redrawLook();
      });
      controls.push(sw);
      extras.append(sw);
    }
    if (options.gender && hasFemaleArt(options.species)) {
      const g = options.gender;
      const seg = segmented(
        t('loadout.gender'),
        [
          { value: 'male', label: t('loadout.gender.male'), enabled: true },
          { value: 'female', label: t('loadout.gender.female'), enabled: true },
        ],
        g.female ? 'female' : 'male',
        (next) => {
          g.set(next === 'female');
          redrawLook();
        },
      );
      controls.push(...seg.buttons);
      extras.append(h('div', { className: 'lm-field' }, [h('span', { className: 'lm-field-label', textContent: t('loadout.gender') }), seg.element]));
    }
    setupControls = controls;
    const build = options.buildHint ? [h('p', { className: 'lm-build', textContent: options.buildHint, title: options.buildHint })] : [];
    setup.replaceChildren(left, h('div', { className: 'lm-setup-side' }, [extras, ...build]), h('div', { className: 'lm-actions' }, [back, start]));
  };

  /** The shiny or gender row changed what the portrait shows: redraw it and the setup row, keeping the focus where it was. */
  function redrawLook(): void {
    const at = setupControls.indexOf(document.activeElement as HTMLButtonElement);
    drawHead();
    drawSetup();
    if (at >= 0) setupControls[at]?.focus({ preventScroll: true });
  }

  const win = mdWindow({ title: options.title, className: 'lm-window' }, [
    ...(options.context ? [h('p', { className: 'dim lm-context', textContent: options.context })] : []),
    head,
    slotRow,
    h('div', { className: 'lm-body' }, [grid, sheet]),
    setup,
    h('p', { className: 'lm-keys', textContent: t('loadout.keys') }),
  ]);

  const onKey = (e: KeyboardEvent): void => {
    if (!win.isConnected) {
      window.removeEventListener('keydown', onKey);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      options.onBack();
      return;
    }
    if (e.code === 'KeyQ' || e.code === 'KeyE') {
      e.preventDefault();
      stepSlot(e.code === 'KeyQ' ? -1 : 1);
      return;
    }
    const dir = KEYS[e.code];
    if (!dir) return;
    e.preventDefault();
    const controls: HTMLElement[] = [...slotButtons.filter((_, i) => tiles[i]!.choices.length > 0), ...grid.querySelectorAll<HTMLButtonElement>('.lm-card'), act, ...setupControls, back, start].filter((el) => !el.hidden);
    const at = controls.indexOf(document.activeElement as HTMLElement);
    if (at < 0) {
      start.focus();
      return;
    }
    const points = controls.map((el, i) => {
      const r = el.getBoundingClientRect();
      return { id: String(i), x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    controls[Number(hubStep(points, String(at), dir))]?.focus();
  };
  window.addEventListener('keydown', onKey);

  drawHead();
  drawSlots();
  drawGrid();
  drawSetup();
  const tile = tiles[selected];
  showSheet(tile?.equipped && tile.choices.includes(tile.equipped) ? tile.equipped : (tile?.choices[0] ?? null));
  // Start on Start: Enter right away plays with the saved loadout.
  queueMicrotask(() => start.focus({ preventScroll: true }));
  return win;
}
