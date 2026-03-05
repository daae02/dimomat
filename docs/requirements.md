# Documentación de Requerimientos — Bolis Gourmet

Versión: 1.0
Fecha: 2026-03-04
Autor: Ingeniería de Requerimientos

---

## 1. Descripción del Proyecto

**Nombre:** Bolis Gourmet

**Objetivo:** Desarrollar una página web estática para el negocio familiar Bolis Gourmet, que permita a los clientes explorar el catálogo de sabores disponibles y realizar pedidos a través de WhatsApp, y que además ofrezca un panel de administración para que la dueña gestione el inventario de forma autónoma.

**Público objetivo:**
- **Clientes finales:** Personas interesadas en comprar bolis artesanales/gourmet (helados en palito o en sobre). Acceden sin necesidad de registro.
- **Administradora:** La dueña del negocio, quien gestiona el inventario, precios, imágenes y disponibilidad de los productos.

**Tecnología:**
- Hosting: GitHub Pages (sitio 100% estático, sin servidor propio)
- Backend/BaaS: Supabase (autenticación, base de datos PostgreSQL, almacenamiento de imágenes)
- Frontend: HTML + Tailwind CSS (CDN) + Vanilla JavaScript + Supabase JS Client (CDN)

---

## 2. Requerimientos Funcionales

### 2.1 Módulo Público (sin login)

#### RF-01: Visualización del catálogo de sabores

- El usuario puede ver todos los sabores con `is_available = true`.
- Cada tarjeta de sabor muestra:
  - Imagen del producto (cargada desde Supabase Storage)
  - Nombre del sabor
  - Descripción
  - Precio
  - Stock disponible
- Los sabores con `stock = 0` se muestran con el badge **"Agotado"** y el botón "Agregar al carrito" deshabilitado.
- El catálogo se carga dinámicamente desde Supabase al abrir la página.

#### RF-02: Carrito de compras

- El usuario puede agregar sabores disponibles al carrito especificando una cantidad.
- El usuario puede incrementar o decrementar la cantidad de cada item dentro del carrito (mínimo permitido: 1 unidad).
- El usuario puede eliminar un item del carrito de forma individual.
- El carrito persiste entre sesiones mediante `localStorage`, de modo que no se pierde al recargar la página.
- Un badge visible en el header muestra en tiempo real el número total de items en el carrito.
- El carrito se presenta como un panel lateral (drawer) accesible desde el header.

#### RF-03: Pedido por WhatsApp

- El usuario hace clic en el botón **"Hacer Pedido por WhatsApp"** dentro del carrito.
- El sistema genera automáticamente un mensaje pre-formateado en español con el resumen del pedido.
- El mensaje incluye:
  - Lista de items con nombre, cantidad y precio unitario
  - Total del pedido
- Se abre WhatsApp Web o la aplicación móvil usando un enlace `wa.me/{numero}?text={mensaje_codificado}` con el número de teléfono de la tienda.
- La dueña recibe el pedido directamente en WhatsApp y confirma por el mismo canal.

---

### 2.2 Módulo Administrador (requiere login)

#### RF-04: Autenticación

- La administradora accede a la ruta `/admin.html`.
- Si no existe una sesión activa de Supabase, se muestra la pantalla de login.
- La autenticación se realiza con email y contraseña mediante Supabase Auth.
- Al iniciar sesión correctamente, se redirige al dashboard de administración.
- El sistema provee un botón de **Logout** que cierra la sesión de Supabase.
- El acceso al dashboard sin sesión activa redirige automáticamente a la pantalla de login.

#### RF-05: Gestión de inventario (CRUD completo)

- La administradora puede ver todos los sabores registrados, incluyendo los marcados como no disponibles.
- La información se presenta en una tabla con columnas: imagen, nombre, categoría, precio, stock, disponibilidad y acciones.
- **Agregar sabor:** Formulario con los campos: nombre, descripción, precio, stock, categoría, imagen y disponibilidad.
- **Editar sabor:** Permite modificar cualquier campo de un sabor existente mediante un modal o formulario inline.
- **Actualización rápida de stock:** Campo numérico editable directamente desde la tabla para ajustar el stock sin abrir el formulario completo.
- **Toggle de disponibilidad:** Interruptor (switch) para marcar un sabor como disponible o no disponible sin abrir el formulario.
- **Eliminar sabor:** Botón de eliminación con diálogo de confirmación para evitar borrados accidentales.
- Todos los cambios se reflejan de forma inmediata en la tienda pública.

#### RF-06: Gestión de imágenes

- Al crear o editar un sabor, la administradora puede seleccionar y subir una imagen desde su dispositivo.
- La imagen se almacena en Supabase Storage en el bucket público `bolis-images`.
- Se muestra un preview de la imagen seleccionada antes de guardar el formulario.
- Restricciones de validación:
  - Tamaño máximo: **2 MB**
  - Formatos aceptados: **JPG, PNG, WebP**
- La URL pública de la imagen se guarda en el campo `image_url` de la tabla `flavors`.

---

## 3. Requerimientos No Funcionales

| ID | Requerimiento | Detalle |
|----|---------------|---------|
| RNF-01 | Diseño responsivo | Diseño mobile-first con breakpoints para móvil, tablet y escritorio usando las utilidades de Tailwind CSS |
| RNF-02 | Idioma | Toda la interfaz de usuario (etiquetas, mensajes, alertas, botones) debe estar en español |
| RNF-03 | Performance | Imágenes con lazy loading (`loading="lazy"`); evitar librerías pesadas innecesarias |
| RNF-04 | Seguridad | Row Level Security (RLS) habilitado en Supabase; credenciales de Supabase almacenadas en un archivo de configuración separado (`config.js`) no versionado en repositorios públicos |
| RNF-05 | Compatibilidad | Compatible con las últimas 2 versiones de Chrome, Firefox, Safari y Edge |
| RNF-06 | Sin build | El proyecto no requiere herramientas de compilación (no Node.js, no bundler). Funciona directamente en GitHub Pages cargando dependencias desde CDN |

---

## 4. Modelo de Datos

### 4.1 Tabla: `flavors`

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | UUID | PK, auto-generado (`gen_random_uuid()`) | Identificador único del sabor |
| `name` | VARCHAR(100) | NOT NULL | Nombre del sabor |
| `description` | TEXT | Opcional | Descripción del sabor |
| `price` | DECIMAL(10,2) | NOT NULL, CHECK > 0 | Precio unitario del boli |
| `stock` | INTEGER | DEFAULT 0, CHECK >= 0 | Unidades disponibles en inventario |
| `image_url` | TEXT | Opcional | URL pública de la imagen en Supabase Storage |
| `category` | VARCHAR(50) | DEFAULT 'clasico' | Categoría del sabor. Valores: `clasico`, `frutal`, `cremoso`, `picante`, `especial` |
| `is_available` | BOOLEAN | DEFAULT true | Controla si el sabor aparece en la tienda pública |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Fecha de creación del registro |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Fecha de última modificación (actualizado automáticamente por trigger) |

### 4.2 Storage: bucket `bolis-images`

- Tipo: **Público** (las imágenes son accesibles mediante URL directa sin autenticación)
- Límite de tamaño por archivo: 2 MB (2,097,152 bytes)
- Tipos MIME permitidos: `image/jpeg`, `image/png`, `image/webp`

---

## 5. Integraciones

| Servicio | Uso | Mecanismo |
|----------|-----|-----------|
| **Supabase Auth** | Autenticación de la administradora | Email/contraseña; sesión gestionada por el cliente JS de Supabase |
| **Supabase Database** | Almacenamiento del catálogo de sabores | PostgreSQL con RLS habilitado; acceso vía Supabase JS Client |
| **Supabase Storage** | Almacenamiento de imágenes de los bolis | Bucket público `bolis-images`; acceso vía Supabase JS Client |
| **WhatsApp** | Canal de pedidos | Enlace `https://wa.me/{numero}?text={mensaje}` con mensaje URL-encoded |

---

## 6. Flujos de Usuario

### Flujo Cliente (Compra)

```
1. El cliente abre la web (index.html)
   → Se carga el catálogo de sabores disponibles desde Supabase

2. El cliente hace clic en "Agregar al carrito" en el sabor deseado
   → El item se agrega al carrito y se persiste en localStorage
   → El badge del carrito en el header se actualiza

3. El cliente abre el carrito lateral
   → Visualiza los items agregados con sus cantidades y precios
   → Puede ajustar cantidades (+ / -) o eliminar items
   → Ve el total calculado

4. El cliente hace clic en "Hacer Pedido por WhatsApp"
   → El sistema genera el mensaje con el detalle del pedido
   → Se abre WhatsApp Web/App con el número de la tienda y el mensaje pre-cargado

5. La dueña recibe el mensaje de pedido en WhatsApp
   → Confirma disponibilidad y coordina la entrega por el mismo canal
```

### Flujo Administradora (Gestión de Inventario)

```
1. La dueña accede a /admin.html
   → El sistema detecta que no hay sesión activa
   → Se muestra la pantalla de login

2. Ingresa su email y contraseña → hace clic en "Iniciar sesión"
   → Supabase Auth valida las credenciales
   → Se redirige al dashboard de administración

3. En el dashboard, la dueña ve la tabla completa de inventario
   → Todos los sabores (disponibles y no disponibles)

4. Para agregar un nuevo sabor:
   → Hace clic en "Agregar sabor"
   → Completa el formulario (nombre, descripción, precio, stock, categoría, imagen)
   → Previsualiza la imagen seleccionada
   → Hace clic en "Guardar"
   → La imagen se sube a Supabase Storage y el registro se inserta en la tabla flavors

5. Para editar un sabor:
   → Hace clic en el botón "Editar" del sabor deseado
   → Modifica los campos necesarios (incluyendo imagen si se requiere)
   → Hace clic en "Guardar cambios"

6. Para eliminar un sabor:
   → Hace clic en "Eliminar"
   → Confirma la acción en el diálogo de confirmación
   → El registro se elimina de la base de datos

7. Los cambios se reflejan de forma inmediata en la tienda pública (index.html)
```

---

## 7. Estructura de Archivos del Proyecto

```
Dimomat/
├── index.html              # Tienda pública (catálogo + carrito)
├── admin.html              # Panel de administración (requiere login)
├── config.js               # Credenciales de Supabase (NO versionar en público)
├── js/
│   ├── app.js              # Lógica de la tienda pública
│   ├── cart.js             # Lógica del carrito y pedido WhatsApp
│   └── admin.js            # Lógica del panel de administración
├── docs/
│   └── requirements.md     # Este documento
└── supabase/
    └── schema.sql          # Schema SQL para ejecutar en Supabase
```

---

*Documento generado para el proyecto Bolis Gourmet — Negocio familiar pyme de bolis artesanales/gourmet.*

