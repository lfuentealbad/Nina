// Formulario nueva/editar tarea. Mínimo viable: título + fecha (opcional) + causa (opcional).
// Resto plegado (descripción, prioridad, tipo, hora).

import db from '../db.js';
import { el, mount, toast, confirmar } from '../lib/render.js';
import { icon } from '../lib/icons.js';
import { hoyISO } from '../lib/fechas.js';
import { ofrecerBorrarEjemplosSiPrimerRegistroPropio } from '../lib/datos-ejemplo.js';

const TIPOS = [
  ['gestion', 'Gestión'],
  ['plazo', 'Plazo'],
  ['escrito', 'Escrito'],
  ['audiencia', 'Audiencia'],
  ['personal', 'Personal'],
];
const PRIORIDADES = [
  ['baja', 'Baja'],
  ['media', 'Media'],
  ['alta', 'Alta'],
];

function parseQuery(hash) {
  const i = hash.indexOf('?');
  if (i < 0) return {};
  return Object.fromEntries(new URLSearchParams(hash.slice(i + 1)));
}

export default async function renderTareaForm(root, { id } = {}) {
  const editing = !!id;
  const query = parseQuery(location.hash);
  const tarea = editing
    ? await db.tareas.get(id)
    : {
        causaId: query.causa || null,
        titulo: '', descripcion: '', tipo: 'gestion',
        fechaVencimiento: null, horaVencimiento: null,
        prioridad: 'media',
      };

  if (editing && !tarea) {
    mount(root, el('div.app-container', {}, [
      el('div.empty-state', {}, [
        el('p.empty-message', { text: 'Esta tarea no existe.' }),
        el('a.btn.btn-secondary', { href: '#hoy', text: 'Volver a Hoy' }),
      ]),
    ]));
    return;
  }

  const causas = await db.causas.list({ archivada: false });

  const tituloInput = el('input.input', {
    type: 'text', value: tarea.titulo, id: 'f-titulo',
    autocomplete: 'off', required: true,
  });
  const tituloErr = el('p.error', { hidden: true });

  const causaSelect = el('select.select', { id: 'f-causa' }, [
    el('option', { value: '', text: 'Sin causa específica' }),
    ...causas.map((c) =>
      el('option', { value: c.id, text: c.caratulado || `(${c.rol || 'sin rol'})`, selected: c.id === tarea.causaId })
    ),
  ]);

  const fechaInput = el('input.input', {
    type: 'date', value: tarea.fechaVencimiento || '', id: 'f-fecha',
  });
  const horaInput = el('input.input.tabular', {
    type: 'time', value: tarea.horaVencimiento || '', id: 'f-hora',
  });
  const tipoSelect = el('select.select', { id: 'f-tipo' },
    TIPOS.map(([v, t]) => el('option', { value: v, text: t, selected: v === tarea.tipo }))
  );
  const prioridadSelect = el('select.select', { id: 'f-prio' },
    PRIORIDADES.map(([v, t]) => el('option', { value: v, text: t, selected: v === tarea.prioridad }))
  );
  const descTextarea = el('textarea.textarea', { id: 'f-desc', value: tarea.descripcion, rows: '3' });

  const backHref = tarea.causaId ? `#causas/${tarea.causaId}` : '#hoy';

  const view = el('div.view-form.app-container', {}, [
    el('header.ficha-header', {}, [
      el('a.ficha-back', { href: backHref, aria: { label: 'Volver' } }, [icon('arrowLeft', { size: 22 })]),
      el('h1.ficha-titulo', { text: editing ? 'Editar tarea' : 'Nueva tarea' }),
    ]),

    el('form.stack-loose', { on: { submit: (e) => { e.preventDefault(); guardar(); } } }, [
      // Esenciales
      el('div.stack', {}, [
        el('div.field', {}, [
          el('label.label', { for: 'f-titulo' }, ['Título', el('span.required', { text: '*' })]),
          tituloInput,
          tituloErr,
        ]),
        el('div.field', {}, [
          el('label.label', { for: 'f-fecha', text: 'Cuándo' }),
          fechaInput,
          el('p.helper', { text: 'Sin fecha = bandeja de entrada' }),
        ]),
        el('div.field', {}, [
          el('label.label', { for: 'f-causa', text: 'Causa relacionada' }),
          causaSelect,
        ]),
      ]),

      // Detalles plegados
      el('details.collapsible', {}, [
        el('summary', { text: 'Más detalles' }),
        el('div.body.stack', {}, [
          el('div.field', {}, [el('label.label', { for: 'f-tipo', text: 'Tipo' }), tipoSelect]),
          el('div.field', {}, [el('label.label', { for: 'f-hora', text: 'Hora' }), horaInput]),
          el('div.field', {}, [el('label.label', { for: 'f-prio', text: 'Prioridad' }), prioridadSelect]),
          el('div.field', {}, [el('label.label', { for: 'f-desc', text: 'Descripción' }), descTextarea]),
        ]),
      ]),

      el('div.form-actions', {}, [
        el('a.btn.btn-ghost', { href: backHref, text: 'Cancelar' }),
        editing && el('button.btn.btn-danger', {
          type: 'button', text: 'Eliminar',
          on: { click: async () => {
            const ok = await confirmar({
              titulo: 'Eliminar tarea',
              mensaje: `Se eliminará "${tarea.titulo}".`,
              confirmLabel: 'Eliminar', destructive: true,
            });
            if (ok) {
              await db.tareas.delete(id);
              toast('Tarea eliminada');
              location.hash = backHref;
            }
          } },
        }),
        el('button.btn.btn-primary', { type: 'submit', text: editing ? 'Guardar' : 'Crear' }),
      ]),
    ]),
  ]);

  mount(root, view);
  if (!editing) requestAnimationFrame(() => tituloInput.focus());

  tituloInput.addEventListener('blur', () => {
    if (!tituloInput.value.trim()) {
      tituloErr.textContent = 'El título es obligatorio';
      tituloErr.hidden = false;
      tituloInput.style.borderColor = 'var(--status-urgent)';
    } else {
      tituloErr.hidden = true;
      tituloInput.style.borderColor = '';
    }
  });

  async function guardar() {
    const titulo = tituloInput.value.trim();
    if (!titulo) {
      tituloErr.textContent = 'El título es obligatorio';
      tituloErr.hidden = false;
      tituloInput.style.borderColor = 'var(--status-urgent)';
      tituloInput.focus();
      return;
    }
    const data = {
      titulo,
      descripcion: descTextarea.value.trim(),
      tipo: tipoSelect.value,
      fechaVencimiento: fechaInput.value || null,
      horaVencimiento: horaInput.value || null,
      prioridad: prioridadSelect.value,
      causaId: causaSelect.value || null,
    };

    if (editing) {
      await db.tareas.update(id, data);
      toast('Tarea actualizada');
    } else {
      await db.tareas.create(data);
      toast('Tarea creada');
      ofrecerBorrarEjemplosSiPrimerRegistroPropio(db, toast);
    }
    location.hash = backHref;
  }
}
