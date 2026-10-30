import { MOVES, type MoveId } from '../data/moves';
import { PLAYER_SLOT_LAYOUT } from '../data/slots';
import { SPECIES, STARTER_SPECIES, type SpeciesId } from '../data/species';
import { lookKey, SPRITE_KEYS, SPRITES } from '../data/sprites';
import { hasFemaleArt } from '../core/gender';
import type { PokemonType } from '../data/types';
import { sheetKey, type SheetStore } from '../adapters/assets';
import { frameAtTime } from '../adapters/sprite-anim';
import { t } from '../i18n';
import { cursorList, type ListItem } from '../ui/cursor-list';
import { stepDifficulty, type Difficulty } from '../data/difficulty';
import { description } from '../ui/describe';
import { h, mdWindow } from '../ui/window';
import { moveInfoLines } from './move-info';
import { slotOptions } from './settings';
import { rankedName, rankStars, slotFilterRow, tierName, type SlotFilter } from './tutor';
import { moveTier } from '../data/tutor';

/**
 * The loadout picker before a run, in two steps. `species`: a cursor list of
 * the playable species; the info window shows the one under the cursor (its
 * idle animation from the sprite sheets, its types and its passive), and
 * confirming picks it. `moves`: one move card per option of each slot of the
 * picked species (type, power, stamina cost, hit shape, short description and
 * matchup against the Crypt, app/move-info.ts); the cursor picks a move
 * for its slot and Start begins the run. Back goes from moves to species.
 */
export interface LoadoutOptions {
  stage: 'species' | 'moves';
  species: SpeciesId;
  /** Who can be picked: the starters and the owned gacha species (core/collection.ts `rosterOf`; absent = the starters). */
  roster?: readonly SpeciesId[];
  loadout: readonly (MoveId | null)[];
  sheets: Promise<SheetStore>;
  onSpecies(species: SpeciesId): void;
  onChange(loadout: (MoveId | null)[]): void;
  onStart(): void;
  onBack(): void;
  /** The tier row above Start (solo): the current pick and where a change goes (settings, persisted). */
  difficulty?: { value: Difficulty; onChange(next: Difficulty): void };
  /** The Start row's label (a run's «Comenzar» when absent; the shrine's «Comenzar el juramento»). */
  startLabel?: string;
  /** A line under the title naming what the loadout is for (the shrine: its boss or gauntlet and tier). */
  context?: string;
  /**
   * The move tutor (app/tutor.ts): only these moves are offered (the original
   * kit and the bought ones), with a slot filter row on top; absent = the
   * whole movepool, no filter.
   */
  known?: readonly MoveId[];
  /** Mejoras per move: the card names show "+" per rank. */
  ranks?: Readonly<Partial<Record<MoveId, number>>>;
  /** The recommended competitive build, shown under the list. */
  buildHint?: string;
  /**
   * Shiny skins (odd/tasks/shiny-echo.md): which lines have theirs and wear
   * it (the portraits show it), and the moves step's on/off row for the
   * picked species' line once unlocked. Absent: no skins.
   */
  skin?: ShinySkins;
  /** The picked gender per line (odd/tasks/pokemon-gender.md): the portraits show it, and the moves step's row changes it. Absent: all male, no row. */
  gender?: LineGender;
}

/** The player's shiny skins, per line (any form of the line answers for it). */
export interface ShinySkins {
  unlocked(species: SpeciesId): boolean;
  worn(species: SpeciesId): boolean;
  /** Puts the line's skin on or off (persisted by the caller). */
  wear(species: SpeciesId, on: boolean): void;
}

/** The gender picked per line (any form of the line answers for it). */
export interface LineGender {
  female(species: SpeciesId): boolean;
  /** Picks the line's gender (persisted by the caller). */
  set(species: SpeciesId, female: boolean): void;
}

/** The moves step's gender row: only a species with female art has one (a confirm or ◀ ▶ flips it, then `redraw`). */
export function genderRow(species: SpeciesId, gender: LineGender, redraw: () => void): ListItem | null {
  if (!hasFemaleArt(species)) return null;
  const flip = () => {
    gender.set(species, !gender.female(species));
    redraw();
  };
  return { label: t('loadout.gender'), value: t(gender.female(species) ? 'loadout.gender.female' : 'loadout.gender.male'), className: 'gender-row', onAdjust: flip, onConfirm: flip };
}

/** The tier row of a menu: ◀ ▶ step through the tiers, a confirm cycles; `hint` shows what the tier does. */
export function difficultyRow(value: Difficulty, onChange: (next: Difficulty) => void): ListItem {
  return {
    label: t('difficulty.label'),
    value: t(`difficulty.${value}`),
    className: `difficulty-row tier-${value}`,
    onAdjust: (delta) => onChange(stepDifficulty(value, delta)),
    onConfirm: () => onChange(stepDifficulty(value, 1, true)),
  };
}

const SCALE = 3;

export function typeBadge(type: PokemonType): HTMLElement {
  return h('span', { className: `type-badge type-${type}`, textContent: t(`type.${type}`) });
}

/** A species' idle animation on a small canvas, scaled by a whole number; its shiny sheet with `shiny`, its female with `female`. */
export function portrait(sheets: Promise<SheetStore>, species: SpeciesId, scale = SCALE, shiny = false, female = false): HTMLCanvasElement {
  const key = lookKey(SPRITE_KEYS[SPECIES[species].sprite], shiny, female);
  const meta = SPRITES.sprites[key]?.anims.Idle;
  const canvas = h('canvas', { className: 'portrait' });
  canvas.width = meta?.frameWidth ?? 32;
  canvas.height = meta?.frameHeight ?? 48;
  canvas.style.width = `${canvas.width * scale}px`;
  canvas.style.height = `${canvas.height * scale}px`;
  void sheets.then((store) => {
    const image = meta && store.get(sheetKey(key, meta.file));
    const ctx = canvas.getContext('2d');
    if (!meta || !image || !ctx) return;
    const start = performance.now();
    const frame = (now: number) => {
      if (!canvas.isConnected) return;
      const f = frameAtTime(meta.durations, now - start, true);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, f * meta.frameWidth, 0, meta.frameWidth, meta.frameHeight, 0, 0, meta.frameWidth, meta.frameHeight);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  return canvas;
}

/** Portrait, types and passive of a species (the info window's content). */
function speciesInfo(sheets: Promise<SheetStore>, id: SpeciesId, shiny = false, female = false): HTMLElement[] {
  const species = SPECIES[id];
  const passive = species.passive;
  const out: HTMLElement[] = [
    h('div', { className: `portrait-frame${shiny ? ' is-shiny' : ''}` }, [portrait(sheets, id, SCALE, shiny, female)]),
    h('div', { className: 'type-row' }, species.types.map(typeBadge)),
    h('p', { className: 'ability', textContent: t('loadout.ability') }),
  ];
  if (passive) out.push(h('p', {}, [h('strong', { textContent: t(`passive.${passive}`) }), ` · ${t(`passive.${passive}.description`)}`]));
  out.push(h('p', { className: 'goal', textContent: t('menu.goal') }));
  return out;
}

function moveCard(id: MoveId, equipped: boolean, rank = 0): HTMLElement {
  const move = MOVES[id];
  const [stats, matchup] = moveInfoLines(id);
  return h('div', { className: 'move-card' }, [
    h('div', { className: 'move-head' }, [
      h('strong', { textContent: rankedName(id, rank) }),
      // The tutor's rank stars and the power tier (the original kit has no badge).
      rank > 0 ? h('span', { className: 'rank-stars', textContent: rankStars(rank) }) : null,
      moveTier(id) === 'basic' ? null : h('span', { className: `tier-badge tier-${moveTier(id)}`, textContent: tierName(moveTier(id)) }),
      typeBadge(move.type),
      equipped ? h('span', { className: 'equipped', textContent: t('loadout.equipped') }) : null,
    ]),
    // A boost deals no damage: no power line, just its stats.
    h('div', { className: 'move-desc' }, move.power > 0 ? [h('span', { className: 'move-power', textContent: `${t('loadout.power')} ${move.power}` }), ` · ${stats}`] : [stats]),
    h('div', { className: 'move-desc' }, [t(`move.${id}.description`)]),
    h('div', { className: 'move-desc move-matchup' }, [matchup]),
  ]);
}

function speciesRow(id: SpeciesId, picked: boolean): HTMLElement {
  return h('div', { className: 'move-card' }, [
    h('div', { className: 'move-head' }, [
      h('strong', { textContent: t(`species.${id}`) }),
      ...SPECIES[id].types.map(typeBadge),
      picked ? h('span', { className: 'equipped', textContent: t('loadout.picked') }) : null,
    ]),
  ]);
}

const contextLine = (options: LoadoutOptions): HTMLElement[] => (options.context ? [h('p', { className: 'dim shrine-loadout-for', textContent: options.context })] : []);

function speciesStep(options: LoadoutOptions): HTMLElement[] {
  const worn = (id: SpeciesId) => options.skin?.worn(id) ?? false;
  const female = (id: SpeciesId) => options.gender?.female(id) ?? false;
  const roster = options.roster ?? STARTER_SPECIES;
  const items: ListItem[] = [
    ...roster.map((id) => ({
      label: speciesRow(id, id === options.species),
      className: id === options.species ? 'move-row is-equipped' : 'move-row',
      onConfirm: () => options.onSpecies(id),
    })),
    { label: t('menu.back'), onConfirm: options.onBack },
  ];
  const list = cursorList({
    items,
    initial: Math.max(0, roster.indexOf(options.species)),
    onBack: options.onBack,
    onCursor: (index) => preview(index),
    label: t('loadout.pick'),
  });
  // The info window keeps the size of the largest species card (src/ui/describe.ts): the list beside it never moves.
  let info: HTMLElement | null = null;
  /** Shows the species under the cursor in the info window. */
  function preview(index: number): void {
    const id = roster[index];
    if (!id) return;
    const title = info?.querySelector('.md-window-title');
    if (title) title.textContent = t(`species.${id}`);
    desc.live.replaceChildren(...speciesInfo(options.sheets, id, worn(id), female(id)));
  }
  const desc = description(list, { describe: preview, children: speciesInfo(options.sheets, options.species, worn(options.species), female(options.species)) });
  info = mdWindow({ title: t(`species.${options.species}`), className: 'species' }, [desc.element]);
  desc.update();
  return [
    h('h1', { className: 'screen-title', textContent: t('loadout.pick') }),
    ...contextLine(options),
    h('div', { className: 'screen-row' }, [info, mdWindow({ title: t('loadout.species'), className: 'moves' }, [list.element])]),
  ];
}

function movesStep(options: LoadoutOptions): HTMLElement[] {
  let loadout = [...options.loadout];
  let tier = options.difficulty?.value;
  const hint = h('p', { className: 'dim difficulty-hint', textContent: tier ? t(`difficulty.${tier}.hint`) : '' });
  const species = SPECIES[options.species];
  let filter: SlotFilter = 'all';

  const items = (): ListItem[] => {
    const out: ListItem[] = [];
    // With the tutor's moves: a ◀ ▶ filter to one slot kind (the lists grow long).
    if (options.known)
      out.push(
        slotFilterRow(filter, (next) => {
          filter = next;
          list.setItems(items());
        }),
      );
    PLAYER_SLOT_LAYOUT.forEach((kind, slot) => {
      if (filter !== 'all' && filter !== kind) return;
      // A slot the species has no move for (boost or area) is left out and stays empty.
      const choices = slotOptions(kind, species.id, options.known);
      if (choices.length === 0) return;
      out.push({ header: true, label: t(`slot.${kind}`) });
      for (const id of choices) {
        const equipped = loadout[slot] === id;
        out.push({
          label: moveCard(id, equipped, options.ranks?.[id] ?? 0),
          className: equipped ? 'move-row is-equipped' : 'move-row',
          onConfirm: () => {
            loadout = loadout.map((m, i) => (i === slot ? id : m));
            options.onChange(loadout);
            list.setItems(items());
          },
        });
      }
    });
    // The line's shiny skin, once unlocked: on or off (a confirm or ◀ ▶ flips it).
    const skin = options.skin;
    if (skin?.unlocked(species.id)) {
      const flip = () => {
        skin.wear(species.id, !skin.worn(species.id));
        showInfo();
        list.setItems(items());
      };
      out.push({ label: t('loadout.shiny'), value: t(skin.worn(species.id) ? 'menu.on' : 'menu.off'), className: 'shiny-row', onAdjust: flip, onConfirm: flip });
    }
    // The line's gender, where there is female art.
    const gender = options.gender && genderRow(species.id, options.gender, () => {
      showInfo();
      list.setItems(items());
    });
    if (gender) out.push(gender);
    if (tier && options.difficulty) {
      const pick = options.difficulty;
      out.push(
        difficultyRow(tier, (next) => {
          tier = next;
          pick.onChange(next);
          hint.textContent = t(`difficulty.${next}.hint`);
          list.setItems(items());
        }),
      );
    }
    out.push({ label: options.startLabel ?? t('menu.start'), className: 'start-row', onConfirm: options.onStart });
    out.push({ label: t('menu.back'), onConfirm: options.onBack });
    return out;
  };
  // Start on the Start row: Enter right away plays with the saved loadout.
  const first = items();
  const list = cursorList({ items: first, initial: first.length - 2, onBack: options.onBack, label: t('loadout.moves') });

  const info = mdWindow({ title: t(`species.${species.id}`), className: 'species' }, speciesInfo(options.sheets, species.id, options.skin?.worn(species.id) ?? false, options.gender?.female(species.id) ?? false));
  /** Redraws the info window (the skin changed). */
  function showInfo(): void {
    const title = info.querySelector('.md-window-title');
    for (const child of [...info.children]) if (child !== title) child.remove();
    info.append(...speciesInfo(options.sheets, species.id, options.skin?.worn(species.id) ?? false, options.gender?.female(species.id) ?? false));
  }
  const title = t('loadout.title').replace('{name}', t(`species.${species.id}`));
  return [h('h1', { className: 'screen-title', textContent: title }), ...contextLine(options), h('div', { className: 'screen-row' }, [info, mdWindow({ title: t('loadout.moves'), className: 'moves' }, [list.element, ...(tier ? [hint] : []), ...(options.buildHint ? [h('p', { className: 'dim loadout-build', textContent: options.buildHint })] : [])])])];
}

export function loadoutScreen(options: LoadoutOptions): HTMLElement[] {
  return options.stage === 'species' ? speciesStep(options) : movesStep(options);
}
