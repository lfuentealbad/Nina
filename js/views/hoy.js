// Vista Hoy — Editorial calm v2.
// Una pregunta: "¿qué hago ahora?". Una respuesta: el hero card.
// Todo lo demás es soporte secundario, no compite por atención.

import db from '../db.js';
import { el, mount, toast } from '../lib/render.js';
import { icon } from '../lib/icons.js';
import { illustration } from '../lib/illustrations.js';
import { hoyISO, formatoLargo, semaforo, saludoPorHora } from '../lib/fechas.js';
import { openAccionesMenu, openRevisionDelDia } from './tarea-actions.js';

export default async function renderHoy(root) {
  const [audiencias, plazos, inbox] = await Promise.all([
    db.tareas.audienciasToday(),
    db.tareas.plazosHoyManana(),
    db.tareas.inbox(),
  ]);

  const excludeIds = [...audiencias, ...plazos].map((t) => t.id);
  const microtareas = await db.tareas.nextMicrotasks(3, excludeIds);

  // Combinar plazos + microtareas en una sola lista — "una pregunta por pantalla".
  const porHacer = [...plazos, ...microtareas];

  const proximo = await pickProximo(audiencias, plazos);
  const nombre = localStorage.getItem('nombre') || 'Nina';

  // Mostrar "Revisar día" si hay pendientes hoy y son después de las 16:00 (señal del fin de jornada)
  const hour = new Date().getHours();
  const planeadasHoy = await db.tareas.dueToday();
  const showRevisarDia = hour >= 16 && planeadasHoy.length > 0;

  const view = el('div.view-hoy.app-container', {}, [
    // Hero: "hoy."
    el('header.hoy-hero', {}, [
      el('h1.hoy-display', { text: 'hoy' }),
      el('p.hoy-fecha', { text: formatoLargo(hoyISO()) }),
      showRevisarDia && el('div', { style: { marginTop: 'var(--space-4)' } }, [
        el('button.daily-review-cta', {
          type: 'button',
          on: { click: () => openRevisionDelDia(() => refresh()) },
        }, [icon('moon', { size: 16 }), el('span', { text: 'Revisar día' })]),
      ]),
    ]),

    // Hero card — la respuesta principal
    proximo && renderProximo(proximo),

    // Quick action discreta — para crear tarea con fecha sin pasar por bandeja
    renderQuickActions(),

    // Lista única "Más por hacer" — combina plazos + microtareas
    porHacer.length > 0
      ? renderPorHacer(porHacer, () => refresh())
      : renderEmptyDay(),

    // Bandeja al pie
    inbox.length > 0 && renderInboxLink(inbox.length),
  ]);

  mount(root, view);
  function refresh() { renderHoy(root); }
}

// Selecciona el "siguiente" más relevante.
async function pickProximo(audiencias, plazos) {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const audienciasFuturas = audiencias
    .filter((a) => {
      if (!a.horaVencimiento) return false;
      const [h, m] = a.horaVencimiento.split(':').map(Number);
      return (h * 60 + m) >= nowMin;
    })
    .sort((a, b) => (a.horaVencimiento || '').localeCompare(b.horaVencimiento || ''));

  if (audienciasFuturas[0]) {
    const causa = audienciasFuturas[0].causaId
      ? await db.causas.get(audienciasFuturas[0].causaId)
      : null;
    return { tipo: 'audiencia', tarea: audienciasFuturas[0], causa };
  }

  const plazoHoy = plazos.find((t) => t.fechaVencimiento === hoyISO());
  if (plazoHoy) {
    const causa = plazoHoy.causaId ? await db.causas.get(plazoHoy.causaId) : null;
    return { tipo: 'plazo', tarea: plazoHoy, causa };
  }

  return null;
}

function renderProximo({ tipo, tarea, causa }) {
  const isAudiencia = tipo === 'audiencia';
  const eyebrow = isAudiencia ? 'Próxima audiencia' : 'Hoy';

  const meta = causa
    ? `${causa.caratulado || causa.rol || ''}${causa.tribunal ? ' · ' + causa.tribunal : ''}`
    : '';

  return el('section.hoy-next', {
    role: 'button',
    tabindex: causa ? '0' : null,
    on: causa ? {
      click: () => { location.hash = `#causas/${causa.id}`; },
      keydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          location.hash = `#causas/${causa.id}`;
        }
      },
    } : {},
  }, [
    el('div.hoy-next-eyebrow', { text: eyebrow }),
    // Hora prominente solo para audiencias. Para plazos hoy, omitir (eyebrow ya dice "Hoy").
    isAudiencia && el('div.hoy-next-hora.tabular', { text: tarea.horaVencimiento || '—' }),
    el('div.hoy-next-titulo', {}, [
      el('span', { text: tarea.titulo }),
      tarea.esEjemplo && el('span.badge-ejemplo', { text: 'ejemplo' }),
    ]),
    meta && el('div.hoy-next-meta', { text: meta }),
  ]);
}

// Quick actions visibles — reduce activation energy para crear tareas con fecha
function renderQuickActions() {
  return el('div.hoy-quick', {}, [
    el('a.hoy-quick-link', { href: '#tareas/nueva' }, [
      icon('plus', { size: 16 }),
      el('span', { text: 'Tarea con fecha' }),
    ]),
    el('a.hoy-quick-link', { href: '#causas/nueva' }, [
      icon('folder', { size: 16 }),
      el('span', { text: 'Nueva causa' }),
    ]),
  ]);
}

function renderPorHacer(tareas, onChange) {
  return el('section.hoy-section', {}, [
    el('h2.hoy-section-eyebrow', { text: 'Más por hacer' }),
    el('div', {}, tareas.map((t) => renderTareaRow(t, onChange))),
  ]);
}

function renderEmptyDay() {
  return el('section.hoy-section', {}, [
    el('div.empty-state', {}, [
      illustration('sun'),
      el('p.empty-message', { text: 'vas al día' }),
      el('a', {
        class: 'btn btn-secondary',
        href: '#causas',
        text: 'Revisar causas',
      }),
    ]),
  ]);
}

function renderTareaRow(t, onChange) {
  const sem = t.fechaVencimiento ? semaforo(t.fechaVencimiento) : null;
  const tieneSubs = Array.isArray(t.subtareas) && t.subtareas.length > 0;
  const subDone = tieneSubs ? t.subtareas.filter((s) => s.completada).length : 0;
  const subTotal = tieneSubs ? t.subtareas.length : 0;
  const subComplete = tieneSubs && subDone === subTotal;

  return el('article.tarea-row', {}, [
    el('button.tarea-checkbox', {
      type: 'button',
      aria: { label: `Marcar "${t.titulo}" como completada` },
      on: { click: (e) => completar(t, e.currentTarget.closest('.tarea-row'), onChange) },
    }),
    el('div.tarea-content', {}, [
      el('div.tarea-titulo', {}, [
        el('span', { text: t.titulo }),
        tieneSubs && el('span', {
          class: `tarea-subprogress${subComplete ? ' complete' : ''}`,
          text: `${subDone}/${subTotal}`,
        }),
        t.esEjemplo && el('span.badge-ejemplo', { text: 'ejemplo' }),
      ]),
      el('div.tarea-meta', {}, [
        sem && el('span', { class: `semaforo ${sem.class}`, text: sem.label.toLowerCase() }),
        t.horaVencimiento && el('span.tabular', { text: t.horaVencimiento }),
      ]),
    ]),
    el('button.tarea-actions', {
      type: 'button',
      aria: { label: `Más acciones para "${t.titulo}"` },
      on: { click: (e) => { e.stopPropagation(); openAccionesMenu(t.id, onChange, e.currentTarget); } },
    }, [icon('moreVertical', { size: 18 })]),
  ]);
}

function renderInboxLink(count) {
  return el('button.inbox-link', {
    type: 'button',
    aria: { label: `Bandeja de entrada: ${count} sin fecha` },
    on: { click: () => openInboxModal() },
  }, [
    el('span', { text: 'En tu bandeja:' }),
    el('span.count.tabular', { text: String(count) }),
    el('span', { text: count === 1 ? 'tarea sin fecha →' : 'tareas sin fecha →' }),
  ]);
}

async function completar(tarea, cardNode, onChange) {
  if (cardNode) cardNode.classList.add('completing');
  await db.tareas.complete(tarea.id, true);
  toast(`"${truncate(tarea.titulo, 40)}" completada`, {
    dur: 5000,
    action: {
      label: 'Deshacer',
      onClick: async () => { await db.tareas.complete(tarea.id, false); onChange(); },
    },
  });
  setTimeout(onChange, 280);
}

function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

async function openInboxModal() {
  const { openInboxRevision } = await import('./captura-rapida.js');
  openInboxRevision();
}
