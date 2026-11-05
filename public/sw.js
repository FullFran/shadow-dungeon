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
var CACHE_FIRST_DIRS = ['assets/', 'sprites/', 'portraits/', 'tiles/', 'music/', 'fonts/', 'icons/'];
/* Art (sprites, portraits, tiles, music) is big and rarely changes: it lives in its own cache named after a hash of the art
   files, stamped at build (tools/art-version-plugin.ts), so a deploy that touches only code does not download it again. */
var ART_VERSION = '__ART_VERSION__'.indexOf('__') === 0 ? 'dev' : '__ART_VERSION__';
var ART_CACHE = CACHE_PREFIX + 'art-' + ART_VERSION;
var ART_DIRS = ['sprites/', 'portraits/', 'tiles/', 'music/'];

/** The cache a same-origin game file belongs in: the art cache for art, else this version's runtime cache. */
function cacheNameFor(path) {
  for (var i = 0; i < ART_DIRS.length; i++) if (path.indexOf(ART_DIRS[i]) === 0) return ART_CACHE;
  return RUNTIME_CACHE;
}

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
    return name.indexOf(CACHE_PREFIX) === 0 && name !== SHELL_CACHE && name !== RUNTIME_CACHE && name !== ART_CACHE;
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

// A file the server does not have (yet: a deploy in progress) can come back as the game's index.html with a 200. Cached,
// that page would stand in for a sprite, a portrait or the stylesheet until the cache is cleared, so only the expected
// kinds of content are ever stored or served from the cache.
function isCacheable(path, contentType) {
  var type = String(contentType || '').toLowerCase();
  if (!type || type.indexOf('text/html') === 0) return false;
  if (path.indexOf('assets/') === 0) return /css|javascript|json|wasm|font|image|audio/.test(type);
  if (path.indexOf('fonts/') === 0) return /font|octet-stream/.test(type);
  if (path.indexOf('music/') === 0) return /audio|ogg|mpeg|octet-stream/.test(type);
  return /image|octet-stream/.test(type);
}

function scopePath(url) {
  return new URL(url).pathname.slice(new URL(self.registration.scope).pathname.length);
}

function cacheFirst(request) {
  var path = scopePath(request.url);
  return caches.match(request).then(function (cached) {
    if (cached && isCacheable(path, cached.headers.get('content-type'))) return cached;
    return fetch(request).then(function (response) {
      if (response.ok && response.type === 'basic' && isCacheable(path, response.headers.get('content-type'))) {
        var copy = response.clone();
        caches.open(cacheNameFor(path)).then(function (cache) {
          return cache.put(request, copy);
        });
      } else if (cached) {
        // A poisoned entry from an earlier visit: drop it so the next request asks the network again.
        caches.open(cacheNameFor(path)).then(function (cache) {
          return cache.delete(request);
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
