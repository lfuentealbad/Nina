// Indicadores económicos en línea desde mindicador.cl.
//
// API pública del Banco Central de Chile (CORS abierto). No requiere
// autenticación. Se llama directamente desde el navegador.
// Documentación: https://mindicador.cl/

const URL_API = 'https://mindicador.cl/api';
const TIMEOUT_MS = 3000;
const CACHE_MAX_HORAS = 4;

/**
 * Hace GET a la API y retorna los valores normalizados.
 * Lanza error si timeout, red o respuesta no-OK.
 */
export async function fetchIndicadoresEnLinea() {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(URL_API, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    return {
      uf:    { valor: data.uf.valor,    fecha: data.uf.fecha.slice(0, 10) },
      utm:   { valor: data.utm.valor,   fecha: data.utm.fecha.slice(0, 10) },
      dolar: { valor: data.dolar.valor, fecha: data.dolar.fecha.slice(0, 10) },
      euro:  { valor: data.euro.valor,  fecha: data.euro.fecha.slice(0, 10) },
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Política de refresco: trae los valores cacheados de la BD y, si el último
 * `actualizadoEn` es de hace más de 4 horas (o nunca se actualizó desde
 * la API real), intenta refrescar contra mindicador.cl.
 *
 * Retorna siempre los valores actuales (cacheados o frescos) en forma de
 * mapa { uf, utm, dolar, euro }. Cada entrada incluye `valor`, `fecha`,
 * `fuente` y `actualizadoEn`.
 */
export async function obtenerIndicadores(db, { forzar = false } = {}) {
  const mapaCache = await db.indicadores.getAll();
  if (!forzar && estaFresco(mapaCache)) return mapaCache;

  try {
    const frescos = await fetchIndicadoresEnLinea();
    for (const [id, info] of Object.entries(frescos)) {
      await db.indicadores.upsert(id, info.valor, info.fecha, 'mindicador');
    }
    return await db.indicadores.getAll();
  } catch (e) {
    // Sin conexión o API caída: nos quedamos con lo que haya en cache.
    return mapaCache;
  }
}

/** Fuerza el refresco contra la API y devuelve { ok, datos? , error? }. */
export async function refrescarIndicadores(db) {
  try {
    const datos = await fetchIndicadoresEnLinea();
    for (const [id, info] of Object.entries(datos)) {
      await db.indicadores.upsert(id, info.valor, info.fecha, 'mindicador');
    }
    return { ok: true, datos: await db.indicadores.getAll() };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function estaFresco(mapa) {
  if (!mapa || !mapa.uf) return false;
  // Si la fuente sigue siendo fallback, no contamos como fresco aunque
  // la fecha sea reciente — queremos al menos intentar la API una vez.
  if (mapa.uf.fuente !== 'mindicador') return false;
  const t = Date.parse(mapa.uf.actualizadoEn || '');
  if (Number.isNaN(t)) return false;
  const horasDesde = (Date.now() - t) / 3600000;
  return horasDesde < CACHE_MAX_HORAS;
}
