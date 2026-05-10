# Carolina — Fase 1

PWA personal para gestión de causas judiciales. HTML + CSS + JavaScript vanilla. Sin frameworks, sin build, sin backend.

## Stack
- HTML5 / CSS3 / ES Modules nativos
- IndexedDB (3 stores: `causas`, `tareas`, `hitos`)
- Service worker cache-first
- Lucide icons inline (ISC)
- Sin dependencias en runtime

## Cómo correrla en local

Tienes que servir los archivos por HTTP (no `file://`) para que funcionen ES modules + service worker.

**Opción A — Python:**
```powershell
cd C:\Users\lfuen\OneDrive\Escritorio\Nina
python -m http.server 8080
```
Abre <http://localhost:8080> en el navegador.

**Opción B — Node:**
```powershell
npx http-server -p 8080 -c-1
```

**Opción C — VSCode:** extensión _Live Server_, click derecho en `index.html` → "Open with Live Server".

## Cómo validar la Fase 1 (checklist para Carolina)

Sigue estos pasos en orden. Si algo falla, anótalo y se corrige en la próxima iteración.

### 1. Tests de la base de datos
1. Abre <http://localhost:8080/dev/test-db.html>
2. Click en **"Correr suite completa"**.
3. Verifica que **los 17 pasos quedan en verde** (`✓`). Si alguno falla, abre la consola (F12) y revisa el error.
4. Vuelve a abrir <http://localhost:8080/dev/test-db.html> y click en **"Crear datos demo"** — esto deja datos de prueba para explorar la app.

### 2. Vista Hoy
1. Abre <http://localhost:8080>
2. Verifica:
   - Saludo cambia según hora ("Buenos días/tardes/noches").
   - Fecha en español largo ("viernes, 9 de mayo de 2026").
   - Aparece la **audiencia "Audiencia preparatoria 10:30"** arriba si hiciste seed.
   - Debajo, el **plazo "Presentar lista de testigos"** con cápsula roja "Hoy".
   - 3 microtareas (o las que haya) debajo.
   - Widget de bandeja de entrada al final con count.
3. Click en una microtarea → completarla → ver toast con "Deshacer" → click en "Deshacer" → la tarea vuelve.
4. Click en el widget de bandeja → abre modal de revisión, asignar fecha o eliminar/saltar.

### 3. Captura rápida
1. Click en el botón **+** flotante abajo a la derecha.
2. Escribe un título → Enter o "Guardar".
3. Verifica toast "Anotada en bandeja de entrada".
4. Vuelve a Hoy → la tarea aparece en el widget de bandeja.

### 4. Lista de causas
1. Click en el icono "Causas" en bottom nav.
2. Verifica que aparecen las causas seedadas con caratulado, rol, tribunal y semáforo de la próxima tarea.
3. Prueba el buscador: escribe "rojas" → filtra.
4. Prueba los chips: tap en "Familia" → solo muestra causas de familia. Tap de nuevo para desactivar.
5. Tap en "Archivadas" → vacío (a menos que hayas archivado alguna).

### 5. Crear causa nueva
1. Tap en el FAB **+** (debería abrir captura rápida)... **OJO**: en pantalla Causas el FAB también abre captura rápida. Para crear causa: scroll hasta empty state o usa botón **"+ Nueva causa"** desde lista vacía. Alternativa: navega a `#causas/nueva` directo.
2. Llena rol + tribunal (obligatorios). Materia ya tiene default.
3. Click en "Crear causa" → te lleva a la ficha.

### 6. Ficha de causa
1. Tap en una causa de la lista.
2. Verifica las 4 secciones colapsables:
   - **Datos generales** (abierta) — botón "Abrir en OJV" + "Editar datos".
   - **Tareas** — pendientes y completadas separadas. Botón "+ Nueva tarea".
   - **Hitos** — línea de tiempo. Botón "+ Nuevo hito".
   - **Notas** — textarea con autoguardado al perder foco (indicador "Guardado" 1.5s).
3. Click en menú "⋮" arriba a la derecha → opciones Editar / Archivar / Eliminar.
4. Archivar → la causa desaparece de "Activas".
5. Volver a "Archivadas" → restaurar.

### 7. Ajustes
1. Tap en "Ajustes" en bottom nav.
2. Cambia tema (sistema / claro / oscuro) — verifica que cambia inmediatamente.
3. Cambia tu nombre → verifica que aparece en saludo de Hoy.
4. **Exporta JSON** → descarga `carolina-2026-XX-XX.json`.
5. **Borra todo** (doble confirmación) → vuelves a Hoy vacía.
6. **Importa JSON** → confirma → todo vuelve.

### 8. Persistencia offline
1. Cierra la pestaña.
2. Abre <http://localhost:8080> de nuevo.
3. Verifica que tus datos siguen ahí.
4. (Opcional) Apaga internet (DevTools → Network → Offline). Recarga. Sigue funcionando.

### 9. Mobile
1. DevTools → "Toggle device toolbar" → iPhone SE o Pixel 5.
2. Verifica:
   - Bottom nav visible y tappable.
   - FAB no tapa contenido.
   - No hay scroll horizontal.
   - Touch targets cómodos.
3. Para probar en celular real: encuentra tu IP local (`ipconfig` en PowerShell) y abre `http://TU-IP:8080` desde el celular en la misma red.

### 10. Accesibilidad
1. DevTools → "Lighthouse" → run "Accessibility" → debería dar 95+.
2. Tab por toda la app → focus visible siempre.
3. Activa `prefers-reduced-motion` (DevTools → Rendering → Emulate CSS prefers-reduced-motion: reduce) → animaciones se reducen.

## Estructura

```
Nina/
├── index.html              # shell
├── manifest.json
├── service-worker.js
├── README.md               # este archivo
├── css/
│   ├── tokens.css          # colores, espaciado, tipografía
│   ├── base.css            # reset + utilidades
│   ├── components.css      # botones, tarjetas, modales, etc.
│   └── views.css           # estilos por vista
├── js/
│   ├── app.js              # bootstrap + router hash-based
│   ├── db.js               # capa IndexedDB promesificada
│   ├── lib/
│   │   ├── fechas.js       # formato es-CL, semáforo, días
│   │   ├── render.js       # el(), modal(), toast(), confirmar()
│   │   └── icons.js        # SVGs Lucide inline
│   └── views/
│       ├── hoy.js
│       ├── causas-lista.js
│       ├── causa-ficha.js
│       ├── causa-form.js
│       ├── tarea-form.js
│       ├── captura-rapida.js
│       └── ajustes.js
├── icons/
│   └── app-icon.svg
└── dev/
    └── test-db.html        # tests manuales de db.js
```

## Decisiones de diseño Fase 1

- `causas.archivada: boolean` (no es valor de `etapa`).
- `tareas.fechaVencimiento` puede ser `null` → bandeja de entrada.
- Audiencias en Vista Hoy = `tareas.tipo === 'audiencia'` con fecha hoy.
- Hitos = solo registro histórico (no participan en Hoy).
- `urlOJV` se pega manualmente, sin generación por templates.
- Honorarios: `monto` numérico + `notasHonorarios` libre. `base` estructurado queda para Fase 3.
- Microtareas en Hoy excluyen audiencias y plazos hoy/mañana ya mostrados arriba.
- 6 chips fijos por materia + 3 de estado en lista de causas (scroll horizontal solo en chip-row).
- Modo oscuro: `prefers-color-scheme` por defecto + override en Ajustes.
- Service worker: cache-first, auto-update con toast discreto.
- Confirmaciones: tarea (sin confirm + toast deshacer 5s), archivar (sin confirm), eliminar tarea (confirm light), eliminar causa (confirm + escribe caratulado), borrar todo (doble confirm).

## Hosting (GitHub Pages)

1. Crea repo en GitHub, commit y push.
2. Settings → Pages → Branch `main` / folder `/ (root)`.
3. La app queda en `https://USUARIO.github.io/REPO/`.
4. Todas las rutas son relativas (`./algo`), funciona sea en raíz o en subpath.

Para PWA "instalable" en iOS, después podemos agregar iconos PNG (192/512). El SVG actual funciona en Chrome/Edge/Android. iOS usa un icono genérico al "Agregar a inicio".

## Lo que NO está en Fase 1

- Microtareas anidadas
- Pomodoro
- Calculadora de aranceles / generación PDF
- Sincronización en la nube
- Notificaciones push
- Login / autenticación
- Plazos hábiles (solo días corridos por ahora)
- Drag-and-drop, pull-to-refresh

## Bugs conocidos / cosas a iterar con uso real

- El navegador puede borrar IndexedDB si se queda sin espacio o si Carolina limpia datos. **Recomendación:** exportar JSON una vez por semana hasta tener Fase 4 (sync nube).
- En iOS Safari, "Agregar a inicio" usa icono genérico (falta PNG 192/512).
- Si abres Carolina en dos pestañas a la vez y migras schema, una de las dos puede quedar bloqueada — cierra la otra y recarga.

## Próximo paso sugerido

Usar la app en condiciones reales 1-2 semanas, anotar fricciones reales (no hipotéticas), y atacar las top 3 antes de pensar en Fase 2.
