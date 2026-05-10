// Helpers de DOM seguros. Sin innerHTML para contenido dinámico.

/**
 * Crea un elemento.
 * @param {string} tag — nombre de etiqueta o "tag.class1.class2"
 * @param {object} attrs — atributos / propiedades. Casos especiales:
 *   - class: string o array de strings
 *   - text: textContent
 *   - html: innerHTML (USAR SOLO con SVG estático conocido)
 *   - on: { event: handler, ... }
 *   - dataset: { key: value, ... }
 *   - aria: { key: value, ... } => aria-key
 *   - resto: setAttribute
 * @param {Array} children — array de nodos o strings (escapados como text)
 */
export function el(tag, attrs = {}, children = []) {
  const parts = tag.split('.');
  const tagName = parts[0];
  const classFromTag = parts.slice(1);
  const node = document.createElement(tagName);

  if (classFromTag.length) node.classList.add(...classFromTag);

  for (const [key, val] of Object.entries(attrs)) {
    if (val === null || val === undefined || val === false) continue;
    if (key === 'class') {
      const list = Array.isArray(val) ? val : String(val).split(' ');
      list.filter(Boolean).forEach((c) => node.classList.add(c));
    } else if (key === 'text') {
      node.textContent = val;
    } else if (key === 'html') {
      node.innerHTML = val;
    } else if (key === 'on') {
      for (const [evt, handler] of Object.entries(val)) {
        node.addEventListener(evt, handler);
      }
    } else if (key === 'dataset') {
      for (const [k, v] of Object.entries(val)) node.dataset[k] = v;
    } else if (key === 'aria') {
      for (const [k, v] of Object.entries(val)) node.setAttribute(`aria-${k}`, v);
    } else if (key === 'style' && typeof val === 'object') {
      Object.assign(node.style, val);
    } else if (key in node && typeof node[key] !== 'object') {
      // Propiedad directa (value, checked, disabled, hidden, ...)
      node[key] = val;
    } else {
      node.setAttribute(key, val);
    }
  }

  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      node.appendChild(document.createTextNode(String(child)));
    } else {
      node.appendChild(child);
    }
  }

  return node;
}

/** Vacía un nodo. */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Reemplaza el contenido de parent con el child dado. */
export function mount(parent, child) {
  clear(parent);
  parent.appendChild(child);
}

/** Crea un fragmento con varios hijos. */
export function fragment(children = []) {
  const f = document.createDocumentFragment();
  for (const c of children.flat()) {
    if (!c) continue;
    if (typeof c === 'string') f.appendChild(document.createTextNode(c));
    else f.appendChild(c);
  }
  return f;
}

/** UUID v4 simple (suficiente para uso local). */
export function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Debounce simple. */
export function debounce(fn, wait = 300) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

/** Toast notification. dur en ms (default 3500). action = { label, onClick } opcional. */
export function toast(message, { dur = 3500, action = null } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const actionBtn = action
    ? el('button.toast-action', { type: 'button', text: action.label, on: { click: () => { action.onClick(); dismiss(); } } })
    : null;
  const node = el('div.toast', { role: 'status' }, [
    el('span', { text: message }),
    actionBtn,
  ]);
  root.appendChild(node);
  const dismiss = () => {
    node.classList.add('leaving');
    setTimeout(() => node.remove(), 200);
  };
  setTimeout(dismiss, dur);
  return dismiss;
}

/** Modal genérico. content es un nodo. Retorna función para cerrar. */
export function modal(content, { onClose = null, ariaLabel = 'Diálogo' } = {}) {
  const root = document.getElementById('modal-root');
  const backdrop = el('div.modal-backdrop', {
    role: 'dialog',
    aria: { modal: 'true', label: ariaLabel },
    on: {
      click: (e) => { if (e.target === backdrop) close(); },
    },
  }, [
    el('div.modal', {}, [content]),
  ]);
  root.appendChild(backdrop);
  document.body.style.overflow = 'hidden';

  const close = () => {
    backdrop.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    if (onClose) onClose();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);

  // Auto-focus primer input/button.
  requestAnimationFrame(() => {
    const focusable = backdrop.querySelector('input,textarea,button,select,[tabindex]:not([tabindex="-1"])');
    if (focusable) focusable.focus();
  });

  return close;
}

/** Confirm modal. Devuelve Promise<boolean>. */
export function confirmar({ titulo, mensaje, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', destructive = false } = {}) {
  return new Promise((resolve) => {
    let close;
    let resolved = false;
    const safeResolve = (v) => { if (!resolved) { resolved = true; resolve(v); } };
    const content = el('div.stack', {}, [
      el('div.modal-header', {}, [
        el('div.modal-title', { text: titulo }),
      ]),
      el('p', { text: mensaje, style: { color: 'var(--text-secondary)' } }),
      el('div.row', { style: { marginTop: 'var(--space-4)', gap: 'var(--space-3)' } }, [
        el('button.btn.btn-ghost', {
          type: 'button', text: cancelLabel,
          style: { flex: '1' },
          on: { click: () => { safeResolve(false); close(); } },
        }),
        el('button', {
          type: 'button', text: confirmLabel,
          class: destructive ? 'btn btn-danger' : 'btn btn-primary',
          style: { flex: '1' },
          on: { click: () => { safeResolve(true); close(); } },
        }),
      ]),
    ]);
    close = modal(content, { ariaLabel: titulo, onClose: () => safeResolve(false) });
  });
}
