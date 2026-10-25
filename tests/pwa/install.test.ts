import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { bannerVisible, installOffer, isIosSafari, neverShowBanner } from '../../src/pwa/install';
import { serviceWorkerUrl } from '../../src/pwa/register';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const IOS_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';
const MAC = IPAD_DESKTOP_UA;

describe('install offer', () => {
  it('offers the browser prompt when one was captured', () => {
    expect(installOffer({ standalone: false, hasPrompt: true, iosSafari: false })).toBe('prompt');
  });

  it('offers instructions on iOS Safari, which has no prompt', () => {
    expect(installOffer({ standalone: false, hasPrompt: false, iosSafari: true })).toBe('ios');
  });

  it('offers nothing when already installed or when there is no way to install', () => {
    expect(installOffer({ standalone: true, hasPrompt: true, iosSafari: true })).toBe('none');
    expect(installOffer({ standalone: false, hasPrompt: false, iosSafari: false })).toBe('none');
  });

  it('tells iOS Safari from other iOS browsers, Android and a Mac', () => {
    expect(isIosSafari(IPHONE, 5)).toBe(true);
    // iPadOS asks for the desktop site but has touch points.
    expect(isIosSafari(IPAD_DESKTOP_UA, 5)).toBe(true);
    expect(isIosSafari(MAC, 0)).toBe(false);
    expect(isIosSafari(IOS_CHROME, 5)).toBe(false);
    expect(isIosSafari(ANDROID, 5)).toBe(false);
  });
});

describe('install banner', () => {
  it('shows once per page while there is an offer, and never after "no volver a mostrar"', () => {
    const store = memoryStore();
    expect(bannerVisible(store, 'prompt', false)).toBe(true);
    expect(bannerVisible(store, 'prompt', true)).toBe(false);
    expect(bannerVisible(store, 'none', false)).toBe(false);
    neverShowBanner(store);
    expect(bannerVisible(store, 'ios', false)).toBe(false);
  });
});


describe('service worker URL', () => {
  it('is relative to the page and versioned by the bundle file name', () => {
    expect(serviceWorkerUrl('https://user.github.io/mazmorra-sombria/assets/index-AbC123.js')).toBe('./sw.js?v=index-AbC123.js');
  });
});
