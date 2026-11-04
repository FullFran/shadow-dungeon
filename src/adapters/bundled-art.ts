/**
 * Art that ships inside the bundle (dist/assets/, hashed names) instead of as raw files under public/: the face
 * portraits and the news screenshots. sd-pre serves assets/ but answered the raw portraits/ and news/ folders
 * with something that is not an image (owner, 2026-11-04: the profile avatar and the news pictures were missing
 * there and only there), and hashed names also cache forever without a stale copy surviving a change.
 */
const PORTRAITS = import.meta.glob<string>('../assets/portraits/**/*.png', { eager: true, query: '?url', import: 'default' });
const NEWS = import.meta.glob<string>('../assets/news/*.webp', { eager: true, query: '?url', import: 'default' });

/** URL of a portrait file (`0104/0000/Normal.png`), or null when it is not bundled. */
export const portraitAssetUrl = (file: string): string | null => PORTRAITS[`../assets/portraits/${file}`] ?? null;

/** URL of a news image (`news/title-hub.webp`, the path the changelog stores). */
export const newsImageUrl = (path: string): string => NEWS[`../assets/${path}`] ?? `${import.meta.env.BASE_URL}${path}`;
