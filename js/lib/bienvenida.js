// Modal de bienvenida única sobre cómo funcionan los avisos en Nina.
// Se muestra una sola vez (flag en localStorage).

import { el, modal } from './render.js';
import { icon } from './icons.js';

const FLAG = 'bienvenida-notificaciones-v2';

export function mostrarBienvenidaSiPrimerUso() {
  if (localStorage.getItem(FLAG)) return;
  localStorage.setItem(FLAG, new Date().toISOString());

  let close;
  const content = el('div.stack', {}, [
    el('div.modal-header', {}, [
      el('div.modal-title', { text: 'Sobre los avisos' }),
      el('button.btn-icon', {
        type: 'button', aria: { label: 'Cerrar' },
        on: { click: () => close() },
      }, [icon('x', { size: 22 })]),
    ]),
    el('p', {
      text: 'Nina no te bombardea con notificaciones. En cambio:',
      style: { color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' },
    }),
    el('ul.bienvenida-lista', {}, [
      el('li', { text: 'Cuando capturas una audiencia o un plazo, te ofrezco mandarla a tu calendario. Tú eliges desde ahí cuándo quieres que te avise.' }),
      el('li', { text: 'Si abres Nina y tienes algo importante para hoy, te lo recuerdo una vez. Nada más.' }),
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
