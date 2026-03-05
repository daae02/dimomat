# Mejoras sugeridas para Dimomat

## Resumen ejecutivo

Estas mejoras se enfocan en tres frentes: **mantenibilidad**, **accesibilidad/UX** y **rendimiento**.

## 1) Mantenibilidad del frontend

### 1.1 Eliminar duplicación de utilidades monetarias
**Situación actual:** `formatColones` y `normalizeAmount` están duplicadas en `js/catalog.js` y `js/cart.js`.

**Riesgo:** cambios futuros pueden quedar inconsistentes entre catálogo y carrito.

**Mejora propuesta:** mover ambas funciones a un módulo compartido (por ejemplo `js/utils/currency.js`) y reutilizarlo en ambos scripts.

**Impacto estimado:** Alto (reduce bugs por divergencia y facilita cambios globales de formato).

### 1.2 Reemplazar handlers inline por listeners en JavaScript
**Situación actual:** hay múltiples `onclick` y `oninput` declarados directamente en HTML (`index.html`).

**Riesgo:** baja testabilidad, mayor acoplamiento entre estructura y comportamiento, y más difícil escalar eventos.

**Mejora propuesta:** registrar eventos con `addEventListener` durante `DOMContentLoaded`.

**Impacto estimado:** Medio/Alto.

## 2) Accesibilidad y experiencia de usuario

### 2.1 Mejorar semántica del drawer de carrito
**Situación actual:** el carrito usa `role="dialog"`, pero no tiene `aria-modal="true"`, manejo de foco inicial ni trampa de foco.

**Riesgo:** navegación deficiente con teclado y lectores de pantalla.

**Mejora propuesta:**
- Añadir `aria-modal="true"` y etiquetado explícito del título.
- Mover el foco al abrir y devolverlo al cerrar.
- Implementar trampa de foco dentro del drawer.

**Impacto estimado:** Alto.

### 2.2 Añadir feedback de errores recuperables en UI
**Situación actual:** los errores de carga se registran en consola (`console.error`), pero el usuario depende de estados de error parciales.

**Mejora propuesta:** estandarizar un componente de estado (`cargando`, `vacío`, `error`, `sin resultados`) con mensajes claros y acción de reintento.

**Impacto estimado:** Medio.

## 3) Rendimiento y confiabilidad

### 3.1 Reducir polling constante del catálogo
**Situación actual:** se actualiza catálogo cada 15 segundos con `setInterval`.

**Riesgo:** consumo innecesario de red y cuota de Supabase cuando no hay cambios frecuentes.

**Mejora propuesta:**
- Aumentar intervalo (ej. 60s) o
- usar actualización bajo demanda (refresh manual), o
- migrar a realtime/eventos si aplica.

**Impacto estimado:** Alto en costos y eficiencia.

### 3.2 Evitar render de skeleton cuando ya hay carga en curso
**Situación actual:** `loadFlavors` ejecuta `showSkeletons()` antes de revisar `isLoadingFlavors`.

**Riesgo:** posibilidad de parpadeo visual cuando hay llamadas solapadas.

**Mejora propuesta:** validar `isLoadingFlavors` antes de pintar skeletons.

**Impacto estimado:** Medio.

## Backlog priorizado (siguiente sprint)

1. **P1:** Extraer utilidades monetarias compartidas y eliminar duplicación.
2. **P1:** Accesibilidad completa del carrito (foco + modal + teclado).
3. **P2:** Migrar handlers inline a event listeners.
4. **P2:** Optimizar estrategia de actualización de catálogo (menos polling).
5. **P3:** Unificar componente de estados de catálogo (error/vacío/sin resultados).

---

Si quieres, en el siguiente paso puedo convertir este backlog en **issues concretos** con estimación de esfuerzo (S/M/L) y criterios de aceptación por cada tarea.
