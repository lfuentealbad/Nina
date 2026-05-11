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

  // Selector de causa con autocompletado (mejor en mobile que un select nativo).
  let causaIdSel = tarea.causaId || null;
  const seleccionInicial = causaIdSel ? causas.find((c) => c.id === causaIdSel) : null;
  const causaInput = el('input.input', {
    type: 'text', id: 'f-causa',
    placeholder: 'Buscar causa por caratulado, rol o contraparte (opcional)',
    autocomplete: 'off',
    value: seleccionInicial
      ? (seleccionInicial.caratulado || seleccionInicial.rol || '')
      : '',
    on: {
      input: () => mostrarSugerencias(),
      focus: () => mostrarSugerencias(),
      blur: () => setTimeout(() => { sugerenciasBox.hidden = true; }, 180),
    },
  });
  const limpiarBtn = el('button.causa-clear', {
    type: 'button',
    'aria-label': 'Quitar causa seleccionada',
    hidden: !causaIdSel,
    on: { click: () => {
      causaIdSel = null;
      causaInput.value = '';
      limpiarBtn.hidden = true;
      causaInput.focus();
      mostrarSugerencias();
    } },
  }, [icon('x', { size: 16 })]);
  const sugerenciasBox = el('div.causa-sugerencias', { hidden: true });

  function mostrarSugerencias() {
    const q = causaInput.value.toLowerCase().trim();
    const matches = (!q
      ? causas.slice(0, 6)
      : causas.filter((c) =>
          (c.caratulado || '').toLowerCase().includes(q) ||
          (c.rol || '').toLowerCase().includes(q) ||
          (c.contraparte || '').toLowerCase().includes(q)
        ).slice(0, 6)
    );
    if (matches.length === 0) { sugerenciasBox.hidden = true; return; }
    sugerenciasBox.replaceChildren(...matches.map((c) =>
      el('button.causa-sugerencia', {
        type: 'button',
        on: { click: () => seleccionarCausa(c) },
      }, [
        el('div.causa-sugerencia-tit', { text: c.caratulado || '(sin caratulado)' }),
        (c.rol || c.contraparte) && el('div.causa-sugerencia-meta', {
          text: [c.rol, c.contraparte].filter(Boolean).join(' · '),
        }),
      ])
    ));
    sugerenciasBox.hidden = false;
  }

  function seleccionarCausa(c) {
    causaIdSel = c.id;
    causaInput.value = c.caratulado || c.rol || '';
    sugerenciasBox.hidden = true;
    limpiarBtn.hidden = false;
  }

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
          el('div.causa-picker', {}, [causaInput, limpiarBtn]),
          sugerenciasBox,
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
      causaId: causaInput.value.trim() ? causaIdSel : null,
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
