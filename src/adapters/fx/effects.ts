import type { EffectModule } from './bake';

/**
 * Lazy loaders of the vendored effects, keyed `category/name`. Each becomes its
 * own chunk, fetched by the bake worker the first time something asks for it.
 */
const MODULES = import.meta.glob<EffectModule>(['../../vendor/pixelfx/fx/*/*.js', '!../../vendor/pixelfx/fx/*/_lib.js']);

const PREFIX = '../../vendor/pixelfx/fx/';

export const EFFECT_IDS: readonly string[] = Object.keys(MODULES).map((path) => path.slice(PREFIX.length, -'.js'.length));

export function loadEffect(id: string): Promise<EffectModule> {
  const load = MODULES[`${PREFIX}${id}.js`];
  if (!load) return Promise.reject(new Error(`unknown effect ${id}`));
  return load();
}
