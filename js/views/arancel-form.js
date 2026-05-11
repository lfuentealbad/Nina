// Formulario crear/editar arancel.
// Si es referencial: en lugar de borrar, ofrece ocultar de la lista.
// Si es propio: ofrece eliminar.

import db from '../db.js';
import { el, mount, toast, confirmar } from '../lib/render.js';
import { icon } from '../lib/icons.js';

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
  ['porcentaje', 'Porcentaje'],
];

export default async function renderArancelForm(root, { id } = {}) {
  const editing = !!id;
  const item = editing
    ? await db.aranceles.get(id)
    : { materia: 'civil', gestion: '', monto: 0, moneda: 'UF', notas: '', esReferencial: false, ocultoPorUsuario: false };

  if (editing && !item) {
    mount(root, el('div.app-container', {}, [
      el('div.empty-state', {}, [
        el('p.empty-message', { text: 'Este arancel no existe.' }),
        el('a.btn.btn-secondary', { href: '#calculadora', text: 'Volver a calculadora' }),
      ]),
    ]));
    return;
  }

  const inputMateria = el('select.select',
    { id: 'f-mat' },
    MATERIAS.map(([v, t]) => el('option', { value: v, text: t, selected: v === item.materia }))
  );
  const inputGestion = el('input.input', {
    type: 'text', id: 'f-gestion', value: item.gestion, required: true,
    placeholder: 'Ej. Demanda de cobro de pesos',
  });
  const errGestion = el('p.error', { hidden: true });

  const inputMonto = el('input.input.tabular', {
    type: 'number', id: 'f-monto', value: item.monto, min: '0', step: '0.01',
    inputmode: 'decimal', required: true,
  });
  const errMonto = el('p.error', { hidden: true });

  const inputMoneda = el('select.select',
    { id: 'f-mon' },
    MONEDAS.map(([v, t]) => el('option', { value: v, text: t, selected: v === item.moneda }))
  );
  const inputNotas = el('textarea.textarea', {
    id: 'f-notas', value: item.notas, rows: '3', maxlength: '500',
    placeholder: 'Ej. Subir 20% si la cuantía supera 500 UF.',
  });

  // Para referenciales: checkbox de ocultar.
  const inputOcultar = el('input', {
    type: 'checkbox', id: 'f-ocultar', checked: item.ocultoPorUsuario,
  });

  const view = el('div.view-form.app-container', {}, [
    el('header.ficha-header', {}, [
      el('a.ficha-back', { href: '#calculadora', aria: { label: 'Volver' } }, [icon('arrowLeft', { size: 22 })]),
      el('h1.ficha-titulo', { text: editing ? 'Editar arancel' : 'Nuevo arancel' }),
    ]),

    el('form.stack-loose', { on: { submit: (e) => { e.preventDefault(); guardar(); } } }, [
      el('div.field', {}, [
        el('label.label', { for: 'f-mat', text: 'Materia' }),
        inputMateria,
      ]),
      el('div.field', {}, [
        el('label.label', { for: 'f-gestion' }, ['Gestión', el('span.required', { text: '*' })]),
        inputGestion,
        errGestion,
      ]),
      el('div.field', {}, [
        el('label.label', { for: 'f-monto' }, ['Monto', el('span.required', { text: '*' })]),
        el('div.row', {}, [
          el('div', { style: { flex: '2' } }, [inputMonto]),
          el('div', { style: { flex: '1' } }, [inputMoneda]),
        ]),
        errMonto,
      ]),
      el('div.field', {}, [
        el('label.label', { for: 'f-notas', text: 'Notas (opcional)' }),
        inputNotas,
      ]),

      editing && item.esReferencial && el('div.field', {}, [
        el('label.toggle', {}, [
          el('span.toggle-label', { text: 'Ocultar este arancel de la lista' }),
          el('span.toggle-switch', {}, [inputOcultar, el('span.toggle-track')]),
        ]),
        el('p.helper', {
          text: 'Los aranceles referenciales no se borran. Si lo ocultas, puedes restaurarlo desde Ajustes.',
        }),
      ]),

      el('div.form-actions', {}, [
        el('a.btn.btn-ghost', { href: '#calculadora', text: 'Cancelar' }),
        editing && !item.esReferencial && el('button.btn.btn-danger', {
          type: 'button',
          on: { click: () => eliminar() },
        }, [el('span', { text: 'Eliminar' })]),
        el('button.btn.btn-primary', {
          type: 'submit', text: editing ? 'Guardar' : 'Crear',
        }),
      ]),
    ]),
  ]);

  mount(root, view);
  if (!editing) requestAnimationFrame(() => inputGestion.focus());

  async function guardar() {
    let valido = true;
    if (!inputGestion.value.trim()) {
      errGestion.textContent = 'La gestión es obligatoria';
      errGestion.hidden = false;
      inputGestion.style.borderColor = 'var(--status-urgent)';
      valido = false;
    } else {
      errGestion.hidden = true;
      inputGestion.style.borderColor = '';
    }

    const monto = Number(inputMonto.value);
    if (!Number.isFinite(monto) || monto <= 0) {
      errMonto.textContent = 'El monto debe ser mayor a cero';
      errMonto.hidden = false;
      inputMonto.style.borderColor = 'var(--status-urgent)';
      valido = false;
    } else {
      errMonto.hidden = true;
      inputMonto.style.borderColor = '';
    }

    if (!valido) return;

    const data = {
      materia: inputMateria.value,
      gestion: inputGestion.value.trim(),
      monto,
      moneda: inputMoneda.value,
      notas: inputNotas.value.trim(),
    };

    if (editing) {
      if (item.esReferencial) {
        data.ocultoPorUsuario = inputOcultar.checked;
      }
      await db.aranceles.update(id, data);
      toast('Arancel actualizado');
    } else {
      await db.aranceles.create(data);
      toast('Arancel creado');
    }
    location.hash = '#calculadora';
  }

  async function eliminar() {
    const ok = await confirmar({
      titulo: 'Eliminar arancel',
      mensaje: `Se eliminará "${item.gestion}".`,
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    await db.aranceles.delete(id);
    toast('Arancel eliminado');
    location.hash = '#calculadora';
  }
}
