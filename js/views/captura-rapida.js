// Modal de captura rápida — un campo (título) opcional + selector de causa.
// También exporta openInboxRevision para procesar tareas sin fecha.

import db from '../db.js';
import { el, modal, toast } from '../lib/render.js';
import { hoyISO, formatoCorto } from '../lib/fechas.js';
import { icon } from '../lib/icons.js';
import { ofrecerBorrarEjemplosSiPrimerRegistroPropio } from '../lib/datos-ejemplo.js';

/** Abre el modal de captura rápida. Crea una tarea sin fecha (bandeja de entrada). */
export async function openCapturaRapida() {
  const causas = await db.causas.list({ archivada: false });

  let close;

  const tituloInput = el('input.input', {
    type: 'text',
    placeholder: 'Anota lo que tengas en mente…',
    autocomplete: 'off',
    aria: { label: 'Título de tarea' },
    on: {
      keydown: (e) => {
        if (e.key === 'Enter') { e.preventDefault(); guardar(); }
      },
    },
  });

  const causaSelect = el('select.select', {
    aria: { label: 'Causa relacionada (opcional)' },
  }, [
    el('option', { value: '', text: 'Sin causa específica' }),
    ...causas.map((c) =>
      el('option', { value: c.id, text: c.caratulado || `(${c.rol || 'sin rol'})` })
    ),
  ]);

  const content = el('form.stack', {
    on: { submit: (e) => { e.preventDefault(); guardar(); } },
  }, [
    el('div.modal-header', {}, [
      el('div.modal-title', { text: 'Anotar tarea' }),
      el('button.btn-icon', {
        type: 'button',
        aria: { label: 'Cerrar' },
        on: { click: () => close() },
      }, [icon('x', { size: 22 })]),
    ]),
    el('div.field', {}, [tituloInput]),
    el('div.field', {}, [
      el('label.label', { text: 'Causa (opcional)' }),
      causaSelect,
    ]),
    el('p.helper', {
      text: 'Sin fecha: queda en tu bandeja de entrada para procesar después.',
    }),
    el('button.btn.btn-primary.btn-block', {
      type: 'submit', text: 'Guardar',
      style: { marginTop: 'var(--space-3)' },
    }),
  ]);

  close = modal(content, { ariaLabel: 'Captura rápida' });

  async function guardar() {
    const titulo = tituloInput.value.trim();
    if (!titulo) {
      tituloInput.focus();
      return;
    }
    const data = {
      titulo,
      causaId: causaSelect.value || null,
      tipo: 'gestion',
      fechaVencimiento: null,
    };
    await db.tareas.create(data);
    close();
    toast('Anotada en bandeja de entrada');
    ofrecerBorrarEjemplosSiPrimerRegistroPropio(db, toast);
    // Refrescar vista actual si es Hoy.
    if (location.hash === '' || location.hash === '#' || location.hash === '#hoy') {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  }
}

/** Modal de revisión de bandeja de entrada — asignar fecha/causa una a una. */
export async function openInboxRevision() {
  const causas = await db.causas.list({ archivada: false });
  const inbox = await db.tareas.inbox();

  if (inbox.length === 0) {
    toast('Bandeja vacía');
    return;
  }

  let idx = 0;
  let close;

  const container = el('div.stack', {});
  close = modal(container, { ariaLabel: 'Revisión de bandeja de entrada' });

  renderItem();

  function renderItem() {
    const tarea = inbox[idx];
    if (!tarea) {
      close();
      toast('Bandeja procesada');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      return;
    }

    const fechaInput = el('input.input', {
      type: 'date',
      value: hoyISO(),
    });
    const causaSelect = el('select.select', {}, [
      el('option', { value: '', text: 'Sin causa' }),
      ...causas.map((c) =>
        el('option', {
          value: c.id, text: c.caratulado || `(${c.rol || 'sin rol'})`,
          selected: c.id === tarea.causaId,
        })
      ),
    ]);

    const content = el('div.stack', {}, [
      el('div.modal-header', {}, [
        el('div.modal-title', { text: `Bandeja (${idx + 1} de ${inbox.length})` }),
        el('button.btn-icon', {
          type: 'button', aria: { label: 'Cerrar' },
          on: { click: () => close() },
        }, [icon('x', { size: 22 })]),
      ]),

      el('div.card', {}, [
        el('div', { text: tarea.titulo, style: { fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-medium)' } }),
      ]),

      el('div.field', {}, [
        el('label.label', { text: 'Cuándo' }),
        fechaInput,
      ]),
      el('div.field', {}, [
        el('label.label', { text: 'Causa' }),
        causaSelect,
      ]),

      el('div.row', { style: { marginTop: 'var(--space-4)', gap: 'var(--space-2)' } }, [
        el('button.btn.btn-ghost', {
          type: 'button', text: 'Saltar',
          style: { flex: '1' },
          on: { click: () => { idx++; replaceContent(); } },
        }),
        el('button.btn.btn-secondary', {
          type: 'button', text: 'Eliminar',
          style: { flex: '1' },
          on: { click: async () => {
            await db.tareas.delete(tarea.id);
            idx++;
            replaceContent();
          } },
        }),
        el('button.btn.btn-primary', {
          type: 'button', text: 'Guardar',
          style: { flex: '1.4' },
          on: { click: async () => {
            await db.tareas.update(tarea.id, {
              fechaVencimiento: fechaInput.value || null,
              causaId: causaSelect.value || null,
            });
            idx++;
            replaceContent();
          } },
        }),
      ]),
    ]);

    container.replaceChildren(...content.childNodes);
  }

  function replaceContent() {
    renderItem();
  }
}
