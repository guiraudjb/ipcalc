/* ipcalc - service worker : application disponible hors ligne.
   VERSION et ASSETS sont regénérés par tools/maj_cache.py. */
'use strict';

const VERSION = '695d6fcca3';
const CACHE = 'ipcalc-' + VERSION;
const ASSETS = [
  "./",
  "index.html",
  "app.js",
  "ipcalc.js",
  "styles.css",
  "manifest.webmanifest",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/icon.svg",
  "dsfr/artwork/pictograms/environment/moon.svg",
  "dsfr/artwork/pictograms/environment/sun.svg",
  "dsfr/artwork/pictograms/system/system.svg",
  "dsfr/dsfr.min.css",
  "dsfr/dsfr.module.min.js",
  "dsfr/dsfr.nomodule.min.js",
  "dsfr/favicon/apple-touch-icon.png",
  "dsfr/favicon/favicon.ico",
  "dsfr/favicon/favicon.svg",
  "dsfr/fonts/Marianne-Bold.woff2",
  "dsfr/fonts/Marianne-Bold_Italic.woff2",
  "dsfr/fonts/Marianne-Light.woff2",
  "dsfr/fonts/Marianne-Light_Italic.woff2",
  "dsfr/fonts/Marianne-Medium.woff2",
  "dsfr/fonts/Marianne-Medium_Italic.woff2",
  "dsfr/fonts/Marianne-Regular.woff2",
  "dsfr/fonts/Marianne-Regular_Italic.woff2",
  "dsfr/fonts/Spectral-ExtraBold.woff2",
  "dsfr/fonts/Spectral-Regular.woff2",
  "dsfr/icons/arrows/arrow-down-s-line.svg",
  "dsfr/icons/arrows/arrow-left-line.svg",
  "dsfr/icons/arrows/arrow-left-s-line.svg",
  "dsfr/icons/arrows/arrow-right-line.svg",
  "dsfr/icons/arrows/arrow-right-s-line.svg",
  "dsfr/icons/arrows/arrow-up-down-line.svg",
  "dsfr/icons/arrows/arrow-up-line.svg",
  "dsfr/icons/arrows/arrow-up-s-line.svg",
  "dsfr/icons/arrows/fr--arrow-left-s-first-line.svg",
  "dsfr/icons/arrows/fr--arrow-right-s-last-line.svg",
  "dsfr/icons/business/briefcase-fill.svg",
  "dsfr/icons/business/links-fill.svg",
  "dsfr/icons/business/mail-line.svg",
  "dsfr/icons/document/clipboard-line.svg",
  "dsfr/icons/editor/align-left.svg",
  "dsfr/icons/editor/fr--quote-line.svg",
  "dsfr/icons/editor/translate-2.svg",
  "dsfr/icons/logo/bluesky-fill.svg",
  "dsfr/icons/logo/bluesky-line.svg",
  "dsfr/icons/logo/facebook-circle-fill.svg",
  "dsfr/icons/logo/facebook-circle-line.svg",
  "dsfr/icons/logo/fr--dailymotion-fill.svg",
  "dsfr/icons/logo/fr--tiktok-fill.svg",
  "dsfr/icons/logo/github-fill.svg",
  "dsfr/icons/logo/instagram-fill.svg",
  "dsfr/icons/logo/linkedin-box-fill.svg",
  "dsfr/icons/logo/linkedin-box-line.svg",
  "dsfr/icons/logo/mastodon-fill.svg",
  "dsfr/icons/logo/mastodon-line.svg",
  "dsfr/icons/logo/snapchat-fill.svg",
  "dsfr/icons/logo/telegram-fill.svg",
  "dsfr/icons/logo/threads-fill.svg",
  "dsfr/icons/logo/threads-line.svg",
  "dsfr/icons/logo/twitch-fill.svg",
  "dsfr/icons/logo/twitter-fill.svg",
  "dsfr/icons/logo/twitter-line.svg",
  "dsfr/icons/logo/twitter-x-fill.svg",
  "dsfr/icons/logo/twitter-x-line.svg",
  "dsfr/icons/logo/vimeo-fill.svg",
  "dsfr/icons/logo/youtube-fill.svg",
  "dsfr/icons/media/fullscreen-line.svg",
  "dsfr/icons/system/check-line.svg",
  "dsfr/icons/system/checkbox-circle-line.svg",
  "dsfr/icons/system/close-line.svg",
  "dsfr/icons/system/download-line.svg",
  "dsfr/icons/system/error-warning-fill.svg",
  "dsfr/icons/system/external-link-line.svg",
  "dsfr/icons/system/fr--alert-warning-2-fill.svg",
  "dsfr/icons/system/fr--alert-warning-fill.svg",
  "dsfr/icons/system/fr--error-fill.svg",
  "dsfr/icons/system/fr--info-fill.svg",
  "dsfr/icons/system/fr--success-fill.svg",
  "dsfr/icons/system/fr--theme-fill.svg",
  "dsfr/icons/system/fr--warning-fill.svg",
  "dsfr/icons/system/menu-2-fill.svg",
  "dsfr/icons/system/menu-fill.svg",
  "dsfr/icons/system/question-line.svg",
  "dsfr/icons/system/refresh-line.svg",
  "dsfr/icons/system/search-line.svg",
  "dsfr/icons/user/account-circle-fill.svg",
  "dsfr/icons/user/team-line.svg",
  "dsfr/icons/weather/flashlight-fill.svg",
  "dsfr/icons/weather/heavy-showers-fill.svg",
  "dsfr/icons/weather/typhoon-fill.svg"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ipcalc-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Cache d'abord (tout est local), réseau en secours ; les paramètres d'URL (?host=…) sont ignorés. */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()));
    })
  );
});
