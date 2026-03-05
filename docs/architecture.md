# Arquitectura Técnica - Bolis Dimomat

Versión: 1.0
Fecha: 2026-03-04
Autor: Planner / Arquitecto

---

## Stack

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| **Frontend** | HTML5 + Tailwind CSS (CDN) + Vanilla JavaScript | Sin build step ni Node.js. Compatible con GitHub Pages que solo sirve archivos estáticos. Tailwind via CDN elimina cualquier paso de compilación. |
| **Backend / BaaS** | Supabase (Auth + PostgreSQL + Storage) | Provee autenticación lista, base de datos PostgreSQL con RLS, almacenamiento de archivos y SDK JS, todo sin servidor propio. |
| **Hosting** | GitHub Pages | Gratuito, confiable para proyectos estáticos y accesible por la dueña del negocio sin costos adicionales. |
| **Pedidos** | WhatsApp (wa.me) | Canal que la dueña ya usa; no requiere infraestructura adicional para recibir y confirmar pedidos. |

---

## Diagrama de Arquitectura (ASCII)

```
[Cliente Browser]
     |
     v
[GitHub Pages] <── index.html, admin.html, js/*, css/*
     |
     |── [Supabase Database] <── tabla: flavors (RLS)
     |── [Supabase Auth]    <── autenticación admin (email + password)
     |── [Supabase Storage] <── imágenes bolis (bucket: bolis-images, público)
     |
     v
[WhatsApp wa.me] <── link con pedido codificado (URL-encoded)
```

---

## Flujo de Datos

### Flujo 1 — Cliente carga el catálogo

```
Browser abre index.html
  → Se cargan CDNs: Tailwind CSS + Supabase JS
  → Se carga config.js (SUPABASE_URL, SUPABASE_ANON_KEY, WHATSAPP_NUMBER)
  → supabase-client.js inicializa el cliente con las variables de config.js
  → catalog.js consulta: SELECT * FROM flavors WHERE is_available = true
  → Supabase evalúa RLS: política "Public read flavors" permite SELECT sin autenticación
  → Los datos JSON llegan al browser
  → catalog.js renderiza las tarjetas de sabor en el DOM
  → Las imágenes se cargan desde Supabase Storage (URLs públicas) con lazy loading
```

### Flujo 2 — Cliente agrega al carrito y hace pedido

```
Cliente hace clic en "Agregar al carrito"
  → cart.js agrega el item al array del carrito en memoria
  → cart.js persiste el carrito en localStorage
  → Se actualiza el badge del header con el total de items

Cliente hace clic en "Hacer Pedido por WhatsApp"
  → cart.js recupera los items del carrito
  → whatsapp.js construye el mensaje en español con nombre, cantidad, precio y total
  → whatsapp.js genera la URL: https://wa.me/{WHATSAPP_NUMBER}?text={mensaje_encoded}
  → El browser abre WhatsApp Web o la app móvil con el mensaje pre-cargado
```

### Flujo 3 — Administradora gestiona el inventario

```
Admin abre admin.html
  → admin.js verifica si hay sesión activa con supabaseClient.auth.getSession()
  → Sin sesión: se muestra formulario de login
  → Con sesión: se muestra el dashboard de inventario

Login:
  → supabaseClient.auth.signInWithPassword({ email, password })
  → Supabase Auth valida credenciales y devuelve el token JWT
  → admin.js almacena la sesión y muestra el dashboard

Dashboard (CRUD):
  → Leer:   SELECT * FROM flavors (todos, sin filtro is_available)
  → Crear:  Subir imagen a Storage → obtener URL pública → INSERT INTO flavors
  → Editar: UPDATE flavors SET ... WHERE id = uuid (token JWT en header)
  → Eliminar: DELETE FROM flavors WHERE id = uuid (token JWT en header)
  → Todos los cambios se reflejan de inmediato en index.html porque catalog.js
    consulta Supabase en cada carga de página

Logout:
  → supabaseClient.auth.signOut()
  → admin.js redirige a la pantalla de login
```

---

## Orden de Carga de Scripts en HTML

El orden DEBE ser:

1. Tailwind CSS CDN (en `<head>`)
2. Supabase JS CDN (en `<head>` o antes del cierre de `<body>`)
3. `js/config.js` (variables globales de configuración)
4. `js/supabase-client.js` (inicializa cliente usando variables de config.js)
5. `js/catalog.js` O `js/admin.js` (lógica específica de la página)
6. `js/cart.js` (solo en index.html)
7. `js/whatsapp.js` (solo en index.html)
8. Script inline de inicialización (DOMContentLoaded)

**Razón del orden:** config.js debe estar antes que supabase-client.js porque este
último lee las constantes SUPABASE_URL y SUPABASE_ANON_KEY. Los scripts de página
van después porque dependen del cliente ya inicializado.

Ejemplo para index.html:
```html
<head>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body>
  <!-- contenido -->
  <script src="js/config.js"></script>
  <script src="js/supabase-client.js"></script>
  <script src="js/catalog.js"></script>
  <script src="js/cart.js"></script>
  <script src="js/whatsapp.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      // inicialización de la página
    });
  </script>
</body>
```

---

## Decisiones de Arquitectura

| # | Decisión | Justificación |
|---|----------|---------------|
| 1 | **Sin framework JS (React, Vue, etc.)** | El proyecto no requiere build step ni Node.js. Vanilla JS es suficiente para el alcance de la aplicación y es compatible directamente con GitHub Pages. |
| 2 | **config.js separado para credenciales** | Las credenciales de Supabase (URL y anon key) se aíslan en un archivo dedicado. Esto facilita agregar config.js al .gitignore en repositorios públicos y evitar exponerlas accidentalmente. |
| 3 | **supabase-client.js como módulo de inicialización** | Centralizar la creación del cliente Supabase en un único archivo evita inicializaciones duplicadas y hace el cliente accesible como variable global `supabaseClient` para todos los demás scripts. |
| 4 | **localStorage para persistencia del carrito** | Sin servidor propio, localStorage es la solución nativa del browser para persistir el carrito entre recargas sin costos adicionales ni complejidad. |
| 5 | **RLS en Supabase (no lógica en frontend)** | La seguridad se aplica en la capa de base de datos. Los usuarios no autenticados solo pueden leer; las operaciones de escritura requieren JWT válido emitido por Supabase Auth. El frontend no puede bypassear esto. |
| 6 | **Bucket de Storage público** | Las imágenes del catálogo deben ser accesibles por cualquier visitante sin autenticación. Un bucket público permite usar las URLs directamente en etiquetas `<img>` sin tokens. |
| 7 | **WhatsApp como canal de pedidos** | Evita la necesidad de un sistema de pagos, pasarela o servidor de notificaciones. La dueña ya opera por WhatsApp y este mecanismo requiere cero infraestructura adicional. |
| 8 | **admin.html como ruta separada** | Separar la interfaz de administración en su propio archivo HTML mantiene el código de la tienda pública limpio y evita cargar scripts de admin para todos los visitantes. |
| 9 | **Imágenes con lazy loading** | Mejora el rendimiento inicial de la página especialmente en conexiones móviles, alineado con el requerimiento RNF-03. |
| 10 | **Trigger SQL para updated_at** | La actualización automática del campo `updated_at` se delega al motor de base de datos (trigger PostgreSQL), eliminando la necesidad de manejarlo manualmente desde el frontend. |
