// Formulario nueva/editar causa. Identificación abierta, resto colapsado (divulgación progresiva).
// Campos obligatorios: rol, tribunal, materia (≤30s para crear).

import db from '../db.js';
import { el, mount, toast, confirmar } from '../lib/render.js';
import { icon } from '../lib/icons.js';
import { ofrecerBorrarEjemplosSiPrimerRegistroPropio } from '../lib/datos-ejemplo.js';

const MATERIAS = [
  ['civil', 'Civil'],
  ['familia', 'Familia'],
  ['laboral', 'Laboral'],
  ['penal', 'Penal'],
  ['cobranza', 'Cobranza'],
  ['otro', 'Otro'],
];
const PARTES = [
  ['demandante', 'Demandante'],
  ['demandado', 'Demandado'],
  ['querellante', 'Querellante'],
  ['otro', 'Otro'],
];
const ETAPAS = [
  ['discusión', 'Discusión'],
  ['prueba', 'Prueba'],
  ['sentencia', 'Sentencia'],
  ['recursos', 'Recursos'],
  ['ejecución', 'Ejecución'],
];
const HONORARIO_TIPOS = [
  ['fijo', 'Fijo'],
  ['porcentaje', 'Porcentaje'],
  ['mixto', 'Mixto'],
];

export default async function renderCausaForm(root, { id } = {}) {
  const editing = !!id;
  const causa = editing
    ? await db.causas.get(id)
    : {
        rol: '', tribunal: '', materia: 'civil',
        caratulado: '', parteRepresentada: 'demandante',
        contraparte: '', etapa: 'discusión', urlOJV: '',
        honorarios: { tipo: 'fijo', monto: 0, moneda: 'CLP' },
        notasHonorarios: '', notas: '',
      };

  if (editing && !causa) {
    mount(root, el('div.app-container', {}, [
      el('div.empty-state', {}, [
        el('p.empty-message', { text: 'Esta causa no existe.' }),
        el('a.btn.btn-secondary', { href: '#causas', text: 'Volver' }),
      ]),
    ]));
    return;
  }

  // Inputs
  const inputs = {};
  inputs.rol = textInput('rol', 'Rol / RIT / RUC', causa.rol, true, { autocomplete: 'off' });
  inputs.tribunal = textInput('tribunal', 'Tribunal', causa.tribunal, true);
  inputs.materia = selectInput('materia', 'Materia', MATERIAS, causa.materia);
  inputs.caratulado = textInput('caratulado', 'Caratulado', causa.caratulado, false, { placeholder: 'Pérez con Rojas' });
  inputs.parteRepresentada = selectInput('parteRepresentada', 'Parte representada', PARTES, causa.parteRepresentada);
  inputs.contraparte = textInput('contraparte', 'Contraparte', causa.contraparte);
  inputs.etapa = selectInput('etapa', 'Etapa', ETAPAS, causa.etapa);
  inputs.urlOJV = textInput('urlOJV', 'URL en OJV', causa.urlOJV, false, {
    type: 'url', placeholder: 'https://oficinajudicialvirtual.pjud.cl/...',
  });
  inputs.honorariosTipo = selectInput('honorariosTipo', 'Tipo de honorarios', HONORARIO_TIPOS, causa.honorarios?.tipo || 'fijo');
  inputs.honorariosMonto = textInput('honorariosMonto', 'Monto', String(causa.honorarios?.monto ?? ''), false, { type: 'number', inputmode: 'numeric' });
  inputs.honorariosMoneda = selectInput('honorariosMoneda', 'Moneda', [['CLP', 'CLP'], ['UF', 'UF']], causa.honorarios?.moneda || 'CLP');
  inputs.notasHonorarios = textInput('notasHonorarios', 'Notas honorarios', causa.notasHonorarios, false, {
    placeholder: 'Ej. 30% del monto demandado',
  });

  const view = el('div.view-form.app-container', {}, [
    el('header.ficha-header', {}, [
      el('a.ficha-back', {
        href: editing ? `#causas/${id}` : '#causas',
        aria: { label: 'Volver' },
      }, [icon('arrowLeft', { size: 22 })]),
      el('h1.ficha-titulo', { text: editing ? 'Editar causa' : 'Nueva causa' }),
    ]),

    el('form.stack-loose', { id: 'causa-form', on: { submit: (e) => { e.preventDefault(); guardar(); } } }, [
      // Sección Identificación (abierta)
      el('details.collapsible', { open: true }, [
        el('summary', { text: 'Identificación' }),
        el('div.body.stack', {}, [
          inputs.rol.field,
          inputs.tribunal.field,
          inputs.materia.field,
          inputs.caratulado.field,
          inputs.parteRepresentada.field,
        ]),
      ]),

      el('details.collapsible', {}, [
        el('summary', { text: 'Contraparte y etapa' }),
        el('div.body.stack', {}, [
          inputs.contraparte.field,
          inputs.etapa.field,
          inputs.urlOJV.field,
        ]),
      ]),

      el('details.collapsible', {}, [
        el('summary', { text: 'Honorarios' }),
        el('div.body.stack', {}, [
          inputs.honorariosTipo.field,
          el('div.row', {}, [
            el('div', { style: { flex: '2' } }, [inputs.honorariosMonto.field]),
            el('div', { style: { flex: '1' } }, [inputs.honorariosMoneda.field]),
          ]),
          inputs.notasHonorarios.field,
        ]),
      ]),

      el('div.form-actions', {}, [
        el('a.btn.btn-ghost', { href: editing ? `#causas/${id}` : '#causas', text: 'Cancelar' }),
        el('button.btn.btn-primary', { type: 'submit', text: editing ? 'Guardar cambios' : 'Crear causa' }),
      ]),
    ]),
  ]);

  mount(root, view);

  // Auto-focus primer campo en creación.
  if (!editing) requestAnimationFrame(() => inputs.rol.input.focus());

  async function guardar() {
    // Validación inline al perder foco ya pasó. Acá validamos obligatorios al submit.
    const errors = [];
    if (!inputs.rol.input.value.trim()) errors.push(inputs.rol);
    if (!inputs.tribunal.input.value.trim()) errors.push(inputs.tribunal);

    inputs.rol.clearError();
    inputs.tribunal.clearError();

    if (errors.length) {
      errors.forEach((f) => f.setError('Este campo es obligatorio'));
      errors[0].input.focus();
      return;
    }

    const data = {
      rol: inputs.rol.input.value.trim(),
      tribunal: inputs.tribunal.input.value.trim(),
      materia: inputs.materia.input.value,
      caratulado: inputs.caratulado.input.value.trim(),
      parteRepresentada: inputs.parteRepresentada.input.value,
      contraparte: inputs.contraparte.input.value.trim(),
      etapa: inputs.etapa.input.value,
      urlOJV: inputs.urlOJV.input.value.trim(),
      honorarios: {
        tipo: inputs.honorariosTipo.input.value,
        monto: Number(inputs.honorariosMonto.input.value) || 0,
        moneda: inputs.honorariosMoneda.input.value,
      },
      notasHonorarios: inputs.notasHonorarios.input.value.trim(),
    };

    if (editing) {
      await db.causas.update(id, data);
      toast('Causa actualizada');
      location.hash = `#causas/${id}`;
    } else {
      const created = await db.causas.create(data);
      toast('Causa creada');
      ofrecerBorrarEjemplosSiPrimerRegistroPropio(db, toast);
      location.hash = `#causas/${created.id}`;
    }
  }
}

// ===== Helpers de campo con validación inline =====
function textInput(name, label, value, required = false, extra = {}) {
  const input = el('input.input', {
    type: 'text', name, value: value ?? '', id: `f-${name}`,
    ...extra,
  });
  const errEl = el('p.error', { hidden: true });
  const labelEl = el('label.label', { for: `f-${name}` }, [
    label,
    required && el('span.required', { text: '*' }),
  ]);
  const field = el('div.field', {}, [labelEl, input, errEl]);

  input.addEventListener('blur', () => {
    if (required && !input.value.trim()) setError('Este campo es obligatorio');
    else clearError();
  });

  function setError(msg) { errEl.textContent = msg; errEl.hidden = false; input.style.borderColor = 'var(--status-urgent)'; }
  function clearError() { errEl.hidden = true; input.style.borderColor = ''; }

  return { field, input, setError, clearError };
}

function selectInput(name, label, options, value) {
  const input = el('select.select', { name, id: `f-${name}` },
    options.map(([v, t]) => el('option', { value: v, text: t, selected: v === value }))
  );
  const labelEl = el('label.label', { for: `f-${name}`, text: label });
  const field = el('div.field', {}, [labelEl, input]);
  return { field, input, setError: () => {}, clearError: () => {} };
}
