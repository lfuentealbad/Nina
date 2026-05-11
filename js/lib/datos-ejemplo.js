// js/lib/datos-ejemplo.js
//
// Datos de ejemplo precargados en la primera apertura de Nina.
// Se insertan automáticamente si la base está vacía.
// Cada registro tiene `esEjemplo: true` para que se puedan filtrar/borrar
// desde Ajustes con un botón "Borrar ejemplos".
//
// Las fechas se calculan en runtime relativas a HOY al momento de la inserción,
// para que Carolina siempre vea casos en distintos estados de urgencia
// independiente de cuándo abra la app por primera vez.

import { uuid } from './render.js';
import { nowTimestamp, hoyISO } from './fechas.js';

/** Calcula una fecha relativa a hoy en formato YYYY-MM-DD. */
function diasDesdeHoy(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Genera el set de causas y tareas de ejemplo.
 * Llamar al insertar; las fechas se resuelven en este momento.
 */
export function generarDatosEjemplo() {
  const ahora = nowTimestamp();

  // ===== Causas =====
  const causaCivil = {
    id: uuid(),
    rol: 'C-1845-2025',
    tribunal: '2° Juzgado Civil de Concepción',
    materia: 'civil',
    caratulado: 'Soto Carrasco con Inmobiliaria Andes Sur SpA',
    parteRepresentada: 'demandante',
    contraparte: 'Inmobiliaria Andes Sur SpA',
    etapa: 'prueba',
    urlOJV: '',
    honorarios: { tipo: 'mixto', monto: 0, moneda: 'CLP' },
    notasHonorarios: 'Honorarios mixtos: cuota litis 20% sobre lo recuperado + suma fija inicial.',
    notas: 'Cobro de pesos por incumplimiento de contrato de promesa de compraventa. Cliente entregó pie de UF 350 y la inmobiliaria no escrituró en plazo.',
    archivada: false,
    esEjemplo: true,
    creadaEn: ahora,
    actualizadaEn: ahora,
  };

  const causaFamilia = {
    id: uuid(),
    rol: 'F-892-2025',
    tribunal: 'Juzgado de Familia de Concepción',
    materia: 'familia',
    caratulado: 'Vásquez Hernández con González Muñoz',
    parteRepresentada: 'demandante',
    contraparte: 'Patricio González Muñoz',
    etapa: 'discusión',
    urlOJV: '',
    honorarios: { tipo: 'fijo', monto: 450000, moneda: 'CLP' },
    notasHonorarios: 'Suma alzada acordada con la clienta. Plan de pago en 3 cuotas.',
    notas: 'Demanda de aumento de pensión alimenticia. Pensión actual de $180.000 fijada en 2022, sin reajuste. Hija de 14 años en colegio particular subvencionado.',
    archivada: false,
    esEjemplo: true,
    creadaEn: ahora,
    actualizadaEn: ahora,
  };

  // ===== Tareas =====
  // Distribuidas para que Carolina vea el semáforo en todos sus estados:
  // - 1 audiencia mañana (urgente, ámbar)
  // - 1 plazo en 3 días (atención suave)
  // - 1 audiencia en 8 días (ok, sin alarma)
  // - 1 gestión sin fecha (en bandeja)
  // - 1 gestión hoy (urgente, hoy)
  //
  // La idea es que al primer pantallazo se vea el semáforo en distintos colores.

  const tareas = [
    // Gestión simple para hoy — se muestra como tarjeta de foco si nada más es más urgente
    {
      id: uuid(),
      causaId: causaCivil.id,
      titulo: 'Llamar a la perito tasadora',
      descripcion: 'Confirmar fecha de informe pericial de avalúo del inmueble.',
      tipo: 'gestion',
      fechaVencimiento: diasDesdeHoy(0),
      horaVencimiento: null,
      prioridad: 'media',
      completada: false,
      completadaEn: null,
      subtareas: null,
      esEjemplo: true,
      creadaEn: ahora,
    },

    // Comparendo mañana — debería ser la tarjeta de foco principal
    {
      id: uuid(),
      causaId: causaFamilia.id,
      titulo: 'Comparendo de conciliación',
      descripcion: 'Comparendo en sala 3. Llevar última liquidación de sueldo del demandado y certificado de matrícula de la menor.',
      tipo: 'audiencia',
      fechaVencimiento: diasDesdeHoy(1),
      horaVencimiento: '09:00',
      prioridad: 'alta',
      completada: false,
      completadaEn: null,
      subtareas: null,
      esEjemplo: true,
      creadaEn: ahora,
    },

    // Plazo procesal en 3 días — semáforo en atención suave
    {
      id: uuid(),
      causaId: causaCivil.id,
      titulo: 'Presentar lista de testigos',
      descripcion: 'Plazo art. 320 CPC. Lista con identificación completa y materia de cada testigo.',
      tipo: 'plazo',
      fechaVencimiento: diasDesdeHoy(3),
      horaVencimiento: null,
      prioridad: 'alta',
      completada: false,
      completadaEn: null,
      subtareas: null,
      esEjemplo: true,
      creadaEn: ahora,
    },

    // Audiencia más adelante — semáforo en ok
    {
      id: uuid(),
      causaId: causaCivil.id,
      titulo: 'Audiencia de prueba testimonial',
      descripcion: 'Audiencia de testigos. Coordinar previamente con los 3 testigos confirmados.',
      tipo: 'audiencia',
      fechaVencimiento: diasDesdeHoy(8),
      horaVencimiento: '10:30',
      prioridad: 'alta',
      completada: false,
      completadaEn: null,
      subtareas: null,
      esEjemplo: true,
      creadaEn: ahora,
    },

    // Tarea sin fecha — va a la bandeja
    {
      id: uuid(),
      causaId: null,
      titulo: 'Pasar a notaría a retirar copia autorizada',
      descripcion: '',
      tipo: 'gestion',
      fechaVencimiento: null,
      horaVencimiento: null,
      prioridad: 'baja',
      completada: false,
      completadaEn: null,
      subtareas: null,
      esEjemplo: true,
      creadaEn: ahora,
    },
  ];

  return {
    causas: [causaCivil, causaFamilia],
    tareas,
    hitos: [], // Sin hitos de ejemplo por ahora
  };
}

/**
 * Inserta los datos de ejemplo en la BD si esta está vacía.
 * Llamar al cargar la app por primera vez.
 * Retorna true si insertó, false si la base ya tenía datos.
 */
export async function insertarEjemplosSiVacia(db) {
  const [causas, tareas] = await Promise.all([
    db.causas.list({ archivada: null }),
    db.tareas.list(),
  ]);

  if (causas.length > 0 || tareas.length > 0) return false;

  const ejemplos = generarDatosEjemplo();

  // Insertar directamente con put, no con create, para preservar IDs y fechas.
  const idb = await db.openDb();
  const tx = idb.transaction(['causas', 'tareas'], 'readwrite');

  for (const c of ejemplos.causas) tx.objectStore('causas').put(c);
  for (const t of ejemplos.tareas) tx.objectStore('tareas').put(t);

  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  // Marcar en localStorage que ya se insertaron, para no reintentar
  // si Carolina borra todo manualmente.
  localStorage.setItem('ejemplos-insertados', new Date().toISOString());

  return true;
}

/**
 * Borra todos los registros con esEjemplo: true.
 * Llamar desde el botón "Borrar ejemplos" en Ajustes y desde el toast inicial.
 */
export async function borrarEjemplos(db) {
  const [causas, tareas] = await Promise.all([
    db.causas.list({ archivada: null }),
    db.tareas.list(),
  ]);

  const causasEjemplo = causas.filter((c) => c.esEjemplo);
  const tareasEjemplo = tareas.filter((t) => t.esEjemplo);

  // Borrar causas completas (esto cascadea sus tareas e hitos asociados).
  for (const c of causasEjemplo) await db.causas.delete(c.id);

  // Borrar tareas sueltas de ejemplo (sin causa).
  for (const t of tareasEjemplo) {
    if (!t.causaId) await db.tareas.delete(t.id);
  }

  localStorage.setItem('ejemplos-borrados', new Date().toISOString());
}

/**
 * Ofrece (una sola vez) borrar los ejemplos cuando Carolina crea su primer
 * registro propio. Si ya se ofreció antes, no hace nada. Si no quedan ejemplos
 * tampoco. Llamar después de crear una causa o tarea propia.
 */
export async function ofrecerBorrarEjemplosSiPrimerRegistroPropio(db, toast) {
  const FLAG = 'oferta-borrar-ejemplos-mostrada';
  if (localStorage.getItem(FLAG)) return;
  if (!(await quedanEjemplos(db))) return;

  localStorage.setItem(FLAG, new Date().toISOString());

  setTimeout(() => {
    toast('Esa es tuya. ¿Quieres que borre los ejemplos para empezar limpia?', {
      dur: 8000,
      action: {
        label: 'Sí, borralos',
        onClick: async () => {
          await borrarEjemplos(db);
          toast('Listo, ejemplos borrados');
        },
      },
    });
  }, 2000);
}

/** Verifica si todavía quedan registros de ejemplo en la BD. */
export async function quedanEjemplos(db) {
  const [causas, tareas] = await Promise.all([
    db.causas.list({ archivada: null }),
    db.tareas.list(),
  ]);
  return causas.some((c) => c.esEjemplo) || tareas.some((t) => t.esEjemplo);
}
