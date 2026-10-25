/*
 * Mazmorra Sombría service worker (plain JS, copied as-is to the build root).
 * - Versioned caches: the page registers `sw.js?v=<build>` (src/pwa/register.ts), so
 *   every deploy is a new worker with its own caches; older ones go on activate.
 * - Install precaches the app shell read from the built index.html (its hashed
 *   JS/CSS) plus the page, manifest, icons and font.
 * - Same-origin game files (assets, sprites, tiles, music, fonts, icons) are
 *   cache-first and cached as they are fetched; pages are network-first with
 *   the cached page as the offline fallback.
 * - Cross-origin requests (Trystero trackers, WebSockets, CDNs), non-GET,
 *   ranged requests and anything outside the scope are never touched.
 * - A new version waits until the page sends SKIP_WAITING (the "Actualizar" toast).
 * `var` and function declarations on purpose: tests/pwa/sw.test.ts reads them from a sandbox.
 */
var VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
var CACHE_PREFIX = 'mazmorra-';
var SHELL_CACHE = CACHE_PREFIX + 'shell-' + VERSION;
var RUNTIME_CACHE = CACHE_PREFIX + 'runtime-' + VERSION;
var SHELL_STATIC = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'fonts/PixelifySans.ttf'];
var CACHE_FIRST_DIRS = ['assets/', 'sprites/', 'tiles/', 'music/', 'fonts/', 'icons/'];

/** Relative URLs to precache: the static shell plus every ./assets/ file the built page references. */
function shellUrls(html) {
  var urls = new Set(SHELL_STATIC);
  var pattern = /(?:src|href)="(?:\.\/)?(assets\/[^"#?]+)"/g;
  var match;
  while ((match = pattern.exec(html)) !== null) urls.add(match[1]);
  return Array.from(urls);
}

/** 'navigate' (network-first page), 'cache-first' (game files) or 'network' (left alone). */
function strategyFor(request, scope) {
  if (request.method !== 'GET' || request.range) return 'network';
  var url = new URL(request.url);
  var base = new URL(scope);
  if (url.origin !== base.origin || url.pathname.indexOf(base.pathname) !== 0) return 'network';
  if (request.mode === 'navigate') return 'navigate';
  var path = url.pathname.slice(base.pathname.length);
  if (path === 'manifest.webmanifest') return 'cache-first';
  for (var i = 0; i < CACHE_FIRST_DIRS.length; i++) if (path.indexOf(CACHE_FIRST_DIRS[i]) === 0) return 'cache-first';
  return 'network';
}

/** Our caches that belong to another version. */
function staleCaches(names) {
  return names.filter(function (name) {
    return name.indexOf(CACHE_PREFIX) === 0 && name !== SHELL_CACHE && name !== RUNTIME_CACHE;
  });
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    fetch('index.html', { cache: 'no-cache' })
      .then(function (response) {
        return response.text();
      })
      .then(function (html) {
        return caches.open(SHELL_CACHE).then(function (cache) {
          return cache.addAll(shellUrls(html));
        });
      }),
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (names) {
        return Promise.all(staleCaches(names).map(function (name) {
          return caches.delete(name);
        }));
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});

function cacheFirst(request) {
  return caches.match(request).then(function (cached) {
    if (cached) return cached;
    return fetch(request).then(function (response) {
      if (response.ok && response.type === 'basic') {
        var copy = response.clone();
        caches.open(RUNTIME_CACHE).then(function (cache) {
          return cache.put(request, copy);
        });
      }
      return response;
    });
  });
}

function networkFirstPage(request) {
  return fetch(request).catch(function () {
    return caches.match('index.html').then(function (page) {
      return page || caches.match('./') || Response.error();
    });
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  var strategy = strategyFor({ url: request.url, method: request.method, mode: request.mode, range: request.headers.has('range') }, self.registration.scope);
  if (strategy === 'cache-first') event.respondWith(cacheFirst(request));
  else if (strategy === 'navigate') event.respondWith(networkFirstPage(request));
});
