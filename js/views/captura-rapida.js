// Modal de captura rápida con parser inline.
// Nina escribe en lenguaje natural ("Audiencia mañana 10am Pérez con Rojas")
// y el parser extrae fecha, hora y tipo en chips editables debajo del input.
// Cada chip se puede borrar con un toque. Botón Guardar siempre habilitado.

import db from '../db.js';
import { el, modal, toast } from '../lib/render.js';
import { hoyISO, formatoCorto } from '../lib/fechas.js';
import { icon } from '../lib/icons.js';
import { parsearCaptura } from '../lib/parser.js';
import { ofrecerBorrarEjemplosSiPrimerRegistroPropio } from '../lib/datos-ejemplo.js';

const ETIQUETAS_TIPO = {
  audiencia: 'audiencia',
  plazo: 'plazo',
  gestion: 'gestión',
};

/** Abre el modal de captura rápida. */
export async function openCapturaRapida() {
  const causas = await db.causas.list({ archivada: false });

  // Estado interno de la captura — el parser lo va alimentando, los chips lo pueden vaciar.
  const estado = {
    titulo: '',
    fechaVencimiento: null,
    horaVencimiento: null,
    tipo: 'gestion',
  };

  let close;
  let timer = null;

  const tituloInput = el('input.input', {
    type: 'text',
    placeholder: 'Anota lo que tengas en mente…',
    autocomplete: 'off',
    aria: { label: 'Captura libre' },
    on: {
      input: () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(reparsear, 500);
      },
      blur: () => {
        if (timer) { clearTimeout(timer); timer = null; }
        reparsear();
      },
      keydown: (e) => {
        if (e.key === 'Enter') { e.preventDefault(); guardar(); }
      },
    },
  });

  const chipsRow = el('div.captura-chips');

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
    el('div.field', {}, [tituloInput, chipsRow]),
    el('div.field', {}, [
      el('label.label', { text: 'Causa (opcional)' }),
      causaSelect,
    ]),
    el('p.helper', {
      text: 'Puedes escribir libre. Si menciono fecha, hora o tipo, lo detecto.',
    }),
    el('button.btn.btn-primary.btn-block', {
      type: 'submit', text: 'Guardar',
      style: { marginTop: 'var(--space-3)' },
    }),
  ]);

  close = modal(content, { ariaLabel: 'Captura rápida' });

  function reparsear() {
    const raw = tituloInput.value;
    if (!raw.trim()) {
      estado.titulo = '';
      estado.fechaVencimiento = null;
      estado.horaVencimiento = null;
      estado.tipo = 'gestion';
      renderChips();
      return;
    }
    const parsed = parsearCaptura(raw);
    estado.titulo = parsed.titulo || raw.trim();
    estado.fechaVencimiento = parsed.fechaVencimiento;
    estado.horaVencimiento = parsed.horaVencimiento;
    estado.tipo = parsed.tipo;
    renderChips();
  }

  function renderChips() {
    const chips = [];
    if (estado.fechaVencimiento) {
      chips.push(chip('📅', formatoCorto(estado.fechaVencimiento), () => {
        estado.fechaVencimiento = null;
        renderChips();
      }));
    }
    if (estado.horaVencimiento) {
      chips.push(chip('🕐', estado.horaVencimiento, () => {
        estado.horaVencimiento = null;
        renderChips();
      }));
    }
    if (estado.tipo && estado.tipo !== 'gestion') {
      chips.push(chip('📋', ETIQUETAS_TIPO[estado.tipo], () => {
        estado.tipo = 'gestion';
        renderChips();
      }));
    }
    chipsRow.replaceChildren(...chips);
  }

  async function guardar() {
    // Asegurar parseo final si el usuario presionó Enter rápido.
    if (timer) { clearTimeout(timer); timer = null; }
    if (!estado.titulo) reparsear();
    if (!estado.titulo) {
      tituloInput.focus();
      return;
    }
    const data = {
      titulo: estado.titulo,
      causaId: causaSelect.value || null,
      tipo: estado.tipo,
      fechaVencimiento: estado.fechaVencimiento,
      horaVencimiento: estado.horaVencimiento,
    };
    await db.tareas.create(data);
    close();
    toast(estado.fechaVencimiento ? 'Tarea guardada' : 'Anotada en bandeja de entrada');
    ofrecerBorrarEjemplosSiPrimerRegistroPropio(db, toast);
    // Refrescar vista actual si es Hoy o lista.
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}

function chip(icono, texto, onRemove) {
  return el('button.captura-chip', {
    type: 'button',
    aria: { label: `Quitar ${texto}` },
    on: { click: onRemove },
  }, [
    el('span.captura-chip-icono', { text: icono }),
    el('span', { text: texto }),
    icon('x', { size: 14 }),
  ]);
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
          on: { click: () => { idx++; renderItem(); } },
        }),
        el('button.btn.btn-secondary', {
          type: 'button', text: 'Eliminar',
          style: { flex: '1' },
          on: { click: async () => {
            await db.tareas.delete(tarea.id);
            idx++;
            renderItem();
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
            renderItem();
          } },
        }),
      ]),
    ]);

    container.replaceChildren(...content.childNodes);
  }
}
