// Modal de bienvenida única. Se muestra una sola vez (flag en localStorage).
// Saludo personal a Nina, sin nombrar el proyecto en tercera persona.

import { el, modal } from './render.js';
import { icon } from './icons.js';

const FLAG = 'bienvenida-notificaciones-v2';

export function mostrarBienvenidaSiPrimerUso() {
  if (localStorage.getItem(FLAG)) return;
  localStorage.setItem(FLAG, new Date().toISOString());

  let close;
  const content = el('div.stack', {}, [
    el('div.modal-header', {}, [
      el('div.modal-title', { text: 'Hola, Nina' }),
      el('button.btn-icon', {
        type: 'button', aria: { label: 'Cerrar' },
        on: { click: () => close() },
      }, [icon('x', { size: 22 })]),
    ]),
    el('p.bienvenida-intro', {
      text: 'Esto es para ti. Espero te sirva.',
    }),
    el('p', {
      text: 'Sobre los avisos: nada de bombardearte con notificaciones. En cambio:',
      style: { color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' },
    }),
    el('ul.bienvenida-lista', {}, [
      el('li', { text: 'Cuando anotas una audiencia o un plazo, te ofrezco mandarla a tu calendario. Tú eliges desde ahí cuándo quieres que te avise.' }),
      el('li', { text: 'Si abres la app y tienes algo importante para hoy, te lo recuerdo una vez. Nada más.' }),
      el('li', { text: 'Todo esto se ajusta desde "Ajustes" cuando quieras.' }),
    ]),
    el('button.btn.btn-primary.btn-block', {
      type: 'button', text: 'Entendido',
      style: { marginTop: 'var(--space-3)' },
      on: { click: () => close() },
    }),
  ]);

  close = modal(content, { ariaLabel: 'Bienvenida' });
}
