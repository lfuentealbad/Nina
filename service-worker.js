// Service worker — estrategia cache-first para shell, fallback a index.html para navegación SPA.
// Versión bumpeada → invalida cachés viejas en activate.
const VERSION = 'nina-v3-aranceles-2026-05';

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

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // SPA navigation fallback solo cuando la URL es la raíz de la app.
  // Otras rutas (ej. /dev/test-db.html) NO se interceptan — fetch normal.
  if (req.mode === 'navigate') {
    if (url.pathname === BASE || url.pathname === BASE + 'index.html') {
      event.respondWith(
        caches.match(BASE + 'index.html').then((cached) => cached || fetch(req))
      );
    }
    return;
  }

  // Cache-first para shell y assets same-origin.
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
