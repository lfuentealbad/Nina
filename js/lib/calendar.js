// Despacho de eventos al calendario nativo.
//
// La estrategia v3 reemplaza la descarga directa de .ics por un menú con tres
// opciones: Google Calendar (URL template — funciona en Android e iOS si la
// usuaria tiene Google Calendar instalado), Apple Calendar (.ics como fallback)
// y Outlook web. Google va destacado como "recomendado" en mobile.
//
// El toggle "Mandar audiencias al calendario automáticamente" abre Google
// Calendar directo, sin pasar por el menú.

import { fromISO } from './fechas.js';
import { el, modal } from './render.js';
import { icon } from './icons.js';

const FLAG_TOAST = 'calendario-toast-shown';
const DURACION_MIN = { audiencia: 60, plazo: 15, gestion: 30 };
const TIPO_LABEL = { audiencia: 'Audiencia', comparendo: 'Comparendo', plazo: 'Plazo' };

// ===== Detección de plataforma =====
const UA = typeof navigator !== 'undefined' ? navigator.userAgent : '';
export const esIOS = /iPad|iPhone|iPod/.test(UA) && !(typeof window !== 'undefined' && window.MSStream);
export const esAndroid = /android/i.test(UA);

// ===== URLs de cada destino =====

/**
 * URL del template "render" de Google Calendar.
 * Funciona en navegador desktop y, si la app de Google Calendar está
 * instalada en Android/iOS, el sistema operativo intercepta el deep link.
 */
export function urlGoogleCalendar(tarea, causa) {
  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', textoEvento(tarea, causa));
  params.set('dates', rangoFechasGoogle(tarea));
  const detalles = detallesEvento(tarea, causa);
  if (detalles) params.set('details', detalles);
  if (causa?.tribunal) params.set('location', causa.tribunal);
  params.set('trp', 'true');
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * URL del compositor de eventos de Outlook web.
 * Acepta fechas ISO 8601 con offset local (no UTC pelado).
 */
export function urlOutlookCalendar(tarea, causa) {
  const params = new URLSearchParams();
  params.set('path', '/calendar/action/compose');
  params.set('rru', 'addevent');
  params.set('subject', textoEvento(tarea, causa));
  const rango = rangoFechasOutlook(tarea);
  params.set('startdt', rango.inicio);
  params.set('enddt', rango.fin);
  const cuerpo = detallesEvento(tarea, causa);
  if (cuerpo) params.set('body', cuerpo);
  if (causa?.tribunal) params.set('location', causa.tribunal);
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

// ===== Menú de opciones =====

/**
 * Abre el modal con las tres opciones de calendario.
 * Si el toggle "auto-calendario" está activo y la tarea es una audiencia con
 * fecha y hora, abre Google Calendar directo sin mostrar el menú.
 */
export function abrirMenuCalendario(tarea, causa, toast) {
  if (!tarea?.fechaVencimiento) {
    if (toast) toast('Necesito una fecha para mandar al calendario');
    return;
  }

  if (autoCalendarioActivo() && esAudienciaConHora(tarea)) {
    abrirGoogleCalendar(tarea, causa, toast);
    return;
  }

  let close;
  const recomendado = (esAndroid || esIOS);

  const opcionGoogle = botonOpcion({
    iconoNombre: 'googleCalendar',
    titulo: 'Google Calendar',
    descripcion: 'Abre tu app de Google Calendar',
    destacado: recomendado,
    onClick: () => {
      close();
      abrirGoogleCalendar(tarea, causa, toast);
    },
  });

  const opcionApple = botonOpcion({
    iconoNombre: 'calendar',
    titulo: 'Apple Calendar',
    descripcion: 'Descarga un archivo .ics',
    onClick: () => {
      close();
      descargarICSDeTarea(tarea, causa);
      mostrarToastInformativo(toast);
    },
    notaIOS: esIOS
      ? 'En iPhone, después de descargar abre el archivo desde la app Archivos para agregarlo a tu calendario. Apple no permite agregar archivos .ics directamente desde Safari.'
      : null,
  });

  const opcionOutlook = botonOpcion({
    iconoNombre: 'mail',
    titulo: 'Outlook',
    descripcion: 'Abre Outlook web con el evento listo',
    onClick: () => {
      close();
      window.open(urlOutlookCalendar(tarea, causa), '_blank', 'noopener');
      mostrarToastInformativo(toast);
    },
  });

  const content = el('div.stack', {}, [
    el('div.modal-header', {}, [
      el('div.modal-title', { text: 'Agregar a calendario' }),
      el('button.btn-icon', {
        type: 'button', aria: { label: 'Cerrar' },
        on: { click: () => close() },
      }, [icon('x', { size: 22 })]),
    ]),
    el('div.cal-opciones', {}, [opcionGoogle, opcionApple, opcionOutlook]),
  ]);

  close = modal(content, { ariaLabel: 'Elegir calendario' });
}

function abrirGoogleCalendar(tarea, causa, toast) {
  window.open(urlGoogleCalendar(tarea, causa), '_blank', 'noopener');
  mostrarToastInformativo(toast);
}

function autoCalendarioActivo() {
  return typeof localStorage !== 'undefined' && localStorage.getItem('auto-calendario') === '1';
}

function esAudienciaConHora(tarea) {
  return tarea.tipo === 'audiencia' && !!tarea.fechaVencimiento && !!tarea.horaVencimiento;
}

function mostrarToastInformativo(toast) {
  if (!toast) return;
  if (localStorage.getItem(FLAG_TOAST)) return;
  toast(
    'Cuando elijas Google Calendar, se abre tu app con el evento listo. Tú decides ahí cuándo quieres que te avise.',
    { dur: 8000 }
  );
  localStorage.setItem(FLAG_TOAST, new Date().toISOString());
}

function botonOpcion({ iconoNombre, titulo, descripcion, destacado = false, onClick, notaIOS = null }) {
  const wrapper = el('div.cal-opcion-wrap');
  const btn = el('button.cal-opcion', {
    type: 'button',
    on: { click: onClick },
  }, [
    el('span.cal-opcion-icono', {}, [icon(iconoNombre, { size: 24 })]),
    el('span.cal-opcion-textos', {}, [
      el('span.cal-opcion-titulo', { text: titulo }),
      el('span.cal-opcion-descripcion', { text: descripcion }),
    ]),
    destacado && el('span.cal-opcion-recomendado', { text: 'recomendado' }),
  ]);
  wrapper.appendChild(btn);
  if (notaIOS) wrapper.appendChild(el('p.cal-opcion-nota', { text: notaIOS }));
  return wrapper;
}

// ===== Compatibilidad con el resto de la app =====

/**
 * Wrapper mantenido por compatibilidad con las vistas: ahora delega siempre
 * al menú (y este decide si abre Google directo o muestra las opciones).
 */
export function despacharACalendario(tarea, causa, toast) {
  abrirMenuCalendario(tarea, causa, toast);
}

// ===== Generación de .ics (Apple Calendar fallback) =====

/** Construye un iCalendar válido (RFC 5545) para una tarea. */
export function tareaAICS(tarea, causa) {
  const uid = `nina-${tarea.id}@local`;
  const dtstamp = formatoUTC(new Date());
  const tieneHora = !!tarea.horaVencimiento;

  const summary = escapeICS(textoEvento(tarea, causa));
  const description = escapeICS(detallesEvento(tarea, causa));
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
    const inicio = construirFechaLocal(tarea.fechaVencimiento, tarea.horaVencimiento);
    const minutos = DURACION_MIN[tarea.tipo] || 30;
    const fin = new Date(inicio.getTime() + minutos * 60000);
    lineas.push(`DTSTART:${formatoUTC(inicio)}`);
    lineas.push(`DTEND:${formatoUTC(fin)}`);
  } else {
    const inicio = tarea.fechaVencimiento.replace(/-/g, '');
    const finDate = fromISO(tarea.fechaVencimiento);
    finDate.setDate(finDate.getDate() + 1);
    lineas.push(`DTSTART;VALUE=DATE:${inicio}`);
    lineas.push(`DTEND;VALUE=DATE:${formatoFechaDate(finDate)}`);
  }

  lineas.push(`SUMMARY:${summary}`);
  if (description) lineas.push(`DESCRIPTION:${description}`);
  if (location) lineas.push(`LOCATION:${location}`);

  lineas.push(
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${summary}`,
    'END:VALARM'
  );

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
  return lineas.join('\r\n') + '\r\n';
}

/** Genera el .ics y dispara la descarga. */
export function descargarICSDeTarea(tarea, causa) {
  const contenido = tareaAICS(tarea, causa);
  const nombre = `nina-${slug(tarea.titulo || 'evento')}.ics`;
  const blob = new Blob([contenido], { type: 'text/calendar;charset=utf-8' });
  descargarBlob(blob, nombre);
}

/** Descarga directa del blob como archivo (auxiliar). */
export function descargarICS(blob, nombre) {
  descargarBlob(blob, nombre);
}

function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ===== Helpers de texto =====

/** "Audiencia · F-892-2025 · Vásquez con González" o solo el título si no hay causa. */
function textoEvento(tarea, causa) {
  if (causa && causa.rol) {
    const tipoLabel = TIPO_LABEL[tarea.tipo];
    const partes = [];
    if (tipoLabel) partes.push(tipoLabel);
    partes.push(causa.rol);
    if (causa.caratulado) partes.push(causa.caratulado);
    return partes.join(' · ');
  }
  return tarea.titulo || 'Evento';
}

/** Descripción + datos de causa, separados con \n. */
function detallesEvento(tarea, causa) {
  const partes = [];
  if (tarea.descripcion) partes.push(tarea.descripcion);
  if (causa) {
    if (causa.caratulado) partes.push(`Causa: ${causa.caratulado}`);
    if (causa.tribunal) partes.push(`Tribunal: ${causa.tribunal}`);
    if (causa.rol) partes.push(`Rol: ${causa.rol}`);
  }
  return partes.join('\n');
}

// ===== Helpers de fecha =====

function rangoFechasGoogle(tarea) {
  if (tarea.horaVencimiento) {
    const inicio = construirFechaLocal(tarea.fechaVencimiento, tarea.horaVencimiento);
    const minutos = DURACION_MIN[tarea.tipo] || 30;
    const fin = new Date(inicio.getTime() + minutos * 60000);
    return `${formatoUTC(inicio)}/${formatoUTC(fin)}`;
  }
  const inicio = tarea.fechaVencimiento.replace(/-/g, '');
  const finDate = fromISO(tarea.fechaVencimiento);
  finDate.setDate(finDate.getDate() + 1);
  return `${inicio}/${formatoFechaDate(finDate)}`;
}

function rangoFechasOutlook(tarea) {
  if (tarea.horaVencimiento) {
    const inicio = construirFechaLocal(tarea.fechaVencimiento, tarea.horaVencimiento);
    const minutos = DURACION_MIN[tarea.tipo] || 30;
    const fin = new Date(inicio.getTime() + minutos * 60000);
    return { inicio: isoConOffsetLocal(inicio), fin: isoConOffsetLocal(fin) };
  }
  const inicio = `${tarea.fechaVencimiento}T00:00:00`;
  const fin = `${tarea.fechaVencimiento}T23:59:00`;
  return { inicio, fin };
}

/** Date → "YYYY-MM-DDTHH:MM:SS±HH:MM" con offset del dispositivo. */
function isoConOffsetLocal(d) {
  const offset = -d.getTimezoneOffset();
  const signo = offset >= 0 ? '+' : '-';
  const absMin = Math.abs(offset);
  const oh = pad(Math.floor(absMin / 60));
  const om = pad(absMin % 60);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${signo}${oh}:${om}`;
}

function formatoUTC(d) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function formatoFechaDate(d) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function construirFechaLocal(fechaISO, horaHHMM) {
  const [y, m, dd] = fechaISO.split('-').map(Number);
  const [h, mm] = horaHHMM.split(':').map(Number);
  return new Date(y, m - 1, dd, h, mm, 0);
}

function pad(n) { return String(n).padStart(2, '0'); }

function escapeICS(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

function slug(s) {
  return (s || 'evento')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'evento';
}
