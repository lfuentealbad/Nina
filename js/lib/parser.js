// Parser de captura libre en español.
//
// Lee una frase tal como Nina la escribe ("Audiencia mañana 10am Pérez con
// Rojas") y devuelve los campos extraídos. Lo que no entiende lo deja en
// `titulo` para no perder información. Nunca bloquea; nunca pide aclaración.
//
// Salida: { titulo, fechaVencimiento, horaVencimiento, tipo }
//   fechaVencimiento → YYYY-MM-DD o null
//   horaVencimiento  → HH:MM o null
//   tipo             → 'audiencia' | 'plazo' | 'gestion'

import { toISO } from './fechas.js';

const DIAS_SEMANA = {
  domingo: 0, lunes: 1, martes: 2,
  miercoles: 3, 'miércoles': 3,
  jueves: 4, viernes: 5,
  sabado: 6, 'sábado': 6,
};

const PALABRAS_AUDIENCIA = ['audiencia', 'comparendo', 'vista', 'juicio'];
const PALABRAS_PLAZO = ['plazo', 'vence', 'vencimiento'];

export function parsearCaptura(texto) {
  if (!texto || typeof texto !== 'string') {
    return { titulo: '', fechaVencimiento: null, horaVencimiento: null, tipo: 'gestion' };
  }

  let trabajo = ` ${texto.trim()} `;
  let fechaVencimiento = null;
  let horaVencimiento = null;
  let tipo = 'gestion';

  // --- Tipo ---
  const tipoMatch = detectarTipo(trabajo);
  if (tipoMatch) {
    tipo = tipoMatch.tipo;
    trabajo = quitarTrozo(trabajo, tipoMatch.indice, tipoMatch.largo);
  }

  // --- Hora --- (antes que fecha; "a las 10" no debe consumir "10" como día)
  const horaMatch = detectarHora(trabajo);
  if (horaMatch) {
    horaVencimiento = horaMatch.hora;
    trabajo = quitarTrozo(trabajo, horaMatch.indice, horaMatch.largo);
  }

  // --- Fecha ---
  const fechaMatch = detectarFecha(trabajo);
  if (fechaMatch) {
    fechaVencimiento = fechaMatch.fechaISO;
    trabajo = quitarTrozo(trabajo, fechaMatch.indice, fechaMatch.largo);
  }

  const titulo = limpiar(trabajo);
  return { titulo, fechaVencimiento, horaVencimiento, tipo };
}

// ===== Detectores =====

function detectarTipo(s) {
  const lower = normalizar(s);
  for (const p of PALABRAS_AUDIENCIA) {
    const i = lower.indexOf(` ${p}`);
    if (i >= 0) return { tipo: 'audiencia', indice: i, largo: p.length + 1 };
  }
  for (const p of PALABRAS_PLAZO) {
    const i = lower.indexOf(` ${p}`);
    if (i >= 0) return { tipo: 'plazo', indice: i, largo: p.length + 1 };
  }
  return null;
}

function detectarHora(s) {
  // "a las N" / "a las N:MM" / "a las N am/pm"
  let m = s.match(/\sa las\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (m) {
    const h = normalizarHora(parseInt(m[1], 10), m[2], m[3]);
    if (h) return { hora: h, indice: m.index, largo: m[0].length };
  }

  // "mediodía" / "mediodia"
  m = s.match(/\smedio\s?d[ií]a/i);
  if (m) return { hora: '12:00', indice: m.index, largo: m[0].length };

  // "10:30am" / "10:30 am" / "10:30" / "10am" / "2 pm"
  m = s.match(/\s(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (m) {
    const h = normalizarHora(parseInt(m[1], 10), m[2], m[3]);
    if (h) return { hora: h, indice: m.index, largo: m[0].length };
  }

  // "14:30" / "09:00" sin am/pm — solo si es formato HH:MM razonable
  m = s.match(/\s(\d{1,2}):(\d{2})\b/);
  if (m) {
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      return {
        hora: `${pad(h)}:${pad(min)}`,
        indice: m.index,
        largo: m[0].length,
      };
    }
  }

  return null;
}

function detectarFecha(s) {
  const lower = normalizar(s);
  const ahora = new Date();

  // "pasado mañana"
  let m = lower.match(/\spasado\s+ma(?:n|ñ)ana\b/);
  if (m) return { fechaISO: isoDelta(2, ahora), indice: m.index, largo: m[0].length };

  // "mañana"
  m = lower.match(/\sma(?:n|ñ)ana\b/);
  if (m) return { fechaISO: isoDelta(1, ahora), indice: m.index, largo: m[0].length };

  // "hoy"
  m = lower.match(/\shoy\b/);
  if (m) return { fechaISO: isoDelta(0, ahora), indice: m.index, largo: m[0].length };

  // "en N días"
  m = lower.match(/\sen\s+(\d{1,2})\s+d[ií]as?\b/);
  if (m) {
    return { fechaISO: isoDelta(parseInt(m[1], 10), ahora), indice: m.index, largo: m[0].length };
  }

  // "próximo lunes" / "el lunes" / "lunes"
  m = lower.match(/\s(?:pr[oó]ximo|el)?\s*(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)\b/);
  if (m) {
    const dia = limpiarDia(m[1]);
    const target = DIAS_SEMANA[dia];
    if (target !== undefined) {
      const delta = deltaHaciaDia(ahora.getDay(), target);
      return { fechaISO: isoDelta(delta, ahora), indice: m.index, largo: m[0].length };
    }
  }

  return null;
}

// ===== Helpers =====

function normalizar(s) {
  return s.toLowerCase();
}

function pad(n) { return String(n).padStart(2, '0'); }

function normalizarHora(h, minStr, ampm) {
  if (Number.isNaN(h)) return null;
  let hh = h;
  const min = minStr ? parseInt(minStr, 10) : 0;
  if (ampm) {
    const tag = ampm.toLowerCase();
    if (tag === 'pm' && hh < 12) hh += 12;
    if (tag === 'am' && hh === 12) hh = 0;
  }
  if (hh < 0 || hh > 23 || min < 0 || min > 59) return null;
  return `${pad(hh)}:${pad(min)}`;
}

function isoDelta(dias, base = new Date()) {
  const d = new Date(base);
  d.setDate(d.getDate() + dias);
  return toISO(d);
}

/** Días hasta el próximo `target` día de la semana (1..7; nunca 0). */
function deltaHaciaDia(actual, target) {
  let delta = target - actual;
  if (delta <= 0) delta += 7;
  return delta;
}

function limpiarDia(s) {
  return s
    .replace(/é/g, 'e')
    .replace(/á/g, 'a')
    .replace(/í/g, 'i');
}

function quitarTrozo(s, indice, largo) {
  return s.slice(0, indice) + ' ' + s.slice(indice + largo);
}

function limpiar(s) {
  return s.replace(/\s+/g, ' ').trim();
}
