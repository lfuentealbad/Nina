// Capa de acceso a IndexedDB. Promesificada. Toda la UI consume desde acá.
//
// Stores:
//   causas: { id, rol, tribunal, materia, caratulado, parteRepresentada, contraparte,
//             etapa, urlOJV, honorarios:{tipo,monto,moneda}, notasHonorarios, notas,
//             creadaEn, actualizadaEn, archivada }
//   tareas: { id, causaId, titulo, descripcion, tipo, fechaVencimiento, horaVencimiento,
//             prioridad, completada, completadaEn, creadaEn }
//   hitos:  { id, causaId, fecha, tipo, descripcion }
//
// Notas:
//   - fechaVencimiento es YYYY-MM-DD o null (bandeja de entrada).
//   - Búsquedas filtran en memoria (volumen pequeño, < 10k registros).

import { uuid } from './lib/render.js';
import { nowTimestamp, hoyISO } from './lib/fechas.js';

const DB_NAME = 'carolina';
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const idb = e.target.result;
      if (!idb.objectStoreNames.contains('causas')) {
        const s = idb.createObjectStore('causas', { keyPath: 'id' });
        s.createIndex('archivada', 'archivada');
        s.createIndex('materia', 'materia');
      }
      if (!idb.objectStoreNames.contains('tareas')) {
        const s = idb.createObjectStore('tareas', { keyPath: 'id' });
        s.createIndex('causaId', 'causaId');
        s.createIndex('fechaVencimiento', 'fechaVencimiento');
        s.createIndex('completada', 'completada');
        s.createIndex('tipo', 'tipo');
      }
      if (!idb.objectStoreNames.contains('hitos')) {
        const s = idb.createObjectStore('hitos', { keyPath: 'id' });
        s.createIndex('causaId', 'causaId');
        s.createIndex('fecha', 'fecha');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('DB blocked: cierra otras pestañas con Nina abierta'));
  });
  return dbPromise;
}

function tx(storeName, mode = 'readonly') {
  return openDb().then((idb) => idb.transaction(storeName, mode).objectStore(storeName));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAll(storeName) {
  const store = await tx(storeName);
  return reqToPromise(store.getAll());
}

async function getOne(storeName, id) {
  const store = await tx(storeName);
  return reqToPromise(store.get(id));
}

async function putOne(storeName, obj) {
  const store = await tx(storeName, 'readwrite');
  await reqToPromise(store.put(obj));
  return obj;
}

async function deleteOne(storeName, id) {
  const store = await tx(storeName, 'readwrite');
  await reqToPromise(store.delete(id));
}

async function clearStore(storeName) {
  const store = await tx(storeName, 'readwrite');
  await reqToPromise(store.clear());
}

// ===== CAUSAS =====
const causas = {
  async create(data) {
    const causa = {
      id: uuid(),
      rol: '',
      tribunal: '',
      materia: 'otro',
      caratulado: '',
      parteRepresentada: 'demandante',
      contraparte: '',
      etapa: 'discusión',
      urlOJV: '',
      honorarios: { tipo: 'fijo', monto: 0, moneda: 'CLP' },
      notasHonorarios: '',
      notas: '',
      archivada: false,
      esEjemplo: false,
      ...data,
      creadaEn: nowTimestamp(),
      actualizadaEn: nowTimestamp(),
    };
    await putOne('causas', causa);
    return causa;
  },

  async update(id, updates) {
    const existing = await getOne('causas', id);
    if (!existing) throw new Error(`Causa ${id} no existe`);
    const updated = { ...existing, ...updates, actualizadaEn: nowTimestamp() };
    await putOne('causas', updated);
    return updated;
  },

  async archive(id, archivada = true) {
    return causas.update(id, { archivada });
  },

  async delete(id) {
    // Borra causa + tareas + hitos asociados.
    const idb = await openDb();
    const t = idb.transaction(['causas', 'tareas', 'hitos'], 'readwrite');
    await Promise.all([
      reqToPromise(t.objectStore('causas').delete(id)),
      new Promise((resolve, reject) => {
        const req = t.objectStore('tareas').index('causaId').openCursor(IDBKeyRange.only(id));
        req.onsuccess = () => {
          const cur = req.result;
          if (cur) { cur.delete(); cur.continue(); } else resolve();
        };
        req.onerror = () => reject(req.error);
      }),
      new Promise((resolve, reject) => {
        const req = t.objectStore('hitos').index('causaId').openCursor(IDBKeyRange.only(id));
        req.onsuccess = () => {
          const cur = req.result;
          if (cur) { cur.delete(); cur.continue(); } else resolve();
        };
        req.onerror = () => reject(req.error);
      }),
    ]);
  },

  get: (id) => getOne('causas', id),

  async list({ archivada = null, materia = null } = {}) {
    const all = await getAll('causas');
    return all.filter((c) => {
      if (archivada !== null && c.archivada !== archivada) return false;
      if (materia && c.materia !== materia) return false;
      return true;
    });
  },

  async search(query) {
    if (!query) return causas.list();
    const q = query.toLowerCase().trim();
    const all = await getAll('causas');
    return all.filter((c) =>
      (c.caratulado || '').toLowerCase().includes(q) ||
      (c.rol || '').toLowerCase().includes(q) ||
      (c.contraparte || '').toLowerCase().includes(q) ||
      (c.tribunal || '').toLowerCase().includes(q)
    );
  },
};

// ===== TAREAS =====
const tareas = {
  async create(data) {
    const tarea = {
      id: uuid(),
      causaId: null,
      titulo: '',
      descripcion: '',
      tipo: 'gestion',
      fechaVencimiento: null,
      horaVencimiento: null,
      prioridad: 'media',
      completada: false,
      completadaEn: null,
      subtareas: null,    // Array de { titulo, completada, completadaEn } o null
      esEjemplo: false,
      vencida: false,     // marcada por la reprogramación silenciosa cuando una audiencia pasa sin completarse
      ...data,
      creadaEn: nowTimestamp(),
    };
    await putOne('tareas', tarea);
    return tarea;
  },

  async update(id, updates) {
    const existing = await getOne('tareas', id);
    if (!existing) throw new Error(`Tarea ${id} no existe`);
    const updated = { ...existing, ...updates };
    await putOne('tareas', updated);
    return updated;
  },

  async complete(id, completada = true) {
    return tareas.update(id, {
      completada,
      completadaEn: completada ? nowTimestamp() : null,
    });
  },

  /** Reemplaza el array entero de subtareas. */
  async setSubtareas(id, subtareasArr) {
    const subtareas = (subtareasArr && subtareasArr.length > 0)
      ? subtareasArr.map((s) => ({
          titulo: typeof s === 'string' ? s : (s.titulo || ''),
          completada: typeof s === 'string' ? false : !!s.completada,
          completadaEn: typeof s === 'string' ? null : (s.completadaEn || null),
        }))
      : null;
    return tareas.update(id, { subtareas });
  },

  /** Marca subtarea idx como completada/no. Retorna la tarea actualizada. */
  async toggleSubtarea(id, idx) {
    const t = await getOne('tareas', id);
    if (!t || !Array.isArray(t.subtareas) || idx < 0 || idx >= t.subtareas.length) return t;
    const next = t.subtareas.map((s, i) =>
      i === idx ? { ...s, completada: !s.completada, completadaEn: !s.completada ? nowTimestamp() : null } : s
    );
    return tareas.update(id, { subtareas: next });
  },

  /** Reschedule una tarea a una nueva fecha (o null para mover a bandeja). */
  async reschedule(id, nuevaFecha) {
    return tareas.update(id, { fechaVencimiento: nuevaFecha });
  },

  delete: (id) => deleteOne('tareas', id),
  get: (id) => getOne('tareas', id),

  async list() {
    return getAll('tareas');
  },

  async listByCausa(causaId) {
    const all = await getAll('tareas');
    return all
      .filter((t) => t.causaId === causaId)
      .sort(sortByVencimiento);
  },

  /** Tareas con fechaVencimiento === hoy, no completadas. */
  async dueToday() {
    const hoy = hoyISO();
    const all = await getAll('tareas');
    return all
      .filter((t) => !t.completada && t.fechaVencimiento === hoy)
      .sort(sortByVencimiento);
  },

  /** Audiencias hoy (tipo audiencia, fecha hoy, no completadas). */
  async audienciasToday() {
    const hoy = hoyISO();
    const all = await getAll('tareas');
    return all
      .filter((t) => !t.completada && t.tipo === 'audiencia' && t.fechaVencimiento === hoy)
      .sort((a, b) => (a.horaVencimiento || '').localeCompare(b.horaVencimiento || ''));
  },

  /** Plazos hoy o mañana, no completadas, NO de tipo audiencia (esos van aparte). */
  async plazosHoyManana() {
    const hoy = hoyISO();
    const manana = isoDelta(1);
    const all = await getAll('tareas');
    return all
      .filter((t) => !t.completada && t.tipo !== 'audiencia' &&
        (t.fechaVencimiento === hoy || t.fechaVencimiento === manana))
      .sort(sortByVencimiento);
  },

  /**
   * Próximas N microtareas pendientes (no completadas, con fecha) excluyendo IDs dados.
   * Ordenadas por proximidad de vencimiento.
   */
  async nextMicrotasks(n = 3, excludeIds = []) {
    const exclude = new Set(excludeIds);
    const all = await getAll('tareas');
    return all
      .filter((t) => !t.completada && t.fechaVencimiento && !exclude.has(t.id))
      .sort(sortByVencimiento)
      .slice(0, n);
  },

  /** Bandeja de entrada: tareas sin fecha, no completadas. */
  async inbox() {
    const all = await getAll('tareas');
    return all
      .filter((t) => !t.completada && !t.fechaVencimiento)
      .sort((a, b) => (a.creadaEn || '').localeCompare(b.creadaEn || ''));
  },
};

// ===== HITOS =====
const hitos = {
  async create(data) {
    const hito = {
      id: uuid(),
      causaId: null,
      fecha: hoyISO(),
      tipo: 'otro',
      descripcion: '',
      esEjemplo: false,
      ...data,
    };
    await putOne('hitos', hito);
    return hito;
  },
  update: (id, updates) =>
    getOne('hitos', id).then((h) => {
      if (!h) throw new Error(`Hito ${id} no existe`);
      return putOne('hitos', { ...h, ...updates });
    }),
  delete: (id) => deleteOne('hitos', id),
  get: (id) => getOne('hitos', id),
  async listByCausa(causaId) {
    const all = await getAll('hitos');
    return all
      .filter((h) => h.causaId === causaId)
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  },
};

// ===== Helpers internos =====
function sortByVencimiento(a, b) {
  const af = a.fechaVencimiento || '9999-12-31';
  const bf = b.fechaVencimiento || '9999-12-31';
  if (af !== bf) return af.localeCompare(bf);
  return (a.horaVencimiento || '99:99').localeCompare(b.horaVencimiento || '99:99');
}

function isoDelta(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// ===== Export / Import / Clear todo =====
async function exportAll() {
  const [c, t, h] = await Promise.all([
    getAll('causas'),
    getAll('tareas'),
    getAll('hitos'),
  ]);
  return {
    version: 1,
    exportadoEn: nowTimestamp(),
    causas: c,
    tareas: t,
    hitos: h,
  };
}

async function importAll(data, { mode = 'merge' } = {}) {
  if (!data || typeof data !== 'object') throw new Error('Datos inválidos');
  if (data.version !== 1) throw new Error(`Versión no soportada: ${data.version}`);

  if (mode === 'replace') {
    await Promise.all([clearStore('causas'), clearStore('tareas'), clearStore('hitos')]);
  }

  const idb = await openDb();
  const t = idb.transaction(['causas', 'tareas', 'hitos'], 'readwrite');
  const ops = [];
  for (const c of data.causas || []) ops.push(reqToPromise(t.objectStore('causas').put(c)));
  for (const ta of data.tareas || []) ops.push(reqToPromise(t.objectStore('tareas').put(ta)));
  for (const h of data.hitos || []) ops.push(reqToPromise(t.objectStore('hitos').put(h)));
  await Promise.all(ops);
  return {
    causas: (data.causas || []).length,
    tareas: (data.tareas || []).length,
    hitos: (data.hitos || []).length,
  };
}

async function clearAll() {
  await Promise.all([clearStore('causas'), clearStore('tareas'), clearStore('hitos')]);
}

const db = { causas, tareas, hitos, exportAll, importAll, clearAll, openDb };

// Exponer en window para tests manuales en consola.
if (typeof window !== 'undefined') window.db = db;

export default db;
