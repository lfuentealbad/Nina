// Ilustraciones SVG simples para empty states. Estilo line-art, color sage.
// Una sola línea por imagen, sin relleno: comunica "todavía no hay nada acá"
// sin ser ni lúdico de más ni clínico de menos.

const ILLUSTRATIONS = {
  // Carpeta vacía — para "aún no tienes causas"
  emptyFolder: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" width="160" height="120" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M30 40h35l8 10h57a8 8 0 0 1 8 8v40a8 8 0 0 1-8 8H30a8 8 0 0 1-8-8V48a8 8 0 0 1 8-8z" stroke-opacity="0.4"/>
      <path d="M40 60h80M40 75h60M40 90h40" stroke-opacity="0.25"/>
    </svg>
  `,
  // Sol con rayos — para "vas al día"
  sun: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" width="160" height="120" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="80" cy="60" r="22" stroke-opacity="0.6"/>
      <path d="M80 22v8M80 90v8M42 60h8M110 60h8M53 33l5 5M102 82l5 5M53 87l5-5M102 38l5-5" stroke-opacity="0.4"/>
    </svg>
  `,
  // Inbox vacío
  emptyInbox: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" width="160" height="120" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M30 60l10-30h80l10 30v30a8 8 0 0 1-8 8H38a8 8 0 0 1-8-8z" stroke-opacity="0.5"/>
      <path d="M30 60h30l5 8h30l5-8h30" stroke-opacity="0.6"/>
    </svg>
  `,
  // Búsqueda sin resultados
  searchEmpty: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" width="160" height="120" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="70" cy="55" r="25" stroke-opacity="0.5"/>
      <path d="M88 73l18 18" stroke-opacity="0.5"/>
      <path d="M62 55h16" stroke-opacity="0.4"/>
    </svg>
  `,
};

/**
 * Devuelve un nodo con la ilustración. Usa currentColor — definir color en el padre.
 */
export function illustration(name) {
  const svg = ILLUSTRATIONS[name];
  if (!svg) {
    console.warn(`Illustration "${name}" no existe`);
    return document.createTextNode('');
  }
  const wrapper = document.createElement('div');
  wrapper.innerHTML = svg.trim();
  wrapper.classList.add('illustration');
  return wrapper.firstChild;
}
