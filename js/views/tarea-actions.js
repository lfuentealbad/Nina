// Acciones avanzadas de tarea — Phase 2 lite.
// 1. Modo Foco (Tiimo): single-task spotlight con subtareas.
// 2. Descomponer (Goblin): breakdown UI guiado de 3-5 microsteps.
// 3. Revisión nocturna (Sunsama): one-tarea-at-a-time review.

import db from '../db.js';
import { el, modal, toast, confirmar } from '../lib/render.js';
import { icon } from '../lib/icons.js';
import { hoyISO, formatoCorto, semaforo } from '../lib/fechas.js';

// ============================================================================
// MODO FOCO
// ============================================================================
export async function openModoFoco(tareaId, onChange) {
  const tarea = await db.tareas.get(tareaId);
  if (!tarea) { toast('Tarea no encontrada'); return; }

  const focusRoot = document.createElement('div');
  focusRoot.className = 'modo-foco';
  document.body.appendChild(focusRoot);
  document.body.style.overflow = 'hidden';

  function close() {
    focusRoot.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    if (onChange) onChange();
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);

  async function refresh() {
    const t = await db.tareas.get(tareaId);
    if (!t) { close(); return; }
    render(t);
  }

  function render(t) {
    const tieneSubs = Array.isArray(t.subtareas) && t.subtareas.length > 0;
    const completadas = tieneSubs ? t.subtareas.filter((s) => s.completada).length : 0;
    const total = tieneSubs ? t.subtareas.length : 0;

    focusRoot.replaceChildren(
      el('div.modo-foco-bar', {}, [
        el('button.btn-icon', {
          type: 'button', aria: { label: 'Salir del modo foco' },
          on: { click: close },
        }, [icon('x', { size: 22 })]),
        tieneSubs && el('div.modo-foco-progress', {
          text: `${completadas} de ${total}`,
        }),
      ]),

      el('div.modo-foco-content', {}, [
        el('div.modo-foco-eyebrow', { text: 'En este momento' }),
        el('h1.modo-foco-titulo', { text: t.titulo }),
        t.descripcion && el('p.modo-foco-desc', { text: t.descripcion }),

        tieneSubs && el('ul.modo-foco-subs', {},
          t.subtareas.map((s, i) => el('li', {
            class: s.completada ? 'sub-item done' : 'sub-item',
          }, [
            el('button.tarea-checkbox', {
              type: 'button',
              class: s.completada ? 'tarea-checkbox checked' : 'tarea-checkbox',
              aria: { label: `Marcar paso "${s.titulo}"` },
              on: { click: async () => { await db.tareas.toggleSubtarea(t.id, i); refresh(); } },
            }, [s.completada ? icon('check', { size: 16 }) : null]),
            el('span.sub-titulo', { text: s.titulo }),
          ]))),

        !tieneSubs && el('button.modo-foco-cta-secondary', {
          type: 'button',
          on: { click: async () => {
            close();
            openDescomponer(tareaId, onChange);
          } },
        }, [icon('plus', { size: 18 }), el('span', { text: 'Descomponer en pasos' })]),
      ]),

      el('div.modo-foco-footer', {}, [
        el('button.modo-foco-cta', {
          type: 'button',
          on: { click: async () => {
            await db.tareas.complete(t.id, true);
            toast(`"${truncate(t.titulo, 40)}" completada`, {
              dur: 5000,
              action: { label: 'Deshacer', onClick: async () => { await db.tareas.complete(t.id, false); if (onChange) onChange(); } },
            });
            close();
          } },
        }, [icon('check', { size: 22 }), el('span', { text: t.completada ? 'Reabrir' : 'Hecho' })]),
      ]),
    );
  }

  render(tarea);
}

// ============================================================================
// DESCOMPONER (Goblin Tools-style)
// ============================================================================
export async function openDescomponer(tareaId, onChange) {
  const tarea = await db.tareas.get(tareaId);
  if (!tarea) return;

  const existentes = Array.isArray(tarea.subtareas) ? tarea.subtareas : [];

  let close;
  // 5 inputs vacíos por defecto, o pre-llenados con subtareas existentes
  const initialSlots = Math.max(5, existentes.length + 1);
  const inputs = [];

  function makeInput(value = '') {
    const inp = el('input.input', {
      type: 'text',
      value,
      placeholder: 'Un paso pequeño…',
      autocomplete: 'off',
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Mover foco al siguiente input
        const next = inputs[inputs.indexOf(inp) + 1];
        if (next) next.focus();
        else save();
      }
    });
    inputs.push(inp);
    return el('div.descompone-row', {}, [
      el('span.descompone-numero.tabular', { text: String(inputs.length) }),
      inp,
    ]);
  }

  // Render inicial: subtareas existentes + 1 vacío
  const slots = [];
  for (const s of existentes) slots.push(makeInput(s.titulo));
  while (slots.length < initialSlots) slots.push(makeInput(''));

  const list = el('div.descompone-lista', {}, slots);

  const content = el('div.stack', {}, [
    el('div.modal-header', {}, [
      el('div.modal-title', { text: 'Descomponer' }),
      el('button.btn-icon', {
        type: 'button', aria: { label: 'Cerrar' },
        on: { click: () => close() },
      }, [icon('x', { size: 22 })]),
    ]),

    el('p', {
      text: tarea.titulo,
      style: { fontSize: 'var(--text-base)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' },
    }),

    el('p.helper', {
      text: 'Escribe pasos chicos. Lo importante es bajar la primera barrera, no planearlo perfecto.',
      style: { marginBottom: 'var(--space-4)' },
    }),

    list,

    el('button.btn.btn-ghost', {
      type: 'button',
      style: { marginTop: 'var(--space-2)' },
      on: { click: () => {
        list.appendChild(makeInput(''));
        inputs[inputs.length - 1].focus();
      } },
    }, [icon('plus', { size: 16 }), el('span', { text: 'Otro paso' })]),

    el('div.row', { style: { marginTop: 'var(--space-5)', gap: 'var(--space-3)' } }, [
      el('button.btn.btn-ghost', {
        type: 'button', text: 'Cancelar',
        style: { flex: '1' },
        on: { click: () => close() },
      }),
      el('button.btn.btn-primary', {
        type: 'button', text: 'Guardar pasos',
        style: { flex: '1.4' },
        on: { click: save },
      }),
    ]),
  ]);

  close = modal(content, { ariaLabel: 'Descomponer en pasos' });

  // Auto-focus primer input vacío
  requestAnimationFrame(() => {
    const firstEmpty = inputs.find((i) => !i.value.trim()) || inputs[0];
    firstEmpty.focus();
  });

  async function save() {
    const titulos = inputs.map((i) => i.value.trim()).filter(Boolean);
    // Preservar estado completada de subtareas existentes con mismo título
    const completadasMap = new Map(existentes.map((s) => [s.titulo, s]));
    const subtareas = titulos.map((titulo) => {
      const prev = completadasMap.get(titulo);
      return {
        titulo,
        completada: prev ? !!prev.completada : false,
        completadaEn: prev ? prev.completadaEn : null,
      };
    });
    await db.tareas.setSubtareas(tareaId, subtareas);
    close();
    toast(subtareas.length === 0 ? 'Sin pasos guardados' : `${subtareas.length} paso${subtareas.length === 1 ? '' : 's'} guardado${subtareas.length === 1 ? '' : 's'}`);
    if (onChange) onChange();
  }
}

// ============================================================================
// REVISIÓN NOCTURNA (Sunsama-style)
// ============================================================================
export async function openRevisionDelDia(onChange) {
  const allTareas = await db.tareas.list();
  const hoyStr = hoyISO();
  // Pendientes que estaban planificadas para hoy y siguen sin completar
  const pendientesHoy = allTareas
    .filter((t) => !t.completada && t.fechaVencimiento === hoyStr)
    .sort((a, b) => (a.horaVencimiento || '99:99').localeCompare(b.horaVencimiento || '99:99'));

  const completadasHoy = allTareas.filter((t) => t.completada && t.completadaEn?.startsWith(hoyStr));

  let close;
  let idx = 0;

  const container = el('div.stack', {});
  close = modal(container, { ariaLabel: 'Revisión del día' });

  async function refreshSelf() {
    const fresh = await db.tareas.list();
    const stillPending = fresh
      .filter((t) => !t.completada && t.fechaVencimiento === hoyStr)
      .sort((a, b) => (a.horaVencimiento || '99:99').localeCompare(b.horaVencimiento || '99:99'));
    // Reemplazar lista local
    pendientesHoy.length = 0;
    stillPending.forEach((t) => pendientesHoy.push(t));
    renderItem();
  }

  function renderCierre() {
    const completadasCount = completadasHoy.length;
    container.replaceChildren(...el('div.stack', {}, [
      el('div.modal-header', {}, [
        el('div.modal-title', { text: 'Cierre del día' }),
      ]),
      el('div', {
        style: { padding: 'var(--space-5) 0', textAlign: 'center' },
      }, [
        el('div', {
          text: String(completadasCount),
          style: {
            fontFamily: 'var(--font-display)', fontStyle: 'italic',
            fontSize: 'var(--text-4xl)', color: 'var(--accent-primary)',
            lineHeight: '1', marginBottom: 'var(--space-3)',
          },
        }),
        el('p', {
          text: completadasCount === 0
            ? 'Hoy no completaste tareas — y eso también está bien.'
            : completadasCount === 1
              ? 'tarea completada hoy.'
              : 'tareas completadas hoy.',
          style: { fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 'var(--text-lg)', color: 'var(--text-secondary)' },
        }),
      ]),
      el('button.btn.btn-primary.btn-block', {
        type: 'button', text: 'Cerrar',
        on: { click: () => close() },
      }),
    ]).childNodes);
  }

  function renderItem() {
    if (idx >= pendientesHoy.length) {
      renderCierre();
      return;
    }
    const t = pendientesHoy[idx];
    const sem = semaforo(t.fechaVencimiento);

    container.replaceChildren(...el('div.stack', {}, [
      el('div.modal-header', {}, [
        el('div.modal-title', { text: 'Revisar día' }),
        el('button.btn-icon', {
          type: 'button', aria: { label: 'Cerrar' },
          on: { click: () => close() },
        }, [icon('x', { size: 22 })]),
      ]),

      el('div', {
        text: `Tarea ${idx + 1} de ${pendientesHoy.length}`,
        style: {
          fontSize: 'var(--text-xs)', textTransform: 'uppercase',
          letterSpacing: 'var(--tracking-wider)', color: 'var(--text-tertiary)',
          marginBottom: 'var(--space-4)',
        },
      }),

      el('div.card', { style: { marginBottom: 'var(--space-5)' } }, [
        el('div', { text: t.titulo, style: { fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-medium)' } }),
        sem && el('div', { style: { marginTop: 'var(--space-2)' } }, [
          el('span', { class: `semaforo ${sem.class}`, text: sem.label.toLowerCase() }),
        ]),
      ]),

      el('div.stack', {}, [
        el('button.btn.btn-primary.btn-block', {
          type: 'button',
          on: { click: async () => { await db.tareas.complete(t.id, true); idx++; refreshSelf(); } },
        }, [icon('check', { size: 18 }), el('span', { text: 'Hecho' })]),

        el('button.btn.btn-secondary.btn-block', {
          type: 'button',
          on: { click: async () => {
            await db.tareas.reschedule(t.id, isoMasNDias(1));
            toast('Movida a mañana');
            idx++; refreshSelf();
          } },
        }, [el('span', { text: 'Mover a mañana' })]),

        el('button.btn.btn-secondary.btn-block', {
          type: 'button',
          on: { click: async () => {
            await db.tareas.reschedule(t.id, null);
            toast('Movida a bandeja');
            idx++; refreshSelf();
          } },
        }, [el('span', { text: 'A la bandeja (sin fecha)' })]),

        el('button.btn.btn-ghost.btn-block', {
          type: 'button',
          on: { click: async () => {
            const ok = await confirmar({
              titulo: 'Eliminar tarea',
              mensaje: `Se borrará "${t.titulo}". No se puede deshacer.`,
              confirmLabel: 'Eliminar',
              destructive: true,
            });
            if (ok) {
              await db.tareas.delete(t.id);
              idx++; refreshSelf();
            }
          } },
        }, [el('span', { text: 'Eliminar', style: { color: 'var(--status-urgent)' } })]),

        el('button.btn.btn-ghost.btn-block', {
          type: 'button',
          on: { click: () => { idx++; renderItem(); } },
        }, [el('span', { text: 'Saltar (volver mañana)' })]),
      ]),
    ]).childNodes);
  }

  if (pendientesHoy.length === 0) renderCierre();
  else renderItem();

  // Cuando se cierra, refresca la vista llamadora
  const originalClose = close;
  close = () => { originalClose(); if (onChange) onChange(); };
}

// ============================================================================
// MENU DE ACCIONES (popover desde "···")
// ============================================================================
export function openAccionesMenu(tareaId, onChange, anchorEl) {
  let close;
  const content = el('div.stack-tight', {}, [
    el('div.modal-header', {}, [
      el('div.modal-title', { text: 'Acciones' }),
      el('button.btn-icon', {
        type: 'button', aria: { label: 'Cerrar' },
        on: { click: () => close() },
      }, [icon('x', { size: 22 })]),
    ]),
    el('button.btn.btn-secondary.btn-block', {
      type: 'button',
      on: { click: () => { close(); openModoFoco(tareaId, onChange); } },
    }, [icon('clock', { size: 18 }), el('span', { text: 'Modo foco' })]),
    el('button.btn.btn-secondary.btn-block', {
      type: 'button',
      on: { click: () => { close(); openDescomponer(tareaId, onChange); } },
    }, [icon('plus', { size: 18 }), el('span', { text: 'Descomponer en pasos' })]),
    el('a.btn.btn-secondary.btn-block', {
      href: `#tareas/${tareaId}/editar`,
      on: { click: () => close() },
    }, [icon('edit', { size: 18 }), el('span', { text: 'Editar' })]),
  ]);
  close = modal(content, { ariaLabel: 'Acciones de tarea' });
}

// ============================================================================
// helpers
// ============================================================================
function isoMasNDias(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function truncate(s, n) {
  return s && s.length > n ? s.slice(0, n - 1) + '…' : (s || '');
}
