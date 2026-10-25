import { MOVES, type MoveId } from '../data/moves';
import { M0_SLOT_LAYOUT } from '../data/slots';
import { SPECIES } from '../data/species';
import { SPRITE_KEYS, SPRITES } from '../data/sprites';
import type { PokemonType } from '../data/types';
import { sheetKey, type SheetStore } from '../adapters/assets';
import { frameAtTime } from '../adapters/sprite-anim';
import { t } from '../i18n';
import { cursorList, type ListItem } from '../ui/cursor-list';
import { h, mdWindow } from '../ui/window';
import { slotOptions } from './settings';

/**
 * The loadout picker before a solo run: Mimikyu (its idle animation from the
 * sprite sheets), its types and Disguise, and one move card per option of
 * each slot (type, power, short description). The cursor picks a move for
 * its slot; Start begins the run.
 */
export interface LoadoutOptions {
  loadout: readonly (MoveId | null)[];
  sheets: Promise<SheetStore>;
  onChange(loadout: (MoveId | null)[]): void;
  onStart(): void;
  onBack(): void;
}

const SCALE = 3;

export function typeBadge(type: PokemonType): HTMLElement {
  return h('span', { className: `type-badge type-${type}`, textContent: t(`type.${type}`) });
}

/** Mimikyu's idle animation on a small canvas, scaled by a whole number. */
function portrait(sheets: Promise<SheetStore>): HTMLCanvasElement {
  const key = SPRITE_KEYS[SPECIES.mimikyu.sprite];
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

export function loadoutScreen(options: LoadoutOptions): HTMLElement[] {
  let loadout = [...options.loadout];
  const species = SPECIES.mimikyu;

  const items = (): ListItem[] => {
    const out: ListItem[] = [];
    M0_SLOT_LAYOUT.forEach((kind, slot) => {
      out.push({ header: true, label: t(`slot.${kind}`) });
      for (const id of slotOptions(kind)) {
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

  const info = mdWindow({ title: t(`species.${species.id}`), className: 'species' }, [
    h('div', { className: 'portrait-frame' }, [portrait(options.sheets)]),
    h('div', { className: 'type-row' }, species.types.map(typeBadge)),
    h('p', { className: 'ability', textContent: t('loadout.ability') }),
    h('p', {}, [h('strong', { textContent: t('passive.disguise') }), ` · ${t('passive.disguise.description')}`]),
    h('p', { className: 'goal', textContent: t('menu.goal') }),
  ]);
  return [h('h1', { className: 'screen-title', textContent: t('loadout.title') }), h('div', { className: 'screen-row' }, [info, mdWindow({ title: t('loadout.moves'), className: 'moves' }, [list.element])])];
}
