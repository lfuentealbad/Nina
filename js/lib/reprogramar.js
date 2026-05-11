// Reprogramación silenciosa al inicio de cada sesión.
//
// Para evitar que lo no hecho ayer se acumule como deuda visible:
//   - Toda tarea no completada con fechaVencimiento < hoy se mueve a hoy.
//   - Excepción: las audiencias (cuya fecha ya pasó) no se mueven; se marcan
//     `vencida: true` para sacarlas de Hoy y dejarlas visibles solo en la
//     ficha de causa con la etiqueta "no asistida".
//
// Se ejecuta una vez por sesión (flag en memoria del módulo). No notifica.

import db from '../db.js';
import { hoyISO } from './fechas.js';

let yaCorrioEnEstaSesion = false;

export async function reprogramarSilencioso() {
  if (yaCorrioEnEstaSesion) return;
  yaCorrioEnEstaSesion = true;

  const hoy = hoyISO();
  const todas = await db.tareas.list();
  const candidatas = todas.filter((t) =>
    !t.completada &&
    t.fechaVencimiento &&
    t.fechaVencimiento < hoy
  );

  for (const t of candidatas) {
    if (t.tipo === 'audiencia') {
      if (!t.vencida) await db.tareas.update(t.id, { vencida: true });
    } else {
      await db.tareas.update(t.id, { fechaVencimiento: hoy });
    }
  }
}
