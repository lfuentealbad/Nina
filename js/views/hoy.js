// Vista Hoy — minimalista. Una sola tarjeta de foco con banda lateral del semáforo.
// Nada de listas largas inline, quick actions ni link de bandeja al pie.

import db from '../db.js';
import { el, mount, toast } from '../lib/render.js';
import { icon } from '../lib/icons.js';
import { hoyISO, toISO, formatoLargo, semaforo, saludoPorHora } from '../lib/fechas.js';

export default async function renderHoy(root) {
  const nombre = localStorage.getItem('nombre') || 'Nina';
  const saludo = `${saludoPorHora()}, ${nombre}`;

  const foco = await elegirFoco();
  const pendientesProx = await pendientesProximosDosDias(foco?.tarea?.id);

  const view = el('div.view-hoy.app-container', { id: 'hoy-view' }, [
    el('header.hoy-encabezado', {}, [
      el('h1.hoy-saludo', { text: saludo }),
      el('p.hoy-fecha', { text: formatoLargo(hoyISO()) }),
    ]),

    foco
      ? el('div', { id: 'hoy-foco-wrap' }, [
          renderTarjetaFoco(foco, () => refresh()),
          pendientesProx > 0 && el('a.hoy-ver-mas', {
            href: '#hoy/todas',
            text: `Ver ${pendientesProx} ${pendientesProx === 1 ? 'pendiente más' : 'pendientes más'} →`,
          }),
        ])
      : renderEmptyState(),
  ]);

  mount(root, view);

  function refresh() { renderHoy(root); }
}

// ===== Selección del foco =====

async function elegirFoco() {
  const hoy = hoyISO();
  const all = await db.tareas.list();
  const activas = all.filter((t) => !t.completada && !t.vencida);

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // 1. Audiencia hoy con hora futura
  const audienciasHoy = activas
    .filter((t) => t.tipo === 'audiencia' && t.fechaVencimiento === hoy && t.horaVencimiento)
    .filter((t) => {
      const [h, m] = t.horaVencimiento.split(':').map(Number);
      return (h * 60 + m) >= nowMin;
    })
    .sort((a, b) => a.horaVencimiento.localeCompare(b.horaVencimiento));
  if (audienciasHoy[0]) return await empacar(audienciasHoy[0]);

  // 2. Plazo (no audiencia) hoy
  const plazosHoy = activas
    .filter((t) => t.tipo !== 'audiencia' && t.fechaVencimiento === hoy)
    .sort(porFechaHora);
  if (plazosHoy[0]) return await empacar(plazosHoy[0]);

  // 3. Plazo (no audiencia) mañana
  const manana = isoDelta(1);
  const plazosManana = activas
    .filter((t) => t.tipo !== 'audiencia' && t.fechaVencimiento === manana)
    .sort(porFechaHora);
  if (plazosManana[0]) return await empacar(plazosManana[0]);

  // 4. Audiencia o plazo en próximos 7 días
  const tope = isoDelta(7);
  const proximos = activas
    .filter((t) => t.fechaVencimiento && t.fechaVencimiento > hoy && t.fechaVencimiento <= tope)
    .sort(porFechaHora);
  if (proximos[0]) return await empacar(proximos[0]);

  return null;
}

async function empacar(tarea) {
  const causa = tarea.causaId ? await db.causas.get(tarea.causaId) : null;
  return { tarea, causa, sem: semaforo(tarea.fechaVencimiento) };
}

async function pendientesProximosDosDias(excluirId) {
  const hoy = hoyISO();
  const limite = isoDelta(2);
  const all = await db.tareas.list();
  return all.filter((t) =>
    !t.completada &&
    !t.vencida &&
    t.fechaVencimiento &&
    t.fechaVencimiento >= hoy &&
    t.fechaVencimiento <= limite &&
    t.id !== excluirId
  ).length;
}

// ===== Tarjeta de foco =====

function renderTarjetaFoco({ tarea, causa, sem }, onChange) {
  const meta = causa
    ? [causa.caratulado, causa.tribunal].filter(Boolean).join(' · ')
    : '';

  const eyebrowText = (sem?.label || '').toUpperCase();
  const semClass = sem?.class || '';

  return el('article.hoy-foco', {
    class: `hoy-foco ${semClass}`,
    role: causa ? 'button' : null,
    tabindex: causa ? '0' : null,
    aria: causa ? { label: `Abrir causa ${causa.caratulado || ''}` } : {},
    on: causa ? {
      click: (e) => {
        if (e.target.closest('.hoy-foco-completar')) return;
        location.hash = `#causas/${causa.id}`;
      },
      keydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          location.hash = `#causas/${causa.id}`;
        }
      },
    } : {},
  }, [
    el('div.hoy-foco-cuerpo', {}, [
      eyebrowText && el('div.hoy-foco-eyebrow', { text: eyebrowText }),
      tarea.horaVencimiento && el('div.hoy-foco-hora.tabular', { text: tarea.horaVencimiento }),
      el('div.hoy-foco-titulo', {}, [
        el('span', { text: tarea.titulo }),
        tarea.esEjemplo && el('span.badge-ejemplo', { text: 'ejemplo' }),
      ]),
      meta && el('div.hoy-foco-meta', { text: meta }),
    ]),
    el('button.hoy-foco-completar', {
      type: 'button',
      aria: { label: `Marcar "${tarea.titulo}" como completada` },
      on: { click: (e) => { e.stopPropagation(); completar(tarea, onChange); } },
    }, [icon('check', { size: 22 })]),
  ]);
}

// ===== Empty state =====
// El set rotativo de frases llega en el commit siguiente.
function renderEmptyState() {
  return el('section.hoy-empty', {}, [
    el('p.hoy-empty-frase', {
      text: 'Sin urgencias por delante. Buen momento para mirar las causas con calma.',
    }),
    el('a.btn.btn-secondary', { href: '#hoy/todas', text: 'Capturar algo' }),
  ]);
}

// ===== Helpers =====

function porFechaHora(a, b) {
  const af = a.fechaVencimiento || '9999-12-31';
  const bf = b.fechaVencimiento || '9999-12-31';
  if (af !== bf) return af.localeCompare(bf);
  return (a.horaVencimiento || '99:99').localeCompare(b.horaVencimiento || '99:99');
}

function isoDelta(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toISO(d);
}

async function completar(tarea, onChange) {
  await db.tareas.complete(tarea.id, true);
  toast(`"${truncar(tarea.titulo, 40)}" completada`, {
    dur: 5000,
    action: {
      label: 'Deshacer',
      onClick: async () => { await db.tareas.complete(tarea.id, false); onChange(); },
    },
  });
  setTimeout(onChange, 280);
}

function truncar(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
