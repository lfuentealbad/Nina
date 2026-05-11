// Bootstrap + hash router + nav persistente + FAB.

import db from './db.js';
import { el, mount, toast } from './lib/render.js';
import { icon } from './lib/icons.js';
import { applyTheme } from './views/ajustes.js';
import { openCapturaRapida } from './views/captura-rapida.js';
import { insertarEjemplosSiVacia } from './lib/datos-ejemplo.js';

const root = document.getElementById('app');

// ===== Tema al cargar =====
applyTheme();

// ===== Service worker =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            // Toast pequeño, sin bloquear.
            toast('Actualizada a la última versión', { dur: 3000 });
          }
        });
      });
    }).catch((err) => console.warn('SW registro falló:', err));
  });
}

// ===== Bottom nav, sidebar y FAB =====
const navEl = document.getElementById('bottom-nav');
const sidebarEl = document.getElementById('sidebar');
const fabEl = document.getElementById('fab');

const NAV = [
  { hash: '#hoy', label: 'Hoy', iconName: 'home' },
  { hash: '#causas', label: 'Causas', iconName: 'folder' },
  { hash: '#ajustes', label: 'Ajustes', iconName: 'settings' },
];

function renderNav(currentHash) {
  // Bottom nav (mobile)
  navEl.replaceChildren();
  for (const item of NAV) {
    const isActive = matchesNav(currentHash, item.hash);
    const link = el('a', {
      class: `nav-item ${isActive ? 'active' : ''}`,
      href: item.hash,
      aria: { label: item.label, current: isActive ? 'page' : 'false' },
    }, [
      icon(item.iconName, { size: 22 }),
      el('span', { text: item.label }),
    ]);
    navEl.appendChild(link);
  }

  // Sidebar (desktop) — brand + Capturar + nav agrupado + version al pie
  sidebarEl.replaceChildren();
  sidebarEl.appendChild(el('div.sidebar-brand', {}, [
    el('span.brand-dot', { aria: { hidden: 'true' } }),
    el('span', { text: 'Carolina' }),
  ]));

  // Botón Capturar (reemplaza al FAB en desktop)
  sidebarEl.appendChild(el('button.sidebar-cta', {
    type: 'button',
    on: { click: () => openCapturaRapida() },
  }, [icon('plus', { size: 16 }), el('span', { text: 'Capturar' })]));

  // Sección principal (Hoy / Causas)
  sidebarEl.appendChild(el('div.sidebar-section-title', { text: 'Trabajo' }));
  for (const item of NAV.slice(0, 2)) {
    const isActive = matchesNav(currentHash, item.hash);
    sidebarEl.appendChild(el('a', {
      class: `nav-item ${isActive ? 'active' : ''}`,
      href: item.hash,
      aria: { current: isActive ? 'page' : 'false' },
    }, [icon(item.iconName, { size: 18 }), el('span', { text: item.label })]));
  }

  // Spacer + Ajustes al pie
  sidebarEl.appendChild(el('div.sidebar-spacer'));
  for (const item of NAV.slice(2)) {
    const isActive = matchesNav(currentHash, item.hash);
    sidebarEl.appendChild(el('a', {
      class: `nav-item ${isActive ? 'active' : ''}`,
      href: item.hash,
      aria: { current: isActive ? 'page' : 'false' },
    }, [icon(item.iconName, { size: 18 }), el('span', { text: item.label })]));
  }
  sidebarEl.appendChild(el('div.sidebar-version', { text: 'Carolina v1.5' }));
}

function matchesNav(current, navHash) {
  // #causas matchea #causas, #causas/123, #causas/nueva, etc.
  // #hoy matchea '' y '#hoy'.
  if (navHash === '#hoy') return current === '' || current === '#' || current.startsWith('#hoy');
  return current.startsWith(navHash);
}

// Inyectar el icono Lucide en el FAB (uniforme con sidebar-cta)
fabEl.appendChild(icon('plus', { size: 22 }));
fabEl.addEventListener('click', () => openCapturaRapida());

// ===== Router =====
const ROUTES = [
  { pattern: /^#?$|^#hoy$/,                    view: () => import('./views/hoy.js'),         params: () => ({}),                showFab: true,  showNav: true },
  { pattern: /^#causas\/nueva$/,               view: () => import('./views/causa-form.js'),  params: () => ({}),                showFab: false, showNav: true },
  { pattern: /^#causas\/([^/]+)\/editar$/,     view: () => import('./views/causa-form.js'),  params: (m) => ({ id: m[1] }),     showFab: false, showNav: true },
  { pattern: /^#causas\/([^/]+)$/,             view: () => import('./views/causa-ficha.js'), params: (m) => ({ id: m[1] }),     showFab: true,  showNav: true },
  { pattern: /^#causas$/,                      view: () => import('./views/causas-lista.js'),params: () => ({}),                showFab: true,  showNav: true },
  { pattern: /^#tareas\/nueva/,                view: () => import('./views/tarea-form.js'),  params: () => ({}),                showFab: false, showNav: true },
  { pattern: /^#tareas\/([^/]+)\/editar$/,     view: () => import('./views/tarea-form.js'),  params: (m) => ({ id: m[1] }),     showFab: false, showNav: true },
  { pattern: /^#ajustes$/,                     view: () => import('./views/ajustes.js'),     params: () => ({}),                showFab: false, showNav: true },
];

async function route() {
  const hash = location.hash.split('?')[0]; // ignorar query string para el match
  for (const r of ROUTES) {
    const m = hash.match(r.pattern);
    if (m) {
      try {
        const mod = await r.view();
        navEl.hidden = !r.showNav;
        sidebarEl.hidden = !r.showNav;
        fabEl.hidden = !r.showFab;
        renderNav(location.hash);
        // Scroll al inicio en cada cambio de ruta.
        window.scrollTo(0, 0);
        await mod.default(root, r.params(m));
      } catch (e) {
        console.error('Error en route:', e);
        mount(root, el('div.app-container', {}, [
          el('div.empty-state', {}, [
            el('p.empty-message', { text: 'Algo salió mal cargando la vista.' }),
            el('p', { text: e.message, style: { fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' } }),
            el('a.btn.btn-secondary', { href: '#hoy', text: 'Volver a Hoy' }),
          ]),
        ]));
      }
      return;
    }
  }
  // 404
  mount(root, el('div.app-container', {}, [
    el('div.empty-state', {}, [
      el('p.empty-message', { text: 'Página no encontrada.' }),
      el('a.btn.btn-secondary', { href: '#hoy', text: 'Volver a Hoy' }),
    ]),
  ]));
}

window.addEventListener('hashchange', route);

// Bootstrap: cargar ejemplos si la BD está vacía, después rutear.
(async function bootstrap() {
  try {
    const insertaron = await insertarEjemplosSiVacia(db);
    if (insertaron) {
      setTimeout(() => {
        toast(
          'Te dejé un par de ejemplos para que veas cómo se ve Nina. Borralos cuando quieras desde Ajustes.',
          { dur: 7000 }
        );
      }, 500);
    }
  } catch (e) {
    console.warn('No se pudieron insertar ejemplos:', e);
  }

  if (!location.hash) location.hash = '#hoy';
  else route();
})();

// Escuchar cambio de prefers-color-scheme para refrescar tema cuando está en "sistema".
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if ((localStorage.getItem('tema') || 'sistema') === 'sistema') applyTheme();
});
