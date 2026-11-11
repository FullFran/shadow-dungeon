import { t } from '../i18n';
import { WORDING_DEVICES, wordingKey } from './device-wording';
import { h } from './window';

/**
 * A hint line with its three wordings drawn (keyboard, pad, touch: src/ui/device-wording.ts); the CSS in index.html
 * shows one by `html.touch` and `html.pad`. All three are drawn because touch mode and the pad are noticed after the
 * screen is up (the first touch, the first button), and the hint must follow without a redraw.
 */
export function deviceHint(className: string, keysKey: string, tr: (key: string) => string = t): HTMLElement {
  return h(
    'p',
    { className: `${className} dual-hint` },
    WORDING_DEVICES.map((device) => h('span', { className: `on-${device}`, textContent: tr(wordingKey(keysKey, device)) })),
  );
}
