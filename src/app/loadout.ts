import type { MoveId } from '../data/moves';
import { SPECIES, STARTER_SPECIES, type SpeciesId } from '../data/species';
import { lookKey, SPRITE_KEYS, SPRITES } from '../data/sprites';
import { hasFemaleArt } from '../core/gender';
import type { PokemonType } from '../data/types';
import { sheetKey, type SheetStore } from '../adapters/assets';
import { frameAtTime } from '../adapters/sprite-anim';
import { t } from '../i18n';
import type { ListItem } from '../ui/cursor-list';
import { DIFFICULTIES, stepDifficulty, type Difficulty } from '../data/difficulty';
import { h } from '../ui/window';
import { loadoutMovesView } from './loadout-moves-view';
import { speciesPicker } from './species-picker';

/**
 * The loadout picker before a run, in two steps. `species`: a cursor list of
 * the playable species; the info window shows the one under the cursor (its
 * idle animation from the sprite sheets, its types and its passive), and
 * confirming picks it. `moves`: the four equip slots as tiles, a grid of the
 * moves each slot can take and a sheet with a live preview (app/loadout-moves-view.ts);
 * picking a move equips it in the open slot and Start begins the run. Back goes from moves to species.
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
  difficulty?: { value: Difficulty; onChange(next: Difficulty): void; /** Tiers this run may pick (a Senda opens them chapter by chapter); absent = all. */ allowed?(d: Difficulty): boolean };
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
/** The next tier `delta` away that `allowed` lets through, or `value` itself if there is none. */
function nextTier(value: Difficulty, delta: -1 | 1, wrap: boolean, allowed: (d: Difficulty) => boolean): Difficulty {
  let at = value;
  for (let i = 0; i < DIFFICULTIES.length; i++) {
    const next = stepDifficulty(at, delta, wrap);
    if (next === at) return value;
    if (allowed(next)) return next;
    at = next;
  }
  return value;
}

export function difficultyRow(value: Difficulty, onChange: (next: Difficulty) => void, allowed: (d: Difficulty) => boolean = () => true): ListItem {
  return {
    label: t('difficulty.label'),
    value: t(`difficulty.${value}`),
    className: `difficulty-row tier-${value}`,
    onAdjust: (delta) => onChange(nextTier(value, delta, false, allowed)),
    onConfirm: () => onChange(nextTier(value, 1, true, allowed)),
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

/** The species step: the picker grid and its sheet (src/app/species-picker.ts). */
function speciesStep(options: LoadoutOptions): HTMLElement[] {
  return speciesPicker({
    roster: options.roster ?? STARTER_SPECIES,
    current: options.species,
    sheets: options.sheets,
    portrait: (sheets, id, scale) => portrait(sheets, id, scale, options.skin?.worn(id) ?? false, options.gender?.female(id) ?? false),
    typeBadge,
    shiny: (id) => options.skin?.worn(id) ?? false,
    ...(options.context ? { context: options.context } : {}),
    onPick: options.onSpecies,
    onBack: options.onBack,
  });
}

function movesStep(options: LoadoutOptions): HTMLElement[] {
  const species = SPECIES[options.species];
  const { skin, gender, difficulty } = options;
  const worn = () => skin?.worn(species.id) ?? false;
  const female = () => gender?.female(species.id) ?? false;
  return [
    loadoutMovesView({
      species: species.id,
      loadout: options.loadout,
      sheets: options.sheets,
      title: t('loadout.title').replace('{name}', t(`species.${species.id}`)),
      portrait: (scale) => portrait(options.sheets, species.id, scale, worn(), female()),
      typeBadge,
      onChange: options.onChange,
      onStart: options.onStart,
      onBack: options.onBack,
      ...(options.known ? { known: options.known } : {}),
      ...(options.ranks ? { ranks: options.ranks } : {}),
      ...(options.context ? { context: options.context } : {}),
      ...(options.buildHint ? { buildHint: options.buildHint } : {}),
      ...(options.startLabel ? { startLabel: options.startLabel } : {}),
      ...(difficulty ? { difficulty } : {}),
      ...(skin
        ? {
            skin: {
              unlocked: skin.unlocked(species.id),
              get worn() {
                return worn();
              },
              wear: (on: boolean) => skin.wear(species.id, on),
            },
          }
        : {}),
      ...(gender
        ? {
            gender: {
              get female() {
                return female();
              },
              set: (value: boolean) => gender.set(species.id, value),
            },
          }
        : {}),
    }),
  ];
}

export function loadoutScreen(options: LoadoutOptions): HTMLElement[] {
  return options.stage === 'species' ? speciesStep(options) : movesStep(options);
}
