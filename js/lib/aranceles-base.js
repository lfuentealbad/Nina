// Tabla de aranceles referenciales del Colegio de Abogados de Chile.
// Selección de gestiones más comunes. Los montos son aproximados y
// referenciales; Nina puede editarlos o agregar propios.
//
// Unidades: UF, UTM, CLP, porcentaje. El campo `monto` es el valor base; en
// porcentaje significa "porcentaje sobre la cuantía", a explicar en `notas`.

export const ARANCELES_BASE = [
  // ===== Civil =====
  { materia: 'civil', gestion: 'Demanda de cobro de pesos (cuantía menor)', monto: 15, moneda: 'UF', notas: 'Para causas hasta 500 UF.' },
  { materia: 'civil', gestion: 'Demanda de cobro de pesos (cuantía mayor)', monto: 8, moneda: 'porcentaje', notas: '8% del monto demandado, con piso de 25 UF.' },
  { materia: 'civil', gestion: 'Juicio sumario', monto: 20, moneda: 'UF', notas: '' },
  { materia: 'civil', gestion: 'Recurso de protección', monto: 30, moneda: 'UF', notas: '' },
  { materia: 'civil', gestion: 'Gestión preparatoria (notificación, gestión voluntaria)', monto: 8, moneda: 'UF', notas: '' },
  { materia: 'civil', gestion: 'Tercería', monto: 15, moneda: 'UF', notas: '' },

  // ===== Familia =====
  { materia: 'familia', gestion: 'Divorcio de común acuerdo', monto: 12, moneda: 'UF', notas: '' },
  { materia: 'familia', gestion: 'Divorcio unilateral o por culpa', monto: 25, moneda: 'UF', notas: '' },
  { materia: 'familia', gestion: 'Demanda de alimentos', monto: 10, moneda: 'UF', notas: '' },
  { materia: 'familia', gestion: 'Cuidado personal', monto: 15, moneda: 'UF', notas: '' },
  { materia: 'familia', gestion: 'Relación directa y regular', monto: 10, moneda: 'UF', notas: '' },
  { materia: 'familia', gestion: 'Medidas de protección VIF', monto: 8, moneda: 'UF', notas: '' },

  // ===== Laboral =====
  { materia: 'laboral', gestion: 'Demanda por despido injustificado (cuantía menor)', monto: 12, moneda: 'UF', notas: '' },
  { materia: 'laboral', gestion: 'Demanda laboral monitoria', monto: 8, moneda: 'UF', notas: '' },
  { materia: 'laboral', gestion: 'Tutela de derechos fundamentales', monto: 25, moneda: 'UF', notas: '' },
  { materia: 'laboral', gestion: 'Nulidad del despido', monto: 15, moneda: 'UF', notas: '' },

  // ===== Cobranza =====
  { materia: 'cobranza', gestion: 'Cobranza extrajudicial', monto: 5, moneda: 'porcentaje', notas: '5% del monto cobrado.' },
  { materia: 'cobranza', gestion: 'Juicio ejecutivo', monto: 12, moneda: 'UF', notas: '12 UF más 5% de lo recuperado.' },

  // ===== Penal =====
  { materia: 'penal', gestion: 'Querella criminal', monto: 30, moneda: 'UF', notas: '' },
  { materia: 'penal', gestion: 'Defensa simple delitos contra la propiedad', monto: 25, moneda: 'UF', notas: '' },
  { materia: 'penal', gestion: 'Audiencia de formalización', monto: 8, moneda: 'UF', notas: '' },

  // ===== Otro =====
  { materia: 'otro', gestion: 'Estudio de antecedentes / informe en derecho', monto: 10, moneda: 'UF', notas: '' },
  { materia: 'otro', gestion: 'Hora de consulta profesional', monto: 1, moneda: 'UF', notas: '' },
  { materia: 'otro', gestion: 'Redacción de contrato simple', monto: 5, moneda: 'UF', notas: '' },
  { materia: 'otro', gestion: 'Redacción de contrato complejo', monto: 15, moneda: 'UF', notas: '' },
];

/**
 * Inserta los aranceles base en la BD si el store está vacío.
 * Idempotente: si ya hay items, no hace nada.
 * Llamar al primer acceso al módulo de calculadora.
 */
export async function sembrarSiVacio(db) {
  const existentes = await db.aranceles.list();
  if (existentes.length > 0) return false;

  for (const base of ARANCELES_BASE) {
    await db.aranceles.create({
      ...base,
      esReferencial: true,
      ocultoPorUsuario: false,
    });
  }
  return true;
}
