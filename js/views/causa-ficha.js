// Ficha de causa — secciones colapsables: Datos / Tareas / Hitos / Notas.

import db from '../db.js';
import { el, mount, toast, debounce, confirmar } from '../lib/render.js';
import { icon } from '../lib/icons.js';
import { semaforo, formatoCorto, formatoLargo } from '../lib/fechas.js';
import { openAccionesMenu } from './tarea-actions.js';

const PARTE_LABELS = {
  demandante: 'Demandante',
  demandado: 'Demandado',
  querellante: 'Querellante',
  otro: 'Otro',
};

const ETAPA_LABELS = {
  'discusión': 'Discusión',
  'prueba': 'Prueba',
  'sentencia': 'Sentencia',
  'recursos': 'Recursos',
  'ejecución': 'Ejecución',
};

const MATERIA_LABELS = {
  civil: 'Civil', familia: 'Familia', laboral: 'Laboral',
  penal: 'Penal', cobranza: 'Cobranza', otro: 'Otro',
};

const TIPO_HITO_LABELS = {
  notificacion: 'Notificación',
  audiencia: 'Audiencia',
  escrito: 'Escrito',
  resolucion: 'Resolución',
  otro: 'Otro',
};

export default async function renderFicha(root, { id }) {
  const causa = await db.causas.get(id);
  if (!causa) {
    mount(root, el('div.app-container', { style: { paddingTop: 'var(--space-5)' } }, [
      el('div.empty-state', {}, [
        el('p.empty-message', { text: 'Esta causa no existe o fue eliminada.' }),
        el('a.btn.btn-secondary', { href: '#causas', text: 'Volver a causas' }),
      ]),
    ]));
    return;
  }

  const [tareas, hitos] = await Promise.all([
    db.tareas.listByCausa(id),
    db.hitos.listByCausa(id),
  ]);

  const view = el('div.view-ficha.app-container', {
    dataset: { materia: causa.materia || 'otro' },
  }, [
    el('header.ficha-header', {}, [
      el('a.ficha-back', {
        href: '#causas', aria: { label: 'Volver a causas' },
      }, [icon('arrowLeft', { size: 22 })]),
      el('div', { style: { flex: '1' } }),
      el('button.btn-icon', {
        type: 'button', aria: { label: 'Más acciones' },
        on: { click: () => menuAcciones(causa) },
      }, [icon('moreVertical', { size: 22 })]),
    ]),
    el('div.ficha-eyebrow', {
      text: `${(MATERIA_LABELS[causa.materia] || causa.materia || 'Otro')}${causa.rol ? ' · ' + causa.rol : ''}`,
    }),
    el('h1.ficha-titulo', { text: causa.caratulado || '(sin caratulado)' }),
    causa.tribunal && el('div.ficha-rol', { text: causa.tribunal }),

    el('div.ficha-section', {}, [
      renderDatos(causa),
      renderTareasSection(causa, tareas),
      renderHitosSection(causa, hitos),
      renderNotasSection(causa),
    ]),
  ]);

  mount(root, view);

  function refresh() { renderFicha(root, { id }); }

  // ===== Sección Datos =====
  function renderDatos(c) {
    const datos = [
      ['Materia', MATERIA_LABELS[c.materia] || c.materia],
      ['Etapa', ETAPA_LABELS[c.etapa] || c.etapa],
      ['Parte representada', PARTE_LABELS[c.parteRepresentada] || c.parteRepresentada],
      ['Contraparte', c.contraparte],
      ['Honorarios', formatoHonorarios(c.honorarios, c.notasHonorarios)],
    ];

    const ojvBtn = el('a.btn.btn-secondary', {
      href: c.urlOJV || 'https://oficinajudicialvirtual.pjud.cl/',
      target: '_blank',
      rel: 'noopener noreferrer',
      style: { width: '100%', marginTop: 'var(--space-3)' },
    }, [icon('externalLink', { size: 18 }), el('span', { text: 'Abrir en OJV' })]);

    const editBtn = el('a.btn.btn-ghost', {
      href: `#causas/${c.id}/editar`,
      style: { width: '100%' },
    }, [icon('edit', { size: 18 }), el('span', { text: 'Editar datos' })]);

    return el('details.collapsible', { open: true }, [
      el('summary', { text: 'Datos generales' }),
      el('div.body', {}, [
        ...datos.map(([label, value]) =>
          el('div.dato-row', {}, [
            el('div.dato-label', { text: label }),
            el(value ? 'div.dato-value' : 'div.dato-value.empty', {
              text: value || 'Sin información',
            }),
          ])
        ),
        ojvBtn,
        editBtn,
      ]),
    ]);
  }

  // ===== Sección Tareas =====
  function renderTareasSection(c, tareasList) {
    const pendientes = tareasList.filter((t) => !t.completada);
    const completadas = tareasList.filter((t) => t.completada);

    const items = [];
    if (pendientes.length === 0 && completadas.length === 0) {
      items.push(el('p', {
        text: 'Sin tareas en esta causa.',
        style: { color: 'var(--text-tertiary)' },
      }));
    } else {
      items.push(...pendientes.map((t) => renderTareaItem(t, refresh)));
      if (completadas.length > 0) {
        items.push(
          el('details', { style: { marginTop: 'var(--space-3)' } }, [
            el('summary', {
              text: `Completadas (${completadas.length})`,
              style: { color: 'var(--text-tertiary)', cursor: 'pointer', padding: 'var(--space-2) 0' },
            }),
            el('div.stack-tight', {}, completadas.map((t) => renderTareaItem(t, refresh))),
          ])
        );
      }
    }

    items.push(
      el('a.btn.btn-secondary', {
        href: `#tareas/nueva?causa=${c.id}`,
        style: { width: '100%', marginTop: 'var(--space-3)' },
      }, [icon('plus', { size: 18 }), el('span', { text: 'Nueva tarea' })])
    );

    return el('details.collapsible', { open: pendientes.length > 0 }, [
      el('summary', { text: `Tareas (${pendientes.length})` }),
      el('div.body.stack-tight', {}, items),
    ]);
  }

  // ===== Sección Hitos =====
  function renderHitosSection(c, hitosList) {
    const items = hitosList.length === 0
      ? [el('p', {
          text: 'Sin hitos registrados todavía.',
          style: { color: 'var(--text-tertiary)' },
        })]
      : [el('div.timeline', {}, hitosList.map((h) =>
          el('div.timeline-item', {}, [
            el('div.timeline-fecha', { text: formatoCorto(h.fecha) }),
            el('div.timeline-tipo', { text: TIPO_HITO_LABELS[h.tipo] || h.tipo }),
            el('div.timeline-desc', { text: h.descripcion || '(sin descripción)' }),
          ])
        ))];

    items.push(
      el('button.btn.btn-secondary', {
        type: 'button',
        style: { width: '100%', marginTop: 'var(--space-3)' },
        on: { click: () => abrirNuevoHito(c.id, refresh) },
      }, [icon('plus', { size: 18 }), el('span', { text: 'Nuevo hito' })])
    );

    return el('details.collapsible', {}, [
      el('summary', { text: `Hitos (${hitosList.length})` }),
      el('div.body', {}, items),
    ]);
  }

  // ===== Sección Notas =====
  function renderNotasSection(c) {
    const indicator = el('span.save-indicator', { text: 'Guardado' });
    const textarea = el('textarea.textarea', {
      value: c.notas || '',
      placeholder: 'Notas libres sobre esta causa…',
      rows: '6',
      aria: { label: 'Notas de la causa' },
      on: {
        input: debounce(async (e) => {
          await db.causas.update(c.id, { notas: e.target.value });
          indicator.classList.add('visible');
          setTimeout(() => indicator.classList.remove('visible'), 1500);
        }, 1500),
        blur: async (e) => {
          await db.causas.update(c.id, { notas: e.target.value });
          indicator.classList.add('visible');
          setTimeout(() => indicator.classList.remove('visible'), 1500);
        },
      },
    });

    return el('details.collapsible', {}, [
      el('summary', { text: 'Notas' }),
      el('div.body', {}, [
        textarea,
        el('div', { style: { textAlign: 'right', marginTop: 'var(--space-1)' } }, [indicator]),
      ]),
    ]);
  }
}

// ===== Helpers =====
function formatoHonorarios(h, notas) {
  if (!h || (!h.monto && !notas)) return '';
  const moneda = h.moneda || 'CLP';
  let str = '';
  if (h.tipo === 'porcentaje') str = `${h.monto}%`;
  else if (h.monto) str = `${moneda === 'UF' ? 'UF ' : '$'}${h.monto.toLocaleString('es-CL')}`;
  if (notas) str += str ? ` — ${notas}` : notas;
  return str;
}

function renderTareaItem(t, onChange) {
  const sem = t.fechaVencimiento ? semaforo(t.fechaVencimiento) : null;
  const tieneSubs = Array.isArray(t.subtareas) && t.subtareas.length > 0;
  const subDone = tieneSubs ? t.subtareas.filter((s) => s.completada).length : 0;
  const subTotal = tieneSubs ? t.subtareas.length : 0;
  const subComplete = tieneSubs && subDone === subTotal;

  const card = el('article', {
    class: t.completada ? 'tarea-row done' : 'tarea-row',
  }, [
    el('button', {
      class: t.completada ? 'tarea-checkbox checked' : 'tarea-checkbox',
      type: 'button',
      aria: { label: t.completada ? 'Marcar como pendiente' : 'Marcar como completada' },
      on: {
        click: async (e) => {
          const cardNode = e.currentTarget.closest('.tarea-row');
          if (cardNode && !t.completada) cardNode.classList.add('completing');
          await db.tareas.complete(t.id, !t.completada);
          if (!t.completada) {
            toast(`"${truncate(t.titulo, 40)}" completada`, {
              dur: 5000,
              action: { label: 'Deshacer', onClick: async () => { await db.tareas.complete(t.id, false); onChange(); } },
            });
          }
          setTimeout(onChange, 220);
        },
      },
    }, [t.completada ? icon('check', { size: 18 }) : null]),
    el('div.tarea-content', {}, [
      el('div.tarea-titulo', {}, [
        el('span', { text: t.titulo }),
        tieneSubs && el('span', {
          class: `tarea-subprogress${subComplete ? ' complete' : ''}`,
          text: `${subDone}/${subTotal}`,
        }),
      ]),
      el('div.tarea-meta', {}, [
        sem && el('span', { class: `semaforo ${sem.class}`, text: (sem.label || '').toLowerCase() }),
        t.fechaVencimiento && el('span', { text: formatoCorto(t.fechaVencimiento) }),
        t.horaVencimiento && el('span.tabular', { text: t.horaVencimiento }),
      ]),
    ]),
    el('button.tarea-actions', {
      type: 'button',
      aria: { label: `Acciones para "${t.titulo}"` },
      on: { click: (e) => { e.stopPropagation(); openAccionesMenu(t.id, onChange, e.currentTarget); } },
    }, [icon('moreVertical', { size: 18 })]),
  ]);
  return card;
}

function truncate(s, n) {
  return s && s.length > n ? s.slice(0, n - 1) + '…' : (s || '');
}

// ===== Menú de acciones (archivar / eliminar) =====
async function menuAcciones(causa) {
  const { modal } = await import('../lib/render.js');
  let close;
  const content = el('div.stack', {}, [
    el('div.modal-header', {}, [
      el('div.modal-title', { text: 'Acciones' }),
      el('button.btn-icon', {
        type: 'button', aria: { label: 'Cerrar' },
        on: { click: () => close() },
      }, [icon('x', { size: 22 })]),
    ]),
    el('a.btn.btn-secondary.btn-block', {
      href: `#causas/${causa.id}/editar`,
      on: { click: () => close() },
    }, [icon('edit', { size: 18 }), el('span', { text: 'Editar' })]),
    el('button.btn.btn-secondary.btn-block', {
      type: 'button',
      on: { click: async () => {
        await db.causas.archive(causa.id, !causa.archivada);
        close();
        toast(causa.archivada ? 'Causa restaurada' : 'Causa archivada');
        location.hash = '#causas';
      } },
    }, [icon('archive', { size: 18 }), el('span', { text: causa.archivada ? 'Restaurar' : 'Archivar' })]),
    el('button.btn.btn-danger.btn-block', {
      type: 'button',
      on: { click: async () => {
        close();
        const ok = await confirmar({
          titulo: 'Eliminar causa',
          mensaje: `Se eliminará "${causa.caratulado}" junto con todas sus tareas e hitos. Esta acción no se puede deshacer.`,
          confirmLabel: 'Eliminar',
          destructive: true,
        });
        if (ok) {
          await db.causas.delete(causa.id);
          toast('Causa eliminada');
          location.hash = '#causas';
        }
      } },
    }, [icon('trash', { size: 18 }), el('span', { text: 'Eliminar' })]),
  ]);
  close = modal(content, { ariaLabel: 'Acciones de causa' });
}

async function abrirNuevoHito(causaId, onSaved) {
  const { modal } = await import('../lib/render.js');
  const { hoyISO } = await import('../lib/fechas.js');
  let close;

  const fechaInput = el('input.input', { type: 'date', value: hoyISO() });
  const tipoSelect = el('select.select', {}, [
    ['notificacion', 'Notificación'],
    ['audiencia', 'Audiencia'],
    ['escrito', 'Escrito'],
    ['resolucion', 'Resolución'],
    ['otro', 'Otro'],
  ].map(([v, t]) => el('option', { value: v, text: t })));
  const descInput = el('textarea.textarea', { rows: '3', placeholder: 'Descripción breve…' });

  const content = el('form.stack', {
    on: { submit: async (e) => {
      e.preventDefault();
      await db.hitos.create({
        causaId,
        fecha: fechaInput.value,
        tipo: tipoSelect.value,
        descripcion: descInput.value.trim(),
      });
      close();
      toast('Hito agregado');
      onSaved();
    } },
  }, [
    el('div.modal-header', {}, [
      el('div.modal-title', { text: 'Nuevo hito' }),
      el('button.btn-icon', {
        type: 'button', aria: { label: 'Cerrar' },
        on: { click: () => close() },
      }, [icon('x', { size: 22 })]),
    ]),
    el('div.field', {}, [el('label.label', { text: 'Fecha' }), fechaInput]),
    el('div.field', {}, [el('label.label', { text: 'Tipo' }), tipoSelect]),
    el('div.field', {}, [el('label.label', { text: 'Descripción' }), descInput]),
    el('button.btn.btn-primary.btn-block', { type: 'submit', text: 'Guardar' }),
  ]);

  close = modal(content, { ariaLabel: 'Nuevo hito' });
}
