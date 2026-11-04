import portraitMeta from './portrait-meta.json';

/**
 * Face portraits of the playable species (PMDCollab SpriteCollab, CC BY-NC 4.0; credits in CREDITS.md), downloaded
 * by tools/fetch-portraits.mjs into public/portraits/<sprite key>/Normal.png, mirroring public/sprites. The
 * manifest names the pinned SpriteCollab commit and the keys that exist.
 */
export const PORTRAIT_MANIFEST: { source: string; files: string[] } = portraitMeta;

const HAVE = new Set(PORTRAIT_MANIFEST.files);

export interface PortraitFile {
  /** Path under public/portraits (the sprite key it came from plus Normal.png). */
  file: string;
  /** `own`: art for exactly this look; `fallback`: the nearest look that has art (female to male, shiny to normal). */
  kind: 'own' | 'fallback';
}

/** The sprite keys to try for a look, own first: "dex/form/shiny/female" loses the female look, then the shiny. */
function chain(key: string): string[] {
  const [dex, form = '0000', shiny, female] = key.split('/');
  const out = [key];
  if (female) out.push(`${dex}/${form}/${shiny ?? '0000'}`);
  if (shiny && shiny !== '0000') out.push(`${dex}/${form}`);
  if (female && shiny === '0000') out.push(`${dex}/${form}`);
  return [...new Set(out)];
}

/** The portrait for a sprite key (`lookKey` of a species), or null when no look in its chain has one. */
export function portraitFor(spriteKey: string): PortraitFile | null {
  const hit = chain(spriteKey).find((k) => HAVE.has(k));
  return hit ? { file: `${hit}/Normal.png`, kind: hit === spriteKey ? 'own' : 'fallback' } : null;
}
