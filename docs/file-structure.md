# Estructura de Archivos — Bolis Gourmet

Versión: 1.0
Fecha: 2026-03-04
Autor: Planner / Arquitecto

---

## Árbol de Archivos

```
Dimomat/
├── index.html              # Página principal (catálogo + carrito)
├── admin.html              # Panel administrador (login + dashboard)
├── SETUP.md                # Guía de instalación y deploy
├── docs/
│   ├── requirements.md     # Requerimientos (generado por RE)
│   ├── architecture.md     # Arquitectura técnica y decisiones de diseño
│   ├── file-structure.md   # Este documento
│   ├── design-mockup.html  # Mockups del diseñador
│   └── test-report.md      # Reporte del tester
├── js/
│   ├── config.js           # Configuración: URL Supabase, WhatsApp number
│   ├── supabase-client.js  # Cliente Supabase inicializado
│   ├── catalog.js          # Carga y renderiza catálogo desde Supabase
│   ├── cart.js             # Lógica del carrito (localStorage)
│   ├── whatsapp.js         # Genera y envía pedido por WhatsApp
│   └── admin.js            # Auth + CRUD de sabores + upload imágenes
├── css/
│   ├── style.css           # Estilos personalizados (complementa Tailwind)
│   └── design-system.md    # Guía de diseño del sistema
├── assets/
│   └── images/
│       └── .gitkeep        # Carpeta para assets locales (placeholder)
└── supabase/
    └── schema.sql          # SQL para ejecutar en Supabase
```

---

## Descripción de Archivos

### Raíz del proyecto

| Archivo | Responsable | Descripción |
|---------|-------------|-------------|
| `index.html` | Coder 1 | Página pública de la tienda. Contiene el catálogo de sabores y el carrito lateral (drawer). Carga: config.js, supabase-client.js, catalog.js, cart.js, whatsapp.js. |
| `admin.html` | Coder 2 | Panel de administración protegido por login. Muestra el formulario de login y, tras autenticarse, el dashboard de gestión de inventario. Carga: config.js, supabase-client.js, admin.js. |
| `SETUP.md` | Planner | Guía paso a paso para configurar Supabase, actualizar config.js y desplegar en GitHub Pages. |

### Carpeta `docs/`

| Archivo | Responsable | Descripción |
|---------|-------------|-------------|
| `requirements.md` | Requirements Engineer | Requerimientos funcionales y no funcionales, modelo de datos, flujos de usuario. |
| `architecture.md` | Planner | Stack tecnológico, diagrama de arquitectura, flujos de datos, orden de scripts, decisiones de diseño. |
| `file-structure.md` | Planner | Este documento. Descripción de cada archivo y su propósito. |
| `design-mockup.html` | Diseñador | Mockups visuales de la tienda pública y el panel de administración. |
| `test-report.md` | Tester | Casos de prueba ejecutados, resultados y bugs encontrados. |

### Carpeta `js/`

| Archivo | Responsable | Descripción |
|---------|-------------|-------------|
| `config.js` | Planner (placeholder) / Dev | Variables globales: SUPABASE_URL, SUPABASE_ANON_KEY, WHATSAPP_NUMBER, BUSINESS_NAME, CURRENCY_SYMBOL. ESTE ARCHIVO NO DEBE versionarse en repositorios públicos. |
| `supabase-client.js` | Planner (placeholder) / Dev | Inicializa y exporta el cliente Supabase como variable global `supabaseClient`. Valida que config.js esté correctamente configurado antes de conectar. |
| `catalog.js` | Coder 1 | Consulta la tabla `flavors` en Supabase filtrando `is_available = true`. Renderiza las tarjetas de sabor en el DOM. Maneja el estado "Agotado" para stock = 0. |
| `cart.js` | Coder 1 | Gestiona el carrito: agregar, eliminar, incrementar y decrementar cantidades. Persiste en localStorage. Actualiza el badge del header. Controla el drawer lateral. |
| `whatsapp.js` | Coder 1 | Lee el contenido del carrito, formatea el mensaje de pedido en español con items, cantidades, precios y total. Genera el enlace wa.me y lo abre en una nueva pestaña. |
| `admin.js` | Coder 2 | Gestiona el ciclo completo del panel admin: login/logout con Supabase Auth, carga de todos los sabores, formulario de creación/edición con preview de imagen, upload a Storage, toggle de disponibilidad, actualización rápida de stock y eliminación con confirmación. |

### Carpeta `css/`

| Archivo | Responsable | Descripción |
|---------|-------------|-------------|
| `style.css` | Diseñador | Estilos personalizados que complementan las utilidades de Tailwind CSS. Animaciones, variables CSS de color de marca, estilos del drawer del carrito, etc. |
| `design-system.md` | Diseñador | Guía del sistema de diseño: paleta de colores, tipografía, espaciado, componentes reutilizables. |

### Carpeta `assets/`

| Archivo | Responsable | Descripción |
|---------|-------------|-------------|
| `assets/images/.gitkeep` | Planner | Mantiene la carpeta `images/` versionada en Git aunque esté vacía. Las imágenes de los bolis se almacenan en Supabase Storage, no en esta carpeta; se reserva para logos y assets estáticos locales. |

### Carpeta `supabase/`

| Archivo | Responsable | Descripción |
|---------|-------------|-------------|
| `schema.sql` | Requirements Engineer | Script SQL completo para ejecutar en el SQL Editor de Supabase: crea la tabla `flavors`, el trigger `updated_at`, las políticas RLS, el bucket `bolis-images` con sus políticas de storage e inserta datos de muestra. |

---

## Notas de Implementación

- **config.js debe cargarse antes que supabase-client.js** en todos los HTML que usen Supabase.
- **config.js no debe incluirse en el repositorio público** si el repositorio es visible. Agregar `config.js` al `.gitignore` y distribuirlo por canal privado al equipo.
- Los archivos marcados como `TODO: Implementar` son placeholders creados por el Planner. Los coders deben reemplazar el contenido con la implementación real.
- `design-mockup.html` y `test-report.md` son entregables de otros roles del equipo (Diseñador y Tester) y se crearán en sus respectivas fases.

