// Frases para el empty state de Hoy.
// Rotación por día calendario (la misma frase durante todo el día).
// Tono: calma + refuerzo de autoestima, sin gamificación ni "logros".
// Para uso en la vista Hoy cuando no hay nada notable en los próximos 7 días.

const FRASES_EMPTY = [
  'Sin urgencias por delante. Buen momento para mirar las causas con calma.',
  'El día está despejado. ¿Algo que valga la pena anotar antes de que se te escape?',
  'Nada en la agenda. Si quieres revisar tus causas, están ahí cuando las necesites.',
  'Tranquila hoy. Aprovecha si puedes.',
  'Sin compromisos urgentes. Un buen día para ponerse al día con lo postergado.',
  'Sin agenda. Si algo aparece en tu cabeza, captúralo antes de que se te olvide.',
  'Tu cabeza no tiene que cargar todo. Hoy no hay nada urgente que recordar.',
  'Estás haciendo bien las cosas. No siempre se trata de hacer más, también de respirar.',
  'Día tranquilo. Lo que viene mañana, lo vemos mañana.',
  'No tienes nada pendiente. Eso también es trabajo bien hecho.',
  'Hoy puedes elegir. Ningún plazo te apura.',
  'Sin tareas urgentes. Mereces este momento de calma.',
];

/** Devuelve la frase del día. Misma frase para una misma fecha local. */
export function fraseDelDia(fechaISO) {
  const indice = indiceFraseDia(fechaISO);
  return FRASES_EMPTY[indice];
}

/** Índice rotativo basado en días desde una época fija. */
function indiceFraseDia(fechaISO) {
  if (!fechaISO) {
    const hoy = new Date();
    fechaISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  }
  const [y, m, d] = fechaISO.split('-').map(Number);
  const diasDesdeEpoch = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  return diasDesdeEpoch % FRASES_EMPTY.length;
}
