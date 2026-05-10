// Vista Lista de Causas — Editorial calm, notebook-page style.

import db from '../db.js';
import { el, mount, debounce } from '../lib/render.js';
import { icon } from '../lib/icons.js';
import { illustration } from '../lib/illustrations.js';
import { semaforo } from '../lib/fechas.js';

const MATERIAS = [
  ['civil', 'Civil'],
  ['familia', 'Familia'],
  ['laboral', 'Laboral'],
  ['penal', 'Penal'],
  ['cobranza', 'Cobranza'],
  ['otro', 'Otro'],
];

const MATERIA_LABELS = {
  civil: 'Civil', familia: 'Familia', laboral: 'Laboral',
  penal: 'Penal', cobranza: 'Cobranza', otro: 'Otro',
};

function loadFilters() {
  try { return JSON.parse(sessionStorage.getItem('causas-filters') || '{}'); }
  catch { return {}; }
}
function saveFilters(f) { sessionStorage.setItem('causas-filters', JSON.stringify(f)); }

export default async function renderCausasLista(root) {
  const state = {
    query: '',
    estado: 'activas',
    materia: null,
    ...loadFilters(),
  };

  const listContainer = el('div.causas-list');

  const searchInput = el('input.input.search-input', {
    type: 'search',
    placeholder: 'Buscar causa…',
    value: state.query,
    aria: { label: 'Buscar causas' },
    on: {
      input: debounce((e) => {
        state.query = e.target.value;
        saveFilters(state);
        refresh();
      }, 200),
    },
  });

  const chipRow = el('div.chip-row', {}, renderChips());

  const view = el('div.view-causas.app-container', {}, [
    el('h1.causas-display', { text: 'causas' }),
    el('div.causas-toolbar', {}, [
      el('div.search-wrapper', {}, [
        el('span.search-icon', {}, [icon('search', { size: 18 })]),
        searchInput,
      ]),
      el('div.chip-row-wrapper', {}, [chipRow]),
    ]),
    listContainer,
  ]);

  mount(root, view);
  refresh();

  function renderChips() {
    const estados = [
      ['activas', 'Activas'],
      ['todas', 'Todas'],
      ['archivadas', 'Archivadas'],
    ];
    const estadoChips = estados.map(([val, label]) =>
      el('button', {
        class: `chip ${state.estado === val ? 'active' : ''}`,
        type: 'button', text: label,
        on: { click: () => { state.estado = val; saveFilters(state); refreshChips(); refresh(); } },
      })
    );
    const materiaChips = MATERIAS.map(([val, label]) =>
      el('button', {
        class: `chip chip-materia ${state.materia === val ? 'active' : ''}`,
        type: 'button', text: label,
        dataset: { materia: val },
        on: {
          click: () => {
            state.materia = state.materia === val ? null : val;
            saveFilters(state);
            refreshChips();
            refresh();
          },
        },
      })
    );
    return [...estadoChips, ...materiaChips];
  }

  function refreshChips() {
    chipRow.replaceChildren(...renderChips());
  }

  async function refresh() {
    const filterOpts = {};
    if (state.estado === 'activas') filterOpts.archivada = false;
    else if (state.estado === 'archivadas') filterOpts.archivada = true;
    if (state.materia) filterOpts.materia = state.materia;

    let causas = state.query
      ? await db.causas.search(state.query)
      : await db.causas.list(filterOpts);

    if (state.query) {
      causas = causas.filter((c) => {
        if (state.estado === 'activas' && c.archivada) return false;
        if (state.estado === 'archivadas' && !c.archivada) return false;
        if (state.materia && c.materia !== state.materia) return false;
        return true;
      });
    }

    if (causas.length === 0) {
      mount(listContainer, renderEmpty());
      return;
    }

    listContainer.replaceChildren(...await Promise.all(causas.map(renderCausa)));
  }

  function renderEmpty() {
    const isFiltered = state.query || state.materia || state.estado !== 'activas';
    return el('div.empty-state', {}, [
      illustration(isFiltered ? 'searchEmpty' : 'emptyFolder'),
      el('p.empty-message', {
        text: isFiltered
          ? 'sin resultados'
          : 'aún no hay causas',
      }),
      !isFiltered && el('a.btn.btn-primary', {
        href: '#causas/nueva',
        text: 'Agregar la primera',
      }),
    ]);
  }

  async function renderCausa(c) {
    const tareas = await db.tareas.listByCausa(c.id);
    const proxima = tareas.find((t) => !t.completada && t.fechaVencimiento);
    const sem = proxima ? semaforo(proxima.fechaVencimiento) : null;

    const materiaLabel = MATERIA_LABELS[c.materia] || c.materia || 'Otro';
    const eyebrowParts = [materiaLabel];
    if (c.rol) eyebrowParts.push(c.rol);

    return el('article.causa-row', {
      role: 'button', tabindex: '0',
      dataset: { materia: c.materia || 'otro' },
      aria: { label: `Abrir causa ${c.caratulado}` },
      on: {
        click: () => location.hash = `#causas/${c.id}`,
        keydown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            location.hash = `#causas/${c.id}`;
          }
        },
      },
    }, [
      el('div.causa-eyebrow', {}, [
        el('span', { text: materiaLabel }),
        c.rol && el('span.dot', { text: '·' }),
        c.rol && el('span.tabular', { text: c.rol }),
      ]),
      el('div.causa-titulo', { text: c.caratulado || '(sin caratulado)' }),
      c.tribunal && el('div.causa-tribunal', { text: c.tribunal }),
      proxima && el('div.causa-next', {}, [
        sem && el('span', { class: `semaforo ${sem.class}`, text: sem.label.toLowerCase() }),
        el('span', { text: proxima.titulo }),
      ]),
    ]);
  }
}
