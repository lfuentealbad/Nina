// Helpers de fecha. Trabajamos en zona horaria local (Chile) para que "hoy" coincida con
// el calendario que ve la usuaria. Días corridos, no hábiles (eso es Fase 2).

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Devuelve fecha local como YYYY-MM-DD (no UTC). */
export function hoyISO() {
  return toISO(new Date());
}

/** Convierte Date local a YYYY-MM-DD. */
export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parsea YYYY-MM-DD como fecha local (no UTC). */
export function fromISO(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Días enteros desde hoy hasta fechaISO. Negativo si está vencida. */
export function diasHasta(fechaISO) {
  if (!fechaISO) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const target = fromISO(fechaISO);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - hoy) / 86400000);
}

/** "viernes, 9 de mayo de 2026" */
export function formatoLargo(fechaISO) {
  const d = fechaISO ? fromISO(fechaISO) : new Date();
  return `${DIAS_SEMANA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/** "9 may 2026" o "9 may" si es del año actual. */
export function formatoCorto(fechaISO) {
  if (!fechaISO) return '';
  const d = fromISO(fechaISO);
  const ahora = new Date();
  const sufijo = d.getFullYear() !== ahora.getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}${sufijo}`;
}

/**
 * Devuelve datos de semáforo a partir de fechaISO.
 * @returns { class, label, dias }
 *   class: semaforo-urgent | semaforo-warn | semaforo-soon | semaforo-far
 */
export function semaforo(fechaISO) {
  const dias = diasHasta(fechaISO);
  if (dias === null) return null;
  if (dias < 0) return { class: 'semaforo-urgent', label: 'Vencido', dias };
  if (dias === 0) return { class: 'semaforo-urgent', label: 'Hoy', dias };
  if (dias === 1) return { class: 'semaforo-warn', label: 'Mañana', dias };
  if (dias === 2) return { class: 'semaforo-warn', label: 'En 2 días', dias };
  if (dias <= 5) return { class: 'semaforo-soon', label: `En ${dias} días`, dias };
  return { class: 'semaforo-far', label: `En ${dias} días`, dias };
}

/**
 * "Buenos días/tardes/noches" según la hora local.
 * Cortes: 5–12 días, 12–20 tardes, 20–5 noches.
 */
export function saludoPorHora(fecha = new Date()) {
  const h = fecha.getHours();
  if (h >= 5 && h < 12) return 'Buenos días';
  if (h >= 12 && h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

/** ISO timestamp completo (incluye hora). Para creadaEn / actualizadaEn / completadaEn. */
export function nowTimestamp() {
  return new Date().toISOString();
}
