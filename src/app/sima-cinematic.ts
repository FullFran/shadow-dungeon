import type { KeyValueStore } from '../adapters/storage';
import type { SimaPanel } from '../adapters/sima-scenes';
import type { Shot } from '../data/prologue';
import { SIMA_SCENES, simaSceneKey, type SimaSceneId } from '../data/sima-scenes';
import type { SpeciesId } from '../data/species';
import { beatMs } from './story';

/**
 * The Sima's cinematics in the app (data/sima-scenes.ts): their panels for
 * the prologue player, and which ones this device has seen. Each plays once
 * per device, like the prologue and the guardians' cinematics: the flags live
 * under their own storage key, apart from the save (they are not progress and
 * never travel with the economy or the cloud profile; a new device tells the
 * story again). No DOM here.
 */
const KEY = 'mazmorra-sombria.simaScenes';

function seenSet(store: KeyValueStore): Set<string> {
  try {
    const raw = JSON.parse(store.get(KEY) ?? '[]') as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Every Sima scene id seen on this device (`plea` included). */
export const simaScenesSeen = (store: KeyValueStore): ReadonlySet<string> => seenSet(store);

export const hasSeenSimaScene = (store: KeyValueStore, id: SimaSceneId | 'plea'): boolean => seenSet(store).has(id);

/**
 * Whether the villagers' pleas still have to play on this device: true for
 * every profile without the flag, older saves included (the flag is new, so a
 * player who cleared everything before the pleas existed is still due).
 */
export const simaPleaDue = (store: KeyValueStore): boolean => !hasSeenSimaScene(store, 'plea');

export function markSimaSceneSeen(store: KeyValueStore, id: SimaSceneId | 'plea'): void {
  const seen = seenSet(store);
  if (seen.has(id)) return;
  seen.add(id);
  store.set(KEY, JSON.stringify([...seen]));
}

const SLOW = { textStartMs: 900, charsPerSecond: 26, lineGapMs: 600 } as const;
const CAMERAS: readonly { from: Shot; to: Shot }[] = [
  { from: { x: 0.5, y: 0.48, zoom: 1.05 }, to: { x: 0.5, y: 0.52, zoom: 1.14 } },
  { from: { x: 0.5, y: 0.5, zoom: 1 }, to: { x: 0.5, y: 0.56, zoom: 1.08 } },
  { from: { x: 0.47, y: 0.52, zoom: 1.1 }, to: { x: 0.53, y: 0.52, zoom: 1.1 } },
];

/** What the scene needs from the run: the player's Pokémon, the floor reached, somebody's shadow (its sheet, known or not). */
export interface SimaSceneInfo {
  species: SpeciesId;
  floor?: number;
  other?: { sprite: string; known: boolean };
}

/** A scene's panels; `text` reads a key with `{floor}` filled in (beats last as long as their line needs). */
export function simaPanels(id: SimaSceneId, info: SimaSceneInfo, text: (key: string) => string): SimaPanel[] {
  const beats = SIMA_SCENES[id];
  return beats.map((beat, i) => {
    const key = simaSceneKey(id, i);
    const last = i === beats.length - 1;
    const dark = beat.stage === 'black' || beat.stage === 'voice';
    return {
      id: `${id}-${i}`,
      sceneId: id,
      scene: beat.stage,
      species: info.species,
      ...(beat.pose ? { pose: beat.pose } : {}),
      ...(info.other ? { other: info.other } : {}),
      durationMs: beatMs(text(key)),
      fadeInMs: i === 0 ? 1200 : dark ? 0 : 800,
      fadeOutMs: last ? 1400 : 800,
      lines: [key],
      ...SLOW,
      ...(beat.stage === 'voice' ? { charsPerSecond: 14 } : {}),
      camera: CAMERAS[i % CAMERAS.length]!,
    };
  });
}

/** The scene's line with the run's floor in it. */
export const simaText = (tr: (key: string) => string, floor: number | undefined) => (key: string): string => tr(key).replaceAll('{floor}', String(floor ?? 1));
