// Service worker — estrategia híbrida:
//   - CSS y SVG: cache-first (cambian poco, sirven offline).
//   - JS: stale-while-revalidate (sirve cache rápido pero revalida con red,
//     así un fix llega en la siguiente carga sin esperar bump de VERSION).
//   - HTML/navigation: network-first con fallback al cache.
// Versión bumpeada → invalida cachés viejas en activate.
const VERSION = 'nina-v3-aranceles-2026-05-causas';

// BASE resuelve correctamente sea hosting en raíz o en subpath de GitHub Pages.
const BASE = new URL('./', self.location.href).pathname;

const SHELL = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'css/tokens.css',
  BASE + 'css/base.css',
  BASE + 'css/components.css',
  BASE + 'css/views.css',
  BASE + 'js/app.js',
  BASE + 'js/db.js',
  BASE + 'js/lib/fechas.js',
  BASE + 'js/lib/render.js',
  BASE + 'js/lib/icons.js',
  BASE + 'js/lib/illustrations.js',
  BASE + 'js/lib/datos-ejemplo.js',
  BASE + 'js/lib/saludo.js',
  BASE + 'js/lib/parser.js',
  BASE + 'js/lib/calendar.js',
  BASE + 'js/lib/reprogramar.js',
  BASE + 'js/lib/aviso-diario.js',
  BASE + 'js/lib/bienvenida.js',
  BASE + 'js/lib/indicadores.js',
  BASE + 'js/lib/aranceles-base.js',
  BASE + 'js/views/hoy.js',
  BASE + 'js/views/hoy-todas.js',
  BASE + 'js/views/causas-lista.js',
  BASE + 'js/views/causa-ficha.js',
  BASE + 'js/views/causa-form.js',
  BASE + 'js/views/tarea-form.js',
  BASE + 'js/views/captura-rapida.js',
  BASE + 'js/views/ajustes.js',
  BASE + 'js/views/tarea-actions.js',
  BASE + 'js/views/calculadora.js',
  BASE + 'js/views/arancel-form.js',
  BASE + 'icons/app-icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  // Permite que la app pida actualizarse manualmente desde Ajustes.
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // SPA navigation: network-first con fallback al cache.
  if (req.mode === 'navigate') {
    if (url.pathname === BASE || url.pathname === BASE + 'index.html') {
      event.respondWith(
        fetch(req).then((res) => {
          const clone = res.clone();
          caches.open(VERSION).then((cache) => cache.put(BASE + 'index.html', clone));
          return res;
        }).catch(() => caches.match(BASE + 'index.html'))
      );
    }
    return;
  }

  // JavaScript: stale-while-revalidate — sirve del cache pero revalida con red
  // en segundo plano. Así un fix llega en la siguiente carga sin necesidad de
  // bumpear el VERSION del SW.
  if (url.pathname.endsWith('.js')) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // CSS, imágenes, manifest, fonts: cache-first.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, clone));
        }
        return res;
      });
    })
  );
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => cached);
  return cached || fetchPromise;
}
