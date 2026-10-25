import { MOVES, type MoveId } from '../data/moves';
import { M0_SLOT_LAYOUT } from '../data/slots';
import { PLAYABLE_SPECIES, SPECIES, type SpeciesId } from '../data/species';
import { SPRITE_KEYS, SPRITES } from '../data/sprites';
import type { PokemonType } from '../data/types';
import { sheetKey, type SheetStore } from '../adapters/assets';
import { frameAtTime } from '../adapters/sprite-anim';
import { t } from '../i18n';
import { cursorList, type ListItem } from '../ui/cursor-list';
import { h, mdWindow } from '../ui/window';
import { slotOptions } from './settings';

/**
 * The loadout picker before a run, in two steps. `species`: a cursor list of
 * the playable species; the info window shows the one under the cursor (its
 * idle animation from the sprite sheets, its types and its passive), and
 * confirming picks it. `moves`: one move card per option of each slot of the
 * picked species (type, power, short description); the cursor picks a move
 * for its slot and Start begins the run. Back goes from moves to species.
 */
export interface LoadoutOptions {
  stage: 'species' | 'moves';
  species: SpeciesId;
  loadout: readonly (MoveId | null)[];
  sheets: Promise<SheetStore>;
  onSpecies(species: SpeciesId): void;
  onChange(loadout: (MoveId | null)[]): void;
  onStart(): void;
  onBack(): void;
}

const SCALE = 3;

export function typeBadge(type: PokemonType): HTMLElement {
  return h('span', { className: `type-badge type-${type}`, textContent: t(`type.${type}`) });
}

/** A species' idle animation on a small canvas, scaled by a whole number. */
function portrait(sheets: Promise<SheetStore>, species: SpeciesId): HTMLCanvasElement {
  const key = SPRITE_KEYS[SPECIES[species].sprite];
  const meta = SPRITES.sprites[key]?.anims.Idle;
  const canvas = h('canvas', { className: 'portrait' });
  canvas.width = meta?.frameWidth ?? 32;
  canvas.height = meta?.frameHeight ?? 48;
  canvas.style.width = `${canvas.width * SCALE}px`;
  canvas.style.height = `${canvas.height * SCALE}px`;
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
function speciesInfo(sheets: Promise<SheetStore>, id: SpeciesId): HTMLElement[] {
  const species = SPECIES[id];
  const passive = species.passive;
  const out: HTMLElement[] = [
    h('div', { className: 'portrait-frame' }, [portrait(sheets, id)]),
    h('div', { className: 'type-row' }, species.types.map(typeBadge)),
    h('p', { className: 'ability', textContent: t('loadout.ability') }),
  ];
  if (passive) out.push(h('p', {}, [h('strong', { textContent: t(`passive.${passive}`) }), ` · ${t(`passive.${passive}.description`)}`]));
  out.push(h('p', { className: 'goal', textContent: t('menu.goal') }));
  return out;
}

function moveCard(id: MoveId, equipped: boolean): HTMLElement {
  const move = MOVES[id];
  return h('div', { className: 'move-card' }, [
    h('div', { className: 'move-head' }, [
      h('strong', { textContent: t(`move.${id}`) }),
      typeBadge(move.type),
      equipped ? h('span', { className: 'equipped', textContent: t('loadout.equipped') }) : null,
    ]),
    h('div', { className: 'move-desc' }, [h('span', { className: 'move-power', textContent: `${t('loadout.power')} ${move.power}` }), ` · ${t(`move.${id}.description`)}`]),
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

function speciesStep(options: LoadoutOptions): HTMLElement[] {
  const info = mdWindow({ title: t(`species.${options.species}`), className: 'species' }, speciesInfo(options.sheets, options.species));
  /** Shows the species under the cursor in the info window. */
  const preview = (id: SpeciesId) => {
    const title = info.querySelector('.md-window-title');
    if (title) title.textContent = t(`species.${id}`);
    for (const child of [...info.children]) if (child !== title) child.remove();
    info.append(...speciesInfo(options.sheets, id));
  };
  const items: ListItem[] = [
    ...PLAYABLE_SPECIES.map((id) => ({
      label: speciesRow(id, id === options.species),
      className: id === options.species ? 'move-row is-equipped' : 'move-row',
      onConfirm: () => options.onSpecies(id),
    })),
    { label: t('menu.back'), onConfirm: options.onBack },
  ];
  const list = cursorList({
    items,
    initial: Math.max(0, PLAYABLE_SPECIES.indexOf(options.species)),
    onBack: options.onBack,
    onCursor: (index) => {
      const id = PLAYABLE_SPECIES[index];
      if (id) preview(id);
    },
    label: t('loadout.pick'),
  });
  return [
    h('h1', { className: 'screen-title', textContent: t('loadout.pick') }),
    h('div', { className: 'screen-row' }, [info, mdWindow({ title: t('loadout.species'), className: 'moves' }, [list.element])]),
  ];
}

function movesStep(options: LoadoutOptions): HTMLElement[] {
  let loadout = [...options.loadout];
  const species = SPECIES[options.species];

  const items = (): ListItem[] => {
    const out: ListItem[] = [];
    M0_SLOT_LAYOUT.forEach((kind, slot) => {
      out.push({ header: true, label: t(`slot.${kind}`) });
      for (const id of slotOptions(kind, species.id)) {
        const equipped = loadout[slot] === id;
        out.push({
          label: moveCard(id, equipped),
          className: equipped ? 'move-row is-equipped' : 'move-row',
          onConfirm: () => {
            loadout = loadout.map((m, i) => (i === slot ? id : m));
            options.onChange(loadout);
            list.setItems(items());
          },
        });
      }
    });
    out.push({ label: t('menu.start'), className: 'start-row', onConfirm: options.onStart });
    out.push({ label: t('menu.back'), onConfirm: options.onBack });
    return out;
  };
  // Start on the Start row: Enter right away plays with the saved loadout.
  const first = items();
  const list = cursorList({ items: first, initial: first.length - 2, onBack: options.onBack, label: t('loadout.moves') });

  const info = mdWindow({ title: t(`species.${species.id}`), className: 'species' }, speciesInfo(options.sheets, species.id));
  const title = t('loadout.title').replace('{name}', t(`species.${species.id}`));
  return [h('h1', { className: 'screen-title', textContent: title }), h('div', { className: 'screen-row' }, [info, mdWindow({ title: t('loadout.moves'), className: 'moves' }, [list.element])])];
}

export function loadoutScreen(options: LoadoutOptions): HTMLElement[] {
  return options.stage === 'species' ? speciesStep(options) : movesStep(options);
}
