// Pantalla Ajustes — mínima: tema, export/import JSON, nombre, borrar datos, versión.

import db from '../db.js';
import { el, mount, toast, confirmar } from '../lib/render.js';
import { icon } from '../lib/icons.js';
import { hoyISO, nowTimestamp } from '../lib/fechas.js';

const APP_VERSION = '1.0.0';

export default function renderAjustes(root) {
  const tema = localStorage.getItem('tema') || 'sistema';
  const nombre = localStorage.getItem('nombre') || 'Carolina';

  const view = el('div.view-ajustes.app-container', {}, [
    el('h1.ajustes-display', { text: 'ajustes' }),

    // Tema
    el('section.ajustes-section', {}, [
      el('div.ajustes-section-title', { text: 'Apariencia' }),
      el('div.ajustes-row', {}, [
        el('span.label-only', { text: 'Tema' }),
        el('div.tema-options', {},
          [['sistema', 'Sistema', 'monitor'], ['light', 'Claro', 'sun'], ['dark', 'Oscuro', 'moon']].map(
            ([value, label, iconName]) => el('button', {
              class: `chip ${tema === value ? 'active' : ''}`,
              type: 'button',
              aria: { label },
              on: { click: (e) => {
                setTheme(value);
                view.querySelectorAll('.tema-options .chip').forEach((c) => c.classList.remove('active'));
                e.currentTarget.classList.add('active');
              } },
            }, [icon(iconName, { size: 18 })])
          )
        ),
      ]),
    ]),

    // Identidad
    el('section.ajustes-section', {}, [
      el('div.ajustes-section-title', { text: 'Tu nombre' }),
      el('div.ajustes-row', { style: { flexDirection: 'column', alignItems: 'stretch', gap: 'var(--space-2)' } }, [
        el('input.input', {
          type: 'text', value: nombre,
          aria: { label: 'Tu nombre' },
          on: {
            blur: (e) => {
              const v = e.target.value.trim() || 'Carolina';
              localStorage.setItem('nombre', v);
              toast('Nombre guardado');
            },
          },
        }),
        el('p.helper', { text: 'Aparece en el saludo de la pantalla de inicio.' }),
      ]),
    ]),

    // Datos
    el('section.ajustes-section', {}, [
      el('div.ajustes-section-title', { text: 'Tus datos' }),
      el('div.ajustes-row', {}, [
        el('span.label-only', { text: 'Exportar como JSON' }),
        el('button.btn.btn-secondary', {
          type: 'button',
          on: { click: exportar },
        }, [icon('download', { size: 18 }), el('span', { text: 'Exportar' })]),
      ]),
      el('div.ajustes-row', {}, [
        el('span.label-only', { text: 'Importar desde JSON' }),
        el('button.btn.btn-secondary', {
          type: 'button',
          on: { click: importar },
        }, [icon('upload', { size: 18 }), el('span', { text: 'Importar' })]),
      ]),
    ]),

    // Zona peligrosa
    el('section.ajustes-section', {}, [
      el('div.ajustes-section-title', { text: 'Zona peligrosa' }),
      el('div.ajustes-row', {}, [
        el('span.label-only', { text: 'Borrar todos los datos' }),
        el('button.btn.btn-danger', {
          type: 'button',
          on: { click: borrarTodo },
        }, [el('span', { text: 'Borrar' })]),
      ]),
    ]),

    el('p.version-tag', {
      text: `Carolina v${APP_VERSION} · Fase 1`,
    }),
  ]);

  mount(root, view);
}

function setTheme(tema) {
  localStorage.setItem('tema', tema);
  applyTheme();
}

export function applyTheme() {
  const tema = localStorage.getItem('tema') || 'sistema';
  if (tema === 'sistema') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', tema);
  }
}

async function exportar() {
  const data = await db.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `carolina-${hoyISO()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Datos exportados');
}

async function importar() {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    let data;
    try {
      const text = await file.text();
      data = JSON.parse(text);
    } catch (e) {
      toast('Archivo inválido (no es JSON)');
      return;
    }

    if (!data.causas && !data.tareas && !data.hitos) {
      toast('Archivo inválido (no es backup de Carolina)');
      return;
    }

    const ok = await confirmar({
      titulo: 'Importar datos',
      mensaje: `Se agregarán: ${data.causas?.length || 0} causas, ${data.tareas?.length || 0} tareas, ${data.hitos?.length || 0} hitos. Las que tengan el mismo ID se sobrescribirán.`,
      confirmLabel: 'Importar',
    });
    if (!ok) return;

    try {
      const counts = await db.importAll(data, { mode: 'merge' });
      toast(`Importadas ${counts.causas} causas, ${counts.tareas} tareas, ${counts.hitos} hitos`);
      // Refrescar vista actual.
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (e) {
      toast(`Error al importar: ${e.message}`);
    }
  });

  fileInput.click();
}

async function borrarTodo() {
  const ok = await confirmar({
    titulo: 'Borrar TODOS los datos',
    mensaje: 'Esta acción elimina todas tus causas, tareas e hitos. No se puede deshacer. Te recomendamos exportar antes.',
    confirmLabel: 'Borrar todo',
    destructive: true,
  });
  if (!ok) return;

  // Doble confirmación dura para acción tan destructiva.
  const ok2 = await confirmar({
    titulo: '¿De verdad?',
    mensaje: 'Última oportunidad. Después no hay vuelta atrás.',
    confirmLabel: 'Sí, borrar todo',
    destructive: true,
  });
  if (!ok2) return;

  await db.clearAll();
  toast('Todos los datos fueron borrados');
  location.hash = '#hoy';
}
