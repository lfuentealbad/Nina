// Vista #calculadora — la principal del módulo de aranceles.
//
// Estructura vertical:
//   1. Encabezado mínimo.
//   2. Banner de indicadores económicos (UF, UTM, USD, EUR).
//   3. Calculadora: elegir de la tabla o ingreso libre, con factor de
//      complejidad y conversión a pesos.
//   4. Tabla de aranceles plegable (lista filtrable + crear nuevo).
//   5. Nota al pie "Montos referenciales".

import db from '../db.js';
import { el, mount, toast } from '../lib/render.js';
import { icon } from '../lib/icons.js';
import { obtenerIndicadores } from '../lib/indicadores.js';
import { sembrarSiVacio } from '../lib/aranceles-base.js';

const MATERIAS = [
  ['civil', 'Civil'],
  ['familia', 'Familia'],
  ['laboral', 'Laboral'],
  ['penal', 'Penal'],
  ['cobranza', 'Cobranza'],
  ['otro', 'Otro'],
];

const MONEDAS = [
  ['UF', 'UF'],
  ['UTM', 'UTM'],
  ['CLP', 'pesos'],
  ['porcentaje', 'porcentaje'],
];

// Estado de tránsito entre vistas (causa-ficha → calculadora).
// Se vacía al consumirse.
let preseleccion = { arancelId: null, causaId: null };
export function setPreseleccion(p) { preseleccion = { ...preseleccion, ...p }; }

export default async function renderCalculadora(root) {
  // Sembrado lazy de la tabla si la BD aún no tiene aranceles.
  await sembrarSiVacio(db);

  const estado = {
    modo: 'tabla',
    arancelSeleccionado: null,
    montoBase: 0,
    monedaBase: 'CLP',
    factorComplejidad: 1.0,
    libreGestion: '',
    libreMonto: 0,
    libreMoneda: 'UF',
    causaIdAsociada: preseleccion.causaId || null,
    filtroTabla: { query: '', materia: null },
  };

  // Si vino preseleccionada una causa o arancel, los aplicamos y vaciamos.
  if (preseleccion.arancelId) {
    const ar = await db.aranceles.get(preseleccion.arancelId);
    if (ar) estado.arancelSeleccionado = ar;
  }
  preseleccion = { arancelId: null, causaId: null };

  const [indicadoresMapa, todasCausas] = await Promise.all([
    obtenerIndicadores(db),
    db.causas.list({ archivada: false }),
  ]);

  const view = el('div.view-calculadora.app-container');
  mount(root, view);

  await pintarTodo();

  async function pintarTodo() {
    const aranceles = await db.aranceles.listVisibles();

    view.replaceChildren(
      el('header.calc-encabezado', {}, [
        el('h1.calc-titulo', { text: 'Calculadora' }),
        el('p.calc-subtitulo', { text: 'Tabla referencial. Tus ediciones se guardan.' }),
      ]),
      renderBannerIndicadores(indicadoresMapa),
      renderSeccionCalculadora(estado, aranceles, indicadoresMapa, todasCausas, pintarTodo),
      renderTablaSection(estado, aranceles, pintarTodo, indicadoresMapa),
      el('p.calc-disclaimer', {
        text: 'Los montos son referenciales y aproximados. Edítalos según tu propio criterio profesional y tu mercado.',
      }),
    );
  }
}

// ===== Banner de indicadores =====

function renderBannerIndicadores(mapa) {
  const items = [
    ['uf',    'UF'],
    ['utm',   'UTM'],
    ['dolar', 'USD'],
    ['euro',  'EUR'],
  ];

  const algunoEstimado = mapa.uf?.fuente !== 'mindicador';
  const fechaMostrada = mapa.uf?.fecha || '—';

  return el('section.calc-banner', {}, [
    el('div.calc-banner-grid', {}, items.map(([id, label]) => {
      const v = mapa[id];
      return el('div.calc-banner-item', {}, [
        el('div.calc-banner-ticker', { text: label }),
        el('div.calc-banner-valor.tabular', { text: v ? formatoPesos(v.valor) : '—' }),
        el('div.calc-banner-fecha', { text: v?.fecha || '—' }),
      ]);
    })),
    el('div.calc-banner-pie', {
      class: `calc-banner-pie ${algunoEstimado ? 'estimado' : ''}`,
      text: algunoEstimado
        ? `Sin datos frescos · valor del ${fechaMostrada}`
        : `Datos del Banco Central · actualizado ${fechaMostrada}`,
    }),
  ]);
}

// ===== Calculadora =====

function renderSeccionCalculadora(estado, aranceles, indicadores, causas, refrescar) {
  const tabsRow = el('div.calc-tabs', {}, [
    botonTab('Elegir de la tabla', estado.modo === 'tabla', () => {
      estado.modo = 'tabla'; refrescar();
    }),
    botonTab('Ingreso libre', estado.modo === 'libre', () => {
      estado.modo = 'libre'; refrescar();
    }),
  ]);

  const cuerpo = estado.modo === 'tabla'
    ? renderModoTabla(estado, aranceles, indicadores, causas, refrescar)
    : renderModoLibre(estado, indicadores, causas, refrescar);

  return el('section.calc-cuerpo', {}, [
    el('h2.calc-seccion-titulo', { text: '¿Qué vas a cobrar?' }),
    tabsRow,
    cuerpo,
  ]);
}

function botonTab(texto, activo, onClick) {
  return el('button', {
    class: `calc-tab ${activo ? 'active' : ''}`,
    type: 'button',
    on: { click: onClick },
  }, [el('span', { text: texto })]);
}

// --- Modo "Elegir de la tabla" ---

function renderModoTabla(estado, aranceles, indicadores, causas, refrescar) {
  const sel = estado.arancelSeleccionado;

  // Dropdown filtrable: input + lista de coincidencias debajo.
  const buscadorInput = el('input.input', {
    type: 'text',
    placeholder: sel ? '' : 'Buscar gestión (ej. divorcio, cobro de pesos)…',
    autocomplete: 'off',
    value: sel ? sel.gestion : '',
    on: {
      focus: () => mostrarSugerencias(),
      input: () => mostrarSugerencias(),
      blur: () => setTimeout(() => { sugerencias.hidden = true; }, 180),
    },
  });

  const sugerencias = el('div.calc-sugerencias', { hidden: true });

  function mostrarSugerencias() {
    const q = buscadorInput.value.toLowerCase().trim();
    const matches = q
      ? aranceles.filter((a) =>
          (a.gestion || '').toLowerCase().includes(q) ||
          (a.notas || '').toLowerCase().includes(q)
        ).slice(0, 8)
      : aranceles.slice(0, 8);
    if (matches.length === 0) { sugerencias.hidden = true; return; }
    sugerencias.replaceChildren(...matches.map((a) =>
      el('button.calc-sugerencia', {
        type: 'button',
        on: { click: () => seleccionar(a) },
      }, [
        el('div.calc-sugerencia-tit', { text: a.gestion }),
        el('div.calc-sugerencia-meta', {
          text: `${a.monto} ${formatoUnidad(a.moneda)} · ${etiquetaMateria(a.materia)}`,
        }),
      ])
    ));
    sugerencias.hidden = false;
  }

  function seleccionar(a) {
    estado.arancelSeleccionado = a;
    estado.factorComplejidad = 1.0;
    estado.montoBase = 0;
    estado.monedaBase = 'CLP';
    refrescar();
  }

  if (!sel) {
    return el('div.calc-modo', {}, [
      el('div.calc-buscador-wrap', {}, [buscadorInput, sugerencias]),
      el('p.helper', { text: 'Toca un arancel para cargarlo en la calculadora.' }),
    ]);
  }

  // Hay arancel seleccionado: armar el editor según unidad.
  return el('div.calc-modo', {}, [
    el('div.calc-buscador-wrap', {}, [buscadorInput, sugerencias]),
    el('div.calc-arancel-resumen', {}, [
      el('div.calc-arancel-gestion', { text: sel.gestion }),
      el('div.calc-arancel-meta', { text: `${etiquetaMateria(sel.materia)} · valor base ${sel.monto} ${formatoUnidad(sel.moneda)}` }),
    ]),
    sel.moneda === 'porcentaje'
      ? renderEntradaPorcentaje(estado, sel, refrescar)
      : renderEntradaFactor(estado, refrescar),
    renderResultado(calcular(estado, sel, indicadores), indicadores),
    renderAsociarCausa(estado, causas, refrescar),
    renderBotonesAccion(estado, sel, indicadores, refrescar),
  ]);
}

function renderEntradaPorcentaje(estado, sel, refrescar) {
  return el('div.field', {}, [
    el('label.label', { text: 'Monto base sobre el que se calcula' }),
    el('div.row', {}, [
      el('input.input.tabular', {
        type: 'number', min: '0', step: '0.01', inputmode: 'decimal',
        value: estado.montoBase || '',
        style: { flex: '2' },
        on: { input: (e) => { estado.montoBase = Number(e.target.value) || 0; refrescar(); } },
      }),
      el('select.select', {
        style: { flex: '1' },
        on: { change: (e) => { estado.monedaBase = e.target.value; refrescar(); } },
      }, [
        ['UF', 'UF'], ['UTM', 'UTM'], ['CLP', 'pesos'],
      ].map(([v, t]) => el('option', { value: v, text: t, selected: estado.monedaBase === v }))),
    ]),
    el('p.helper', { text: `${sel.monto}% de este monto base.` }),
  ]);
}

function renderEntradaFactor(estado, refrescar) {
  return el('div.field', {}, [
    el('label.label', { text: 'Factor de complejidad' }),
    el('div.calc-factor-row', {}, [
      el('input.calc-factor-slider', {
        type: 'range', min: '0.5', max: '3', step: '0.1',
        value: String(estado.factorComplejidad),
        on: { input: (e) => { estado.factorComplejidad = Number(e.target.value); refrescar(); } },
      }),
      el('input.input.calc-factor-input.tabular', {
        type: 'number', min: '0.5', max: '3', step: '0.1', inputmode: 'decimal',
        value: estado.factorComplejidad.toFixed(1),
        on: { input: (e) => { estado.factorComplejidad = Number(e.target.value) || 1; refrescar(); } },
      }),
    ]),
    el('p.helper', { text: 'Ajusta según complejidad real del caso. 1.0 es el valor referencial.' }),
  ]);
}

// --- Modo "Ingreso libre" ---

function renderModoLibre(estado, indicadores, causas, refrescar) {
  const sel = {
    gestion: estado.libreGestion || '(sin nombre)',
    monto: estado.libreMonto,
    moneda: estado.libreMoneda,
    materia: 'otro',
  };
  return el('div.calc-modo', {}, [
    el('div.field', {}, [
      el('label.label', { text: 'Gestión' }),
      el('input.input', {
        type: 'text', value: estado.libreGestion,
        on: { input: (e) => { estado.libreGestion = e.target.value; refrescar(); } },
      }),
    ]),
    el('div.field', {}, [
      el('label.label', { text: 'Monto y unidad' }),
      el('div.row', {}, [
        el('input.input.tabular', {
          type: 'number', min: '0', step: '0.01', inputmode: 'decimal',
          value: estado.libreMonto || '',
          style: { flex: '2' },
          on: { input: (e) => { estado.libreMonto = Number(e.target.value) || 0; refrescar(); } },
        }),
        el('select.select', {
          style: { flex: '1' },
          on: { change: (e) => { estado.libreMoneda = e.target.value; refrescar(); } },
        }, MONEDAS.map(([v, t]) => el('option', { value: v, text: t, selected: estado.libreMoneda === v }))),
      ]),
    ]),
    sel.moneda === 'porcentaje' && renderEntradaPorcentajeLibre(estado, refrescar),
    sel.moneda !== 'porcentaje' && renderEntradaFactor(estado, refrescar),
    renderResultado(calcular(estado, sel, indicadores), indicadores),
    renderAsociarCausa(estado, causas, refrescar),
    renderBotonesAccion(estado, sel, indicadores, refrescar),
  ]);
}

function renderEntradaPorcentajeLibre(estado, refrescar) {
  return el('div.field', {}, [
    el('label.label', { text: 'Monto base sobre el que se calcula' }),
    el('div.row', {}, [
      el('input.input.tabular', {
        type: 'number', min: '0', step: '0.01', inputmode: 'decimal',
        value: estado.montoBase || '',
        style: { flex: '2' },
        on: { input: (e) => { estado.montoBase = Number(e.target.value) || 0; refrescar(); } },
      }),
      el('select.select', {
        style: { flex: '1' },
        on: { change: (e) => { estado.monedaBase = e.target.value; refrescar(); } },
      }, [
        ['UF', 'UF'], ['UTM', 'UTM'], ['CLP', 'pesos'],
      ].map(([v, t]) => el('option', { value: v, text: t, selected: estado.monedaBase === v }))),
    ]),
  ]);
}

// --- Resultado, asociar y acciones ---

function renderResultado(calculo, indicadores) {
  if (!calculo) return el('div.calc-resultado-vacio', { text: 'Ingresa un monto para ver el cálculo.' });
  const { textoUnidad, pesos } = calculo;
  return el('div.calc-resultado', {}, [
    el('div.calc-resultado-eyebrow', { text: 'A cobrar' }),
    el('div.calc-resultado-monto', { text: textoUnidad }),
    pesos !== null && el('div.calc-resultado-pesos', { text: `≈ ${formatoPesos(pesos)}` }),
  ]);
}

function renderAsociarCausa(estado, causas, refrescar) {
  if (causas.length === 0) return null;
  const seleccionada = estado.causaIdAsociada
    ? causas.find((c) => c.id === estado.causaIdAsociada)
    : null;

  const selectCausa = el('select.select', {
    on: { change: (e) => { estado.causaIdAsociada = e.target.value || null; refrescar(); } },
  }, [
    el('option', { value: '', text: 'Sin causa', selected: !seleccionada }),
    ...causas.map((c) => el('option', {
      value: c.id,
      text: c.caratulado || c.rol || '(sin caratulado)',
      selected: c.id === estado.causaIdAsociada,
    })),
  ]);

  return el('div.field', {}, [
    el('label.label', { text: 'Asociar a causa (opcional)' }),
    selectCausa,
  ]);
}

function renderBotonesAccion(estado, sel, indicadores, refrescar) {
  const calculo = calcular(estado, sel, indicadores);

  return el('div.calc-acciones', {}, [
    estado.causaIdAsociada && el('button.btn.btn-secondary.btn-block', {
      type: 'button',
      disabled: !calculo,
      on: { click: () => guardarComoHonorarioDeCausa(estado, sel, calculo) },
    }, [el('span', { text: 'Guardar como honorario de esta causa' })]),
    el('button.btn.btn-primary.btn-block', {
      type: 'button',
      disabled: !calculo,
      style: { marginTop: 'var(--space-2)' },
      on: { click: () => abrirCopiarResumen(sel, calculo) },
    }, [el('span', { text: 'Copiar resumen' })]),
  ]);
}

// ===== Tabla de aranceles (sección plegable) =====

function renderTablaSection(estado, aranceles, refrescar, indicadoresDeTabla = {}) {
  const filtroQ = estado.filtroTabla.query;
  const filtroMat = estado.filtroTabla.materia;

  const filtrados = aranceles.filter((a) => {
    if (filtroMat && a.materia !== filtroMat) return false;
    if (filtroQ) {
      const q = filtroQ.toLowerCase();
      return (a.gestion || '').toLowerCase().includes(q) ||
             (a.notas || '').toLowerCase().includes(q);
    }
    return true;
  });

  return el('details.calc-tabla.collapsible', { open: true }, [
    el('summary', { text: 'Tabla de aranceles' }),
    el('div.body.stack', {}, [
      el('input.input.search-input', {
        type: 'search',
        placeholder: 'Buscar en la tabla…',
        value: filtroQ,
        on: { input: debounce((e) => {
          estado.filtroTabla.query = e.target.value;
          refrescar();
        }, 200) },
      }),
      el('div.chip-row', {}, [
        chipFiltro('Todas', !filtroMat, () => { estado.filtroTabla.materia = null; refrescar(); }),
        ...MATERIAS.map(([v, t]) =>
          chipFiltro(t, filtroMat === v, () => {
            estado.filtroTabla.materia = filtroMat === v ? null : v;
            refrescar();
          })
        ),
      ]),
      filtrados.length === 0
        ? el('p.helper', { text: 'No hay aranceles con esos filtros.' })
        : el('div.calc-aranceles-grid', {}, filtrados.map((a) => renderTarjetaArancel(a, estado, refrescar, indicadoresDeTabla))),
      el('a.btn.btn-secondary.btn-block', {
        href: '#calculadora/arancel/nueva',
        style: { marginTop: 'var(--space-4)' },
      }, [icon('plus', { size: 16 }), el('span', { text: 'Nuevo arancel' })]),
    ]),
  ]);
}

function chipFiltro(texto, activo, onClick) {
  return el('button', {
    class: `chip ${activo ? 'active' : ''}`,
    type: 'button', text: texto,
    on: { click: onClick },
  });
}

function renderTarjetaArancel(a, estado, refrescar, indicadores) {
  const pesos = (a.moneda === 'UF' || a.moneda === 'UTM')
    ? aPesos(a.monto, a.moneda, indicadores)
    : null;
  return el('article.calc-arancel-card', {}, [
    el('div.calc-arancel-card-cuerpo', {
      role: 'button', tabindex: '0',
      on: { click: () => { location.hash = `#calculadora/arancel/${a.id}`; } },
    }, [
      el('div.calc-arancel-card-tit', { text: a.gestion }),
      el('div.calc-arancel-card-meta', {}, [
        el('span.tabular', { text: `${a.monto} ${formatoUnidad(a.moneda)}` }),
        pesos !== null && el('span.calc-arancel-card-pesos', { text: `≈ ${formatoPesos(pesos)}` }),
      ]),
      a.notas && el('div.calc-arancel-card-notas', { text: a.notas }),
    ]),
    el('button.btn.btn-ghost.calc-arancel-usar', {
      type: 'button',
      on: { click: () => {
        estado.modo = 'tabla';
        estado.arancelSeleccionado = a;
        estado.factorComplejidad = 1.0;
        refrescar();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } },
      text: 'Usar',
    }),
  ]);
}

// ===== Cálculo =====

function calcular(estado, sel, indicadores) {
  if (!sel) return null;

  if (sel.moneda === 'porcentaje') {
    if (!estado.montoBase || estado.montoBase <= 0) return null;
    const pct = Number(sel.monto) / 100;
    const enUnidad = estado.montoBase * pct;
    const monedaResultado = estado.monedaBase;
    const pesos = aPesos(enUnidad, monedaResultado, indicadores);
    return {
      monto: enUnidad,
      moneda: monedaResultado,
      textoUnidad: `${formatoNumero(enUnidad)} ${formatoUnidad(monedaResultado)}`,
      pesos,
    };
  }

  const baseMonto = sel.monto;
  if (!baseMonto || baseMonto <= 0) return null;
  const factor = (sel.moneda === 'CLP' || sel.moneda === 'UF' || sel.moneda === 'UTM')
    ? (estado.factorComplejidad || 1)
    : 1;
  const final = baseMonto * factor;
  const pesos = aPesos(final, sel.moneda, indicadores);
  return {
    monto: final,
    moneda: sel.moneda,
    textoUnidad: `${formatoNumero(final)} ${formatoUnidad(sel.moneda)}`,
    pesos,
  };
}

function aPesos(monto, moneda, indicadores) {
  if (moneda === 'CLP') return Math.round(monto);
  if (moneda === 'UF' && indicadores.uf) return Math.round(monto * indicadores.uf.valor);
  if (moneda === 'UTM' && indicadores.utm) return Math.round(monto * indicadores.utm.valor);
  return null;
}

// ===== Acciones =====

async function guardarComoHonorarioDeCausa(estado, sel, calculo) {
  if (!estado.causaIdAsociada || !calculo) return;
  await db.causas.update(estado.causaIdAsociada, {
    honorarios: { tipo: 'fijo', monto: Math.round(calculo.monto * 100) / 100, moneda: calculo.moneda },
    notasHonorarios: sel.gestion,
  });
  toast('Honorario guardado en la causa');
}

function abrirCopiarResumen(sel, calculo) {
  if (!calculo) return;
  const pesosTxt = calculo.pesos !== null ? ` (~${formatoPesos(calculo.pesos)})` : '';
  const textoDefault = `Honorarios: ${calculo.textoUnidad}${pesosTxt} por ${sel.gestion}. Valor referencial; ajustable según complejidad y forma de pago.`;

  import('../lib/render.js').then(({ modal, el: e }) => {
    let close;
    const textarea = e('textarea.textarea', {
      rows: '5', value: textoDefault,
      style: { width: '100%' },
    });
    const content = e('div.stack', {}, [
      e('div.modal-header', {}, [
        e('div.modal-title', { text: 'Copiar resumen' }),
        e('button.btn-icon', {
          type: 'button', aria: { label: 'Cerrar' },
          on: { click: () => close() },
        }, [icon('x', { size: 22 })]),
      ]),
      e('p.helper', { text: 'Edítalo si quieres antes de copiar.' }),
      textarea,
      e('button.btn.btn-primary.btn-block', {
        type: 'button',
        style: { marginTop: 'var(--space-3)' },
        on: { click: async () => {
          try {
            await navigator.clipboard.writeText(textarea.value);
            toast('Copiado');
          } catch (err) {
            toast('No se pudo copiar — selecciónalo y copia a mano');
          }
          close();
        } },
        text: 'Copiar al portapapeles',
      }),
    ]);
    close = modal(content, { ariaLabel: 'Copiar resumen' });
  });
}

// ===== Helpers de formato =====

const formatterCLP = new Intl.NumberFormat('es-CL', {
  style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
});

function formatoPesos(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return '—';
  return formatterCLP.format(Math.round(n));
}

function formatoNumero(n) {
  if (typeof n !== 'number') return '—';
  return n.toLocaleString('es-CL', {
    minimumFractionDigits: n % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 2,
  });
}

function formatoUnidad(m) {
  if (m === 'porcentaje') return '%';
  return m;
}

function etiquetaMateria(m) {
  const par = MATERIAS.find(([v]) => v === m);
  return par ? par[1] : m;
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
