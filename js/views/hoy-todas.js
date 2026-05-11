// Vista #hoy/todas — lista vertical limpia de pendientes próximos.
//
// Incluye: tareas con fecha en próximos 7 días (orden cronológico) +
// sección "sin fecha" al final con acceso al modal de revisión de bandeja.
//
// Cada fila tiene checkbox circular, punto del semáforo, título, causa
// abreviada, hora a la derecha. Sin botón "···", sin chips, sin badges
// de subtareas. Al completar: fade-out + toast con deshacer.

import db from '../db.js';
import { el, mount, toast } from '../lib/render.js';
import { icon } from '../lib/icons.js';
import { hoyISO, toISO, formatoCorto, semaforo } from '../lib/fechas.js';
import { openInboxRevision } from './captura-rapida.js';

export default async function renderHoyTodas(root) {
  const view = el('div.view-hoy-todas.app-container', {}, []);
  mount(root, view);
  await refresh(view);
}

async function refresh(view) {
  const todas = await db.tareas.list();
  const activas = todas.filter((t) => !t.completada && !t.vencida);

  const hoy = hoyISO();
  const tope = isoDelta(7);

  const conFecha = activas
    .filter((t) => t.fechaVencimiento && t.fechaVencimiento >= hoy && t.fechaVencimiento <= tope)
    .sort(porFechaHora);

  const sinFecha = activas
    .filter((t) => !t.fechaVencimiento)
    .sort((a, b) => (a.creadaEn || '').localeCompare(b.creadaEn || ''));

  // Recolectar las causas que aparecen, en un solo viaje a la BD.
  const causaIds = [...new Set([...conFecha, ...sinFecha].map((t) => t.causaId).filter(Boolean))];
  const causasMap = new Map();
  for (const id of causaIds) {
    const c = await db.causas.get(id);
    if (c) causasMap.set(id, c);
  }

  view.replaceChildren(
    el('header.todas-encabezado', {}, [
      el('a.todas-volver', { href: '#hoy', aria: { label: 'Volver a Hoy' } }, [
        icon('arrowLeft', { size: 20 }),
        el('span', { text: 'Hoy' }),
      ]),
      el('h1.todas-titulo', { text: 'Próximas' }),
    ]),

    conFecha.length === 0 && sinFecha.length === 0
      ? renderEmpty()
      : el('div', {}, [
          conFecha.length > 0 && el('ul.todas-lista', {},
            conFecha.map((t) => renderFila(t, causasMap, () => refresh(view)))
          ),

          sinFecha.length > 0 && el('section.todas-seccion', {}, [
            el('div.todas-seccion-eyebrow', { text: 'Sin fecha' }),
            el('ul.todas-lista', {},
              sinFecha.map((t) => renderFila(t, causasMap, () => refresh(view)))
            ),
            el('button.btn.btn-secondary.btn-block', {
              type: 'button',
              style: { marginTop: 'var(--space-4)' },
              on: { click: () => openInboxRevision() },
            }, [el('span', { text: 'Revisar una a una' })]),
          ]),
        ]),
  );
}

function renderFila(t, causasMap, onChange) {
  const causa = t.causaId ? causasMap.get(t.causaId) : null;
  const sem = t.fechaVencimiento ? semaforo(t.fechaVencimiento) : null;

  const li = el('li.todas-fila', {
    class: `todas-fila ${sem?.class || 'sin-fecha'}`,
  }, [
    el('button.todas-check', {
      type: 'button',
      aria: { label: `Marcar "${t.titulo}" como completada` },
      on: { click: () => completar(li, t, onChange) },
    }),
    el('div.todas-cuerpo', {}, [
      el('div.todas-titulo-row', {}, [
        sem && el('span.sem-dot', { class: `sem-dot ${sem.class}` }),
        sem && el('span.sem-texto', { class: `sem-texto ${sem.class}`, text: sem.label.toLowerCase() }),
        el('span.todas-titulo', { text: t.titulo }),
        t.esEjemplo && el('span.badge-ejemplo', { text: 'ejemplo' }),
      ]),
      causa && el('div.todas-causa', { text: causa.caratulado || causa.rol || '' }),
    ]),
    t.horaVencimiento && el('span.todas-hora.tabular', { text: t.horaVencimiento }),
  ]);
  return li;
}

function renderEmpty() {
  return el('div.empty-state', {}, [
    el('p.empty-message', { text: 'no tienes nada por ahora' }),
    el('a.btn.btn-secondary', { href: '#hoy', text: 'Volver' }),
  ]);
}

async function completar(li, tarea, onChange) {
  li.classList.add('completing');
  await db.tareas.complete(tarea.id, true);
  toast(`"${truncar(tarea.titulo, 40)}" completada`, {
    dur: 5000,
    action: {
      label: 'Deshacer',
      onClick: async () => { await db.tareas.complete(tarea.id, false); onChange(); },
    },
  });
  setTimeout(onChange, 300);
}

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

function truncar(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
