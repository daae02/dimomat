# UI Improvements — Bolis Dimomat

## Resumen de cambios

### Objetivo
Mejorar la presentación visual y agregar búsqueda/filtros para los sabores tanto en el catálogo del cliente como en el panel de administración. Sin cambios funcionales. Enfoque mobile-first.

---

## Archivos modificados

### `css/style.css`
Estilos nuevos agregados al final del archivo:

- **Filtros del catálogo cliente** — barra de búsqueda pill-shape con ícono superpuesto, chips de categoría con estado activo, mensaje de "sin resultados"
- **Filtros del admin** — barra con search input + dos selects (categoría / stock), fondo diferenciado `#FAFCFF`
- **Responsive** — en móvil el search ocupa el ancho completo, los selects se distribuyen en flex-wrap

### `index.html`
Agregado entre `.section-subtitle` y `#flavors-grid`:
- Input de búsqueda de texto libre (filtra por nombre y descripción)
- 6 chips de categoría: Todos / Frutal / Cremoso / Picante / Especial / Clásico
- Accesibilidad: `aria-label`, `role="group"`, `autocomplete="off"`

### `js/catalog.js`
- Variable global `allFlavors[]` para almacenar los sabores cargados
- Variable `activeFilterCat` para mantener la categoría activa
- `renderCatalog()` ahora guarda en `allFlavors` y resetea filtros al recargar
- `_renderFilteredCatalog()` renderiza un subconjunto con empty-state inteligente
- `filterCatalog()` combina búsqueda de texto + categoría activa
- `selectFilterChip(btn)` actualiza el chip activo y llama a `filterCatalog()`

### `admin.html`
Barra de filtros dentro del tab "Inventario", sobre la tabla:
- Search input de texto (busca por nombre de sabor)
- Select de categoría
- Select de stock: Disponible / Stock bajo ≤5 / Agotado

### `js/admin.js`
- Variable global `allAdminFlavors[]` para almacenar sabores del inventario
- `loadAdminFlavors()` ahora rellena `allAdminFlavors` en cada recarga
- `filterAdminFlavors()` filtra `allAdminFlavors` por nombre + categoría + estado de stock y llama a `renderAdminTable(filtered)`

---

## Comportamiento de los filtros

### Catálogo cliente
- Búsqueda en tiempo real mientras el usuario escribe
- Chips de categoría combinables con la búsqueda de texto
- Al recargar el catálogo (cada 15 s en silencio), los filtros se resetean para mantener coherencia
- Empty state diferenciado: "Sin resultados" si hay filtro activo, mensaje estándar si no hay sabores en DB

### Admin — Inventario
- Búsqueda en tiempo real por nombre
- Filtro por categoría + filtro por estado de stock (independientes)
- Filtros se aplican sobre los datos ya cargados (sin llamadas extras a Supabase)
- Al recargar el inventario los filtros se mantienen en los inputs pero no se reaplican automáticamente (comportamiento intencional para no confundir)

---

## Decisiones de diseño
- **Mobile-first**: search ocupa el 100% del ancho, chips con flex-wrap, admin selects distribuyen espacio
- **Sin cambios funcionales**: el carrito, WhatsApp, Edge Functions y toda la lógica de negocio permanecen intactos
- **Filtrado client-side**: no se generan llamadas adicionales a Supabase, aprovecha los datos ya cargados
