// Notificación local al abrir la app, máximo una vez por día.
//
// Reglas:
//   - Si no hay nada notable hoy ni mañana, no notifica.
//   - Solo dispara si Notification.permission === 'granted'. Si está en
//     'default', NO pide permiso aquí (eso pasa al activar el toggle en
//     Ajustes). Si está en 'denied', no hace nada.
//   - Se marca el flag last-daily-check con la fecha ISO de hoy. Si ya se
//     intentó hoy, no vuelve a intentar.
//   - Click en la notificación trae la pestaña al foco y navega a #hoy.

import db from '../db.js';
import { hoyISO } from './fechas.js';

const FLAG = 'last-daily-check';

export async function avisoDiarioSiCorresponde() {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  if (localStorage.getItem(FLAG) === hoyISO()) return;

  const resumen = await armarResumen();
  if (!resumen) {
    // No hay nada notable; igual marcamos para no recalcular muchas veces hoy.
    localStorage.setItem(FLAG, hoyISO());
    return;
  }

  try {
    const n = new Notification('Tu día de hoy', {
      body: resumen,
      silent: false,
      tag: 'nina-aviso-diario',
    });
    n.onclick = () => {
      try { window.focus(); } catch (e) {}
      location.hash = '#hoy';
      n.close();
    };
  } catch (e) {
    // En algunos contextos (file://, navegadores no soportados) Notification
    // está pero falla al construir. No ensuciamos consola.
  }

  localStorage.setItem(FLAG, hoyISO());
}

/** Arma el texto del aviso. Null si no hay nada notable hoy. */
async function armarResumen() {
  const hoy = hoyISO();
  const todas = await db.tareas.list();
  const activas = todas.filter((t) => !t.completada && !t.vencida);

  // Audiencia hoy con hora futura → prioridad.
  const ahora = new Date();
  const nowMin = ahora.getHours() * 60 + ahora.getMinutes();
  const audienciasHoy = activas
    .filter((t) =>
      t.tipo === 'audiencia' &&
      t.fechaVencimiento === hoy &&
      t.horaVencimiento
    )
    .filter((t) => {
      const [h, m] = t.horaVencimiento.split(':').map(Number);
      return (h * 60 + m) >= nowMin;
    })
    .sort((a, b) => a.horaVencimiento.localeCompare(b.horaVencimiento));
  if (audienciasHoy[0]) {
    const a = audienciasHoy[0];
    return `Hoy ${a.horaVencimiento} · ${a.titulo}`;
  }

  // Plazo (no audiencia) hoy.
  const plazoHoy = activas.find((t) => t.tipo !== 'audiencia' && t.fechaVencimiento === hoy);
  if (plazoHoy) return `Hoy · ${plazoHoy.titulo}`;

  return null;
}
