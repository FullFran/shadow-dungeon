import type { SimaBandId } from './sima';

/**
 * The Sima del Eclipse's cinematics (docs/sima-redesign.md §5) as data: still
 * tableaux on the prologue player, one line each (`sima.scene.<id>.<n>`), in
 * the Sendas' manner. The player's own Pokémon stands on them (its current
 * species), and its shadow or its corrupted echo beside it. They play once
 * per device, solo only (a shared run never pauses: the line goes to the log
 * instead), skippable, with the run clock stopped. The scenes are drawn in
 * src/adapters/sima-scenes.ts.
 */
export type SimaStage =
  /** The crater's rim at night: the burnt statue looks into the pit, the ring in the sky. */
  | 'rim'
  /** Red light falling through the rift, slowly, touching nothing. */
  | 'fall'
  /** The Pokémon small on the rim; its shadow on the ash does not keep its pace. */
  | 'rim-shadow'
  /** Black: only the words. */
  | 'black'
  /** Black, and the voice of the prologue. */
  | 'voice'
  /** II: roots without a tree hang from the ceiling. */
  | 'roots'
  /** II: a path that comes back to the same trunk. */
  | 'loop'
  /** II: the Pokémon from behind; its shadow faces you. */
  | 'back'
  /** III: still water and a bell under it. */
  | 'bell'
  /** III: a huge faceless shape; letters write themselves and fade. */
  | 'names'
  /** IV: a swamp that reflects another sky. */
  | 'mirror'
  /** IV: Pokémon shapes in the water, still, with their backs to you; one turns, faceless. */
  | 'backs'
  /** V: stone islands over nothing, the light raining down. */
  | 'islands'
  /** V: the red ring below; the light falls towards it. */
  | 'ring-below'
  /** V: the Pokémon alone on an island, its shadow at its feet. */
  | 'alone'
  /** The open room, dark; the shadow peels off the floor and stands up in front. */
  | 'rise'
  /** The shadow with your shape, black and red, with its halo. */
  | 'echo'
  /** The two face to face. */
  | 'face'
  /** Black, a murmur of syllables (glyphs that write and fade). */
  | 'murmur'
  /** A herald's shape, colourless and too big. */
  | 'herald'
  /** A wall of fog in a far room; something waits behind it. */
  | 'fog-wall'
  /** The shadow of somebody: a big black shape (its own sheet once you know it). */
  | 'someone'
  /** The walls beat with the eclipse; nothing else. */
  | 'pulse'
  /** The Pokémon on its knees, shapes around it that were not there. */
  | 'kneel'
  /** A hand of shadow, yours, pulls upwards. */
  | 'hand'
  /** The crater's rim at dusk; the Pokémon lying in the ash. */
  | 'wake'
  /** Phantump on the rim beside the Pokémon. */
  | 'phantump'
  /** The burnt statue looking into the pit. */
  | 'statue';

/** One tableau: its stage, the player's Pokémon on it (or not), and the line key when it borrows another scene's. */
export interface SimaBeat {
  stage: SimaStage;
  /** The player's Pokémon stands on it in this pose. */
  pose?: 'Idle' | 'Walk' | 'Hurt' | 'Faint' | 'Sleep';
  /** Another scene's line instead of its own (`sima.scene.<id>.<n>`). */
  key?: string;
}

export type SimaSceneId =
  | 'mouth'
  | `stratum-${Exclude<SimaBandId, 'crypt'>}`
  | 'own-shadow'
  | 'first-name'
  | 'someone'
  | 'someone-known'
  | 'lost'
  | 'return'
  | 'return-short';

const b = (stage: SimaStage, pose?: SimaBeat['pose'], key?: string): SimaBeat => ({ stage, ...(pose ? { pose } : {}), ...(key ? { key } : {}) });

export const SIMA_SCENES: Record<SimaSceneId, readonly SimaBeat[]> = {
  // 5.1 The mouth: before the first descent (after the villagers' pleas in the town).
  mouth: [b('rim'), b('fall'), b('rim-shadow', 'Idle'), b('black'), b('voice')],
  // 5.2 The strata: the first time you reach 11, 21, 31 and 41.
  'stratum-forest': [b('roots'), b('loop'), b('back', 'Walk')],
  'stratum-caves': [b('bell'), b('names'), b('bell')],
  'stratum-swamp': [b('mirror'), b('backs'), b('backs')],
  'stratum-abyss': [b('islands'), b('ring-below'), b('alone', 'Idle')],
  // 5.3 Your shadow: the first Eco del Eclipse.
  'own-shadow': [b('rise', 'Idle'), b('rise', 'Idle'), b('echo'), b('face', 'Idle')],
  // 5.4 The first name: before the first herald's own cutscene.
  'first-name': [b('murmur'), b('herald')],
  // 5.5 Somebody's shadow: the first lost shadow, nameless or known (each plays once).
  someone: [b('fog-wall', 'Idle'), b('someone'), b('fog-wall', 'Idle')],
  'someone-known': [b('fog-wall', 'Idle', 'sima.scene.someone.1'), b('someone'), b('someone')],
  // 5.6 Breaking point, then the waking: the first Sima run lost or defeated (app/sima-cinematic.ts `simaEndScene`). Phantump explains the rest.
  lost: [
    b('pulse'),
    b('kneel', 'Hurt'),
    b('black'),
    b('voice'),
    b('hand', 'Faint'),
    b('wake', 'Faint'),
    b('phantump', 'Idle'),
    b('phantump', 'Idle'),
    b('phantump', 'Idle'),
    b('phantump', 'Idle'),
    b('rim'),
    b('fall'),
    b('phantump', 'Idle'),
    b('statue'),
  ],
  // 5.7 The return: after every other Sima run (whole the first time, then two tableaux).
  return: [b('wake', 'Faint'), b('rim-shadow', 'Idle'), b('statue'), b('black')],
  'return-short': [b('wake', 'Faint', 'sima.scene.return.1'), b('rim-shadow', 'Idle', 'sima.scene.return.2')],
};

export const SIMA_SCENE_IDS = Object.keys(SIMA_SCENES) as SimaSceneId[];

/** The line key of beat `index` of a scene. */
export const simaSceneKey = (id: SimaSceneId, index: number): string => SIMA_SCENES[id][index]?.key ?? `sima.scene.${id}.${index + 1}`;

/** The short line a shared run logs instead of the cinematic (`sima.scene.<id>.card`). */
export const simaCardKey = (id: SimaSceneId): string => `sima.scene.${id}.card`;

/** Every i18n key the Sima's cinematics need (the completeness test checks each exists in every language). */
export function simaSceneKeys(): string[] {
  return SIMA_SCENE_IDS.flatMap((id) => [...SIMA_SCENES[id].map((_, i) => simaSceneKey(id, i)), simaCardKey(id)]);
}
