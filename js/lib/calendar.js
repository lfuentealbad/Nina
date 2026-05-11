// Generación de archivos iCalendar (.ics) y despacho al calendario nativo.
//
// Estrategia: armamos el .ics con los recordatorios ya configurados (VALARM)
// y lo entregamos al sistema operativo vía Web Share API si está disponible
// (Android Chrome, iOS Safari), con fallback a descarga clásica.
//
// Toda fecha/hora se serializa en UTC para evitar problemas de zona horaria
// al importar.

import { fromISO } from './fechas.js';

const FLAG_TOAST = 'ics-toast-shown';

/**
 * Wrapper de alto nivel para la UI: comparte el .ics y, la primera vez,
 * muestra un toast informativo explicando qué va a pasar.
 *
 * @param tarea  La tarea a despachar (necesita fechaVencimiento).
 * @param causa  Causa asociada (opcional, mejora el evento).
 * @param toast  Función toast importada de render.js.
 */
export async function despacharACalendario(tarea, causa, toast) {
  if (!tarea?.fechaVencimiento) {
    if (toast) toast('Necesito una fecha para mandar al calendario');
    return false;
  }

  const yaInformado = localStorage.getItem(FLAG_TOAST);
  if (!yaInformado && toast) {
    toast(
      'Te preparé un archivo para tu calendario. Tu Android te va a preguntar a qué app mandarlo — elige tu calendario y desde ahí decides cuándo quieres que te avise.',
      { dur: 8000 }
    );
    localStorage.setItem(FLAG_TOAST, new Date().toISOString());
  }

  return compartirICS(tarea, causa);
}

const DURACION_MIN = { audiencia: 60, plazo: 15, gestion: 30 };

/**
 * Construye un iCalendar válido (RFC 5545) para una tarea.
 * Si la tarea tiene hora, evento con DTSTART/DTEND UTC.
 * Si no, evento all-day.
 * Audiencias incluyen un VALARM extra a -1 día.
 */
export function tareaAICS(tarea, causa) {
  const uid = `nina-${tarea.id}@local`;
  const dtstamp = formatoUTC(new Date());
  const tieneHora = !!tarea.horaVencimiento;
  const descripcionPartes = [];
  if (tarea.descripcion) descripcionPartes.push(tarea.descripcion);
  if (causa?.caratulado) descripcionPartes.push(causa.caratulado);
  if (causa?.tribunal) descripcionPartes.push(causa.tribunal);

  const summary = escapeICS(tarea.titulo || 'Sin título');
  const description = escapeICS(descripcionPartes.join('\n'));
  const location = escapeICS(causa?.tribunal || '');

  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nina//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
  ];

  if (tieneHora) {
    const inicio = construirFechaUTC(tarea.fechaVencimiento, tarea.horaVencimiento);
    const minutos = DURACION_MIN[tarea.tipo] || 30;
    const fin = new Date(inicio.getTime() + minutos * 60000);
    lineas.push(`DTSTART:${formatoUTC(inicio)}`);
    lineas.push(`DTEND:${formatoUTC(fin)}`);
  } else {
    const inicio = tarea.fechaVencimiento.replace(/-/g, '');
    const finDate = new Date(fromISO(tarea.fechaVencimiento));
    finDate.setDate(finDate.getDate() + 1);
    const fin = formatoFechaDate(finDate);
    lineas.push(`DTSTART;VALUE=DATE:${inicio}`);
    lineas.push(`DTEND;VALUE=DATE:${fin}`);
  }

  lineas.push(`SUMMARY:${summary}`);
  if (description) lineas.push(`DESCRIPTION:${description}`);
  if (location) lineas.push(`LOCATION:${location}`);

  // VALARM -1h siempre
  lineas.push(
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${summary}`,
    'END:VALARM'
  );

  // VALARM -1d adicional para audiencias
  if (tarea.tipo === 'audiencia') {
    lineas.push(
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      `DESCRIPTION:${summary}`,
      'END:VALARM'
    );
  }

  lineas.push('END:VEVENT', 'END:VCALENDAR');

  // RFC 5545: separador CRLF.
  return lineas.join('\r\n') + '\r\n';
}

/**
 * Intenta compartir vía Web Share API. Si no está disponible o falla,
 * descarga el archivo. Devuelve true si llegó al menos al menú/descarga.
 */
export async function compartirICS(tarea, causa) {
  const contenido = tareaAICS(tarea, causa);
  const nombre = `nina-${slug(tarea.titulo || 'evento')}.ics`;
  const blob = new Blob([contenido], { type: 'text/calendar;charset=utf-8' });

  // navigator.canShare con archivos: Android moderno + iOS reciente.
  if (typeof navigator !== 'undefined' && navigator.canShare) {
    try {
      const file = new File([blob], nombre, { type: 'text/calendar' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: tarea.titulo || 'Evento' });
        return true;
      }
    } catch (err) {
      // AbortError = la usuaria cerró el sheet; no es error real.
      if (err && err.name === 'AbortError') return false;
      // Cualquier otro error: caer al fallback.
    }
  }

  descargarICS(blob, nombre);
  return true;
}

/** Descarga directa del blob como archivo. */
export function descargarICS(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ===== Helpers =====

/** Escapado RFC 5545 para SUMMARY/DESCRIPTION/LOCATION. */
function escapeICS(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/** Date → "YYYYMMDDTHHMMSSZ" UTC. */
function formatoUTC(d) {
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const dd = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  const ss = pad(d.getUTCSeconds());
  return `${y}${m}${dd}T${hh}${mm}${ss}Z`;
}

/** Date → "YYYYMMDD" en zona local. */
function formatoFechaDate(d) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

/** Construye un Date local desde YYYY-MM-DD + HH:MM. */
function construirFechaUTC(fechaISO, horaHHMM) {
  const [y, m, dd] = fechaISO.split('-').map(Number);
  const [h, mm] = horaHHMM.split(':').map(Number);
  return new Date(y, m - 1, dd, h, mm, 0);
}

function pad(n) { return String(n).padStart(2, '0'); }

function slug(s) {
  return (s || 'evento')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'evento';
}
