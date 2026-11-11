import portraitMeta from './portrait-meta.json';

/**
 * Mystery Dungeon portraits (PMDCollab SpriteCollab, CC BY-NC 4.0; credits in CREDITS.md; odd/tasks/pmd-portraits.md),
 * downloaded by tools/fetch-portraits.mjs into src/assets/portraits/<sprite key>/<Emotion>.png, mirroring
 * public/sprites: every playable look and every species that speaks, with the 8 core emotions each has upstream. The
 * manifest names the pinned SpriteCollab commit and, per key, the emotions that exist.
 */
export const PORTRAIT_EMOTIONS = ['Normal', 'Happy', 'Sad', 'Angry', 'Surprised', 'Worried', 'Determined', 'Pain'] as const;
export type PortraitEmotion = (typeof PORTRAIT_EMOTIONS)[number];

export const PORTRAIT_MANIFEST: { source: string; files: Readonly<Record<string, readonly string[]>> } = portraitMeta;

export interface PortraitFile {
  /** Path under src/assets/portraits (the sprite key it came from plus `<Emotion>.png`). */
  file: string;
  /** `own`: art for exactly this look; `fallback`: the nearest look that has art (female to male, shiny to normal, a form to the base form). */
  kind: 'own' | 'fallback';
  /** The emotion drawn: the one asked for, or Normal when the look has no art for it. */
  emotion: PortraitEmotion;
}

/** The sprite keys to try for a look, own first: "dex/form/shiny/female" loses the female look, then the shiny, then the form. */
function chain(key: string): string[] {
  const [dex, form = '0000', shiny, female] = key.split('/');
  const out = [key];
  if (female) out.push(`${dex}/${form}/${shiny ?? '0000'}`);
  if (shiny && shiny !== '0000') out.push(`${dex}/${form}`);
  if (female && shiny === '0000') out.push(`${dex}/${form}`);
  if (form !== '0000') out.push(`${dex}/0000`);
  return [...new Set(out)];
}

/** The portrait for a sprite key (`lookKey` of a species) in an emotion, or null when no look in its chain has one. */
export function portraitFor(spriteKey: string, emotion: PortraitEmotion = 'Normal'): PortraitFile | null {
  const hit = chain(spriteKey).find((k) => (PORTRAIT_MANIFEST.files[k]?.length ?? 0) > 0);
  if (!hit) return null;
  const drawn = PORTRAIT_MANIFEST.files[hit]!.includes(emotion) ? emotion : 'Normal';
  return { file: `${hit}/${drawn}.png`, kind: hit === spriteKey ? 'own' : 'fallback', emotion: drawn };
}
