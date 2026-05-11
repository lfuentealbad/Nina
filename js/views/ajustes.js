// Pantalla Ajustes — tema, nombre, avisos, datos, zona peligrosa.

import db from '../db.js';
import { el, mount, toast, confirmar } from '../lib/render.js';
import { icon } from '../lib/icons.js';
import { hoyISO, nowTimestamp } from '../lib/fechas.js';
import { borrarEjemplos, quedanEjemplos } from '../lib/datos-ejemplo.js';

const KEY_AUTO_CAL = 'auto-calendario';

export default async function renderAjustes(root) {
  const tema = localStorage.getItem('tema') || 'sistema';
  const nombre = localStorage.getItem('nombre') || 'Nina';
  const hayEjemplos = await quedanEjemplos(db);

  const view = el('div.view-ajustes.app-container', {}, [
    el('h1.ajustes-titulo', { text: 'Ajustes' }),

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
              const v = e.target.value.trim() || 'Nina';
              localStorage.setItem('nombre', v);
              toast('Nombre guardado');
            },
          },
        }),
        el('p.helper', { text: 'Aparece en el saludo de la pantalla de inicio.' }),
      ]),
    ]),

    // Avisos
    renderSeccionAvisos(),

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

    // Datos de ejemplo (solo si quedan)
    hayEjemplos && el('section.ajustes-section', {}, [
      el('div.ajustes-section-title', { text: 'Datos de ejemplo' }),
      el('div.ajustes-row', {}, [
        el('span.label-only', { text: 'Borrar precargados' }),
        el('button.btn.btn-secondary', {
          type: 'button',
          on: { click: () => borrarEjemplosUI(root) },
        }, [el('span', { text: 'Borrar datos de ejemplo' })]),
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
  ]);

  mount(root, view);
}

// ===== Sección Avisos =====

function renderSeccionAvisos() {
  const permiso = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  const autoCal = localStorage.getItem(KEY_AUTO_CAL) === '1';

  // Toggle 1: avisos del navegador
  const toggleAvisos = el('input', {
    type: 'checkbox',
    checked: permiso === 'granted',
    disabled: permiso === 'denied' || permiso === 'unsupported',
    on: {
      change: async (e) => {
        const target = e.target;
        if (permiso === 'granted') {
          // No podemos revocar el permiso desde la web; le explicamos.
          target.checked = true;
          toast('Para apagar los avisos, hazlo en la configuración del navegador.', { dur: 6000 });
        } else if (permiso === 'default') {
          const r = await Notification.requestPermission();
          target.checked = r === 'granted';
          if (r === 'granted') toast('Listo, te avisaré una vez al día cuando abras Nina.');
          else target.disabled = (r === 'denied');
        }
      },
    },
  });

  const textoAvisos = permiso === 'denied'
    ? 'Bloqueaste los avisos en este navegador. Cámbialo en la configuración del navegador para reactivar.'
    : 'Una vez al día, cuando abras Nina, te recuerdo lo que tienes hoy. Nunca más de una vez.';

  // Toggle 2: auto-calendario
  const toggleAutoCal = el('input', {
    type: 'checkbox',
    checked: autoCal,
    on: {
      change: (e) => {
        if (e.target.checked) localStorage.setItem(KEY_AUTO_CAL, '1');
        else localStorage.removeItem(KEY_AUTO_CAL);
      },
    },
  });

  return el('section.ajustes-section', {}, [
    el('div.ajustes-section-title', { text: 'Avisos' }),

    el('div.ajustes-row', {}, [
      el('label.toggle', {}, [
        el('span.toggle-label', { text: 'Avisos del navegador al abrir Nina' }),
        el('span.toggle-switch', {}, [toggleAvisos, el('span.toggle-track')]),
      ]),
    ]),
    el('p.helper', { text: textoAvisos }),

    el('div.ajustes-row', { style: { marginTop: 'var(--space-3)' } }, [
      el('label.toggle', {}, [
        el('span.toggle-label', { text: 'Mandar audiencias al calendario automáticamente' }),
        el('span.toggle-switch', {}, [toggleAutoCal, el('span.toggle-track')]),
      ]),
    ]),
    el('p.helper', {
      text: 'Después de capturar una audiencia, te abro el menú para que la mandes a tu calendario. Desde ahí decides cómo quieres que te avise.',
    }),
  ]);
}

// ===== Resto =====

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
  a.download = `nina-${hoyISO()}.json`;
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
      toast('Archivo inválido (no es backup de Nina)');
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
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (e) {
      toast(`Error al importar: ${e.message}`);
    }
  });

  fileInput.click();
}

async function borrarEjemplosUI(root) {
  const ok = await confirmar({
    titulo: '¿Borrar todos los ejemplos?',
    mensaje: 'Esto no afecta los datos que tú cargaste.',
    confirmLabel: 'Borrar ejemplos',
  });
  if (!ok) return;
  await borrarEjemplos(db);
  toast('Listo, ejemplos borrados');
  renderAjustes(root);
}

async function borrarTodo() {
  const ok = await confirmar({
    titulo: 'Borrar TODOS los datos',
    mensaje: 'Esta acción elimina todas tus causas, tareas e hitos. No se puede deshacer. Te recomendamos exportar antes.',
    confirmLabel: 'Borrar todo',
    destructive: true,
  });
  if (!ok) return;

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
