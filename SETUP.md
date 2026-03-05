# Guía de Instalación y Deploy - Bolis Gourmet

## Requisitos previos
- Cuenta en [GitHub](https://github.com) (gratis)
- Cuenta en [Supabase](https://supabase.com) (gratis)
- WhatsApp en tu teléfono
- Navegador moderno (Chrome, Firefox, Edge, Safari)
- **No necesitas instalar nada más** — el proyecto no requiere Node.js ni build step

---

## PASO 1: Crear el proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta
2. Haz clic en **"New Project"**
3. Elige un nombre: `bolis-gourmet`
4. Elige una contraseña segura para la base de datos (guárdala)
5. Selecciona la región más cercana (p.ej. `South America (São Paulo)`)
6. Haz clic en **"Create new project"** y espera ~2 minutos

### Obtener las credenciales

1. En tu proyecto Supabase, ve a **Settings → API**
2. Copia estos dos valores:
   - **Project URL** → algo como `https://xyzxyz.supabase.co`
   - **anon / public key** → una cadena larga que empieza con `eyJ...`

---

## PASO 2: Configurar la base de datos

1. En Supabase, ve a **SQL Editor** (ícono de base de datos en el menú lateral)
2. Haz clic en **"New query"**
3. Abre el archivo `supabase/schema.sql` de este proyecto
4. Copia todo el contenido y pégalo en el editor SQL
5. Haz clic en **"Run"** (▶)
6. Deberías ver: `Success. No rows returned` — eso es correcto

Esto crea:
- La tabla `flavors` con todos los campos
- La tabla `orders` para el sistema de pedidos
- Las políticas RLS (seguridad por filas)
- El bucket de almacenamiento `bolis-images`
- 8 sabores de muestra para empezar

---

## PASO 3: Activar y verificar el Storage de imágenes

El Storage se configura automáticamente con el `schema.sql`, pero verifica que quedó bien:

1. En Supabase, ve a **Storage** (ícono de archivos en el menú lateral)
2. Deberías ver el bucket **`bolis-images`** ya creado
3. Verifica que el bucket es **público** (columna "Public" = true)
4. Si no aparece el bucket, créalo manualmente:
   - Haz clic en **"New bucket"**
   - Nombre: `bolis-images`
   - Activa **"Public bucket"**
   - Haz clic en **"Create bucket"**
5. En el bucket `bolis-images`, ve a **Policies** y verifica que existen estas políticas:
   - `Public read bolis images` — permite a todos ver las imágenes
   - `Authenticated upload bolis images` — solo admin puede subir
   - `Authenticated delete bolis images` — solo admin puede eliminar

Si las políticas no existen, ejecuta en el SQL Editor:
```sql
CREATE POLICY "Public read bolis images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bolis-images');

CREATE POLICY "Authenticated upload bolis images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'bolis-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated delete bolis images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'bolis-images' AND auth.role() = 'authenticated');
```

---

## PASO 4: Desplegar las Edge Functions

Las Edge Functions manejan la creación y procesamiento de órdenes.
Necesitas instalar la CLI de Supabase para desplegarlas.

### 4.1 Instalar Supabase CLI

**Windows (con Scoop):**
```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Windows (con Chocolatey):**
```bash
choco install supabase
```

**Alternativa — descargar directo:**
Ve a https://github.com/supabase/cli/releases y descarga el `.exe`

### 4.2 Autenticarte y linkear el proyecto

```bash
# Abrir Git Bash o PowerShell en la carpeta del proyecto
cd C:/Users/Daae2/Documents/diemonmat

# Login en Supabase
supabase login

# Linkear con tu proyecto (el ID lo ves en Settings > General)
supabase link --project-ref TU_PROJECT_ID
```

### 4.3 Desplegar las funciones

```bash
# Desplegar ambas Edge Functions
supabase functions deploy create-order
supabase functions deploy process-order
```

Deberías ver: `Deployed successfully` para cada una.

### 4.4 Verificar el despliegue

1. En Supabase, ve a **Edge Functions**
2. Deberías ver `create-order` y `process-order` en la lista
3. El estado debe ser **Active**

> **Nota:** Si no quieres instalar la CLI, las Edge Functions son opcionales.
> El sistema de pedidos funcionará sin número de pedido — el pedido se hace por WhatsApp normalmente,
> pero no se guardará en la base de datos automáticamente. El inventario se puede actualizar manualmente desde el panel admin.

---

## PASO 5: Crear el usuario administrador

1. En Supabase, ve a **Authentication → Users**
2. Haz clic en **"Invite user"** o **"Add user"**
3. Ingresa el correo de la administradora (el tuyo)
4. Supabase enviará un correo de confirmación
5. Confirma el correo para activar la cuenta
6. Establece una contraseña segura

> Con ese correo y contraseña podrás hacer login en `/admin.html`

---

## PASO 6: Configurar el proyecto

Primero copia `js/config.example.js` a `js/config.js` (este archivo es local y NO se versiona).  
Luego abre `js/config.js` con cualquier editor de texto (Bloc de notas, VS Code, etc.) y actualiza:

```javascript
const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co';    // <- Pega tu Project URL
const SUPABASE_ANON_KEY = 'eyJ...TU_ANON_KEY...';          // <- Pega tu anon key
const WHATSAPP_NUMBER = '5219XXXXXXXXXX';                   // <- Tu número con código país
const BUSINESS_NAME = 'Bolis Gourmet';                      // <- Nombre de tu negocio
const CURRENCY_SYMBOL = '$';                                // <- Símbolo de moneda
```

> El campo `FUNCTIONS_URL` se construye automáticamente a partir de `SUPABASE_URL` — no lo necesitas cambiar.

### Formato del número de WhatsApp

| País    | Ejemplo             | Formato correcto  |
|---------|---------------------|-------------------|
| México  | (55) 1234-5678      | `5215512345678`   |
| México  | (222) 987-6543      | `5212229876543`   |
| Colombia| 300 123 4567        | `573001234567`    |
| USA     | (555) 123-4567      | `15551234567`     |

> **Sin espacios, sin guiones, sin paréntesis, con código de país (52 para México)**

---

## PASO 7: Subir a GitHub Pages

### 7.1 Crear el repositorio en GitHub

1. Ve a [github.com](https://github.com) y crea una cuenta si no tienes
2. Haz clic en **"+"** → **"New repository"**
3. Nombre: `bolis-gourmet` (o el que quieras)
4. Deja en **Public** (necesario para GitHub Pages gratis)
5. Haz clic en **"Create repository"**

### 7.2 Subir los archivos

**Opción A — Desde el navegador (más fácil):**

1. En tu repositorio vacío, haz clic en **"uploading an existing file"**
2. Arrastra y suelta TODOS los archivos y carpetas del proyecto
3. Escribe un mensaje: `Primer commit - Bolis Gourmet`
4. Haz clic en **"Commit changes"**

**Opción B — Con Git (si lo tienes instalado):**

```bash
cd C:/Users/Daae2/Documents/diemonmat
git init
git add index.html admin.html css/ js/ assets/ supabase/schema.sql SETUP.md
git commit -m "Bolis Gourmet - sitio completo"
git remote add origin https://github.com/TU_USUARIO/bolis-gourmet.git
git push -u origin main
```

> **Importante:** No subas la carpeta `supabase/functions/` — las edge functions se despliegan con la CLI, no con GitHub Pages.

### 7.3 Activar GitHub Pages

1. En tu repositorio, ve a **Settings** (engranaje)
2. En el menú lateral, haz clic en **Pages**
3. En **"Source"**, selecciona **"Deploy from a branch"**
4. En **"Branch"**, selecciona **"main"** y carpeta **"/ (root)"**
5. Haz clic en **"Save"**
6. Espera 1-2 minutos y recarga la página
7. Verás: `Your site is published at https://TU_USUARIO.github.io/bolis-gourmet/`

---

## PASO 8: Verificar que todo funciona

### Checklist de verificación

**Tienda pública:**
- [ ] Abre `https://TU_USUARIO.github.io/bolis-gourmet/` — muestra el catálogo
- [ ] Los sabores de muestra aparecen correctamente con imágenes emoji
- [ ] Puedes agregar bolis al carrito
- [ ] El badge del carrito muestra el número de items
- [ ] El carrito se abre y muestra los items con controles de cantidad
- [ ] Al hacer clic en "Hacer Pedido por WhatsApp":
  - Se genera un número de pedido (ej: `BG-0001`)
  - Aparece un toast con el número de pedido
  - Se abre WhatsApp con el mensaje que incluye el número

**Panel Admin:**
- [ ] Ve a `.../admin.html` — muestra pantalla de login
- [ ] Puedes hacer login con tu usuario de Supabase
- [ ] El dashboard muestra los sabores en la tabla de inventario
- [ ] Las stats cards muestran conteos correctos
- [ ] Puedes agregar un nuevo sabor con imagen
- [ ] La imagen se sube a Supabase Storage y aparece en la card
- [ ] El nuevo sabor aparece en la tienda pública
- [ ] En la pestaña "Órdenes" aparecen los pedidos de los clientes
- [ ] Puedes buscar por número de pedido
- [ ] Al confirmar un pedido, el inventario se descuenta

---

## Flujo completo de una orden

1. **Cliente** visita la tienda → agrega bolis al carrito
2. **Cliente** hace clic en "Hacer Pedido por WhatsApp"
   - El sistema guarda la orden en Supabase → genera `BG-XXXX`
   - Se muestra el número de pedido en pantalla
   - Se abre WhatsApp con el mensaje que incluye el número de pedido
3. **Cliente** envía el mensaje a la tienda
4. **Administradora** recibe el mensaje en WhatsApp con el número `BG-XXXX`
5. **Administradora** abre el panel admin → tab "Órdenes"
6. **Administradora** escribe `BG-XXXX` en el buscador y hace clic en "Buscar Pedido"
7. Se muestran todos los items del pedido con cantidades editables
8. **Administradora** puede editar cantidades si el cliente cambió de opinión
9. **Administradora** agrega una nota opcional (ej: "Entregar a domicilio")
10. **Administradora** hace clic en **"Confirmar y Descontar Inventario"**
11. El sistema descuenta el stock de cada sabor automáticamente
12. La orden queda marcada como **Procesada**

---

## Uso del panel de administración

### Gestionar el catálogo de sabores
- **Agregar sabor:** Haz clic en "+ Agregar Sabor", llena el formulario y sube una foto
- **Editar sabor:** Haz clic en ✏️ en la fila del sabor
- **Actualizar stock:** Edita el sabor y cambia el número en el campo "Stock"
- **Marcar agotado:** Desactiva el toggle "Disponible" (no elimina el sabor)
- **Eliminar sabor:** Haz clic en 🗑️ y confirma

### Gestionar órdenes
- **Ver pedidos:** Tab "Órdenes" → lista de todos los pedidos
- **Buscar por número:** Escribe el número (ej: BG-0001) en el buscador
- **Editar cantidades:** Las cantidades son editables antes de procesar
- **Procesar pedido:** "Confirmar y Descontar Inventario" → actualiza stock automáticamente
- **Cancelar pedido:** El botón "Cancelar Pedido" no afecta el inventario

---

## Solución de problemas frecuentes

| Problema | Causa probable | Solución |
|----------|---------------|----------|
| El catálogo no carga | `SUPABASE_URL` o `ANON_KEY` incorrectos | Revisa `js/config.js` |
| Error al hacer login en admin | Usuario no confirmado | Revisa el correo de Supabase |
| Las imágenes no se suben | Bucket `bolis-images` no existe o sin permisos | Verifica el PASO 3 |
| WhatsApp no abre | Número mal formateado | Usa solo dígitos con código de país |
| La página muestra "Error 404" | GitHub Pages no activado | Activa Pages en Settings del repo |
| No se genera número de pedido | Edge Functions no desplegadas | Ver PASO 4 (es opcional) |
| Error "stock insuficiente" al procesar | El stock actual es menor al pedido | Edita la cantidad antes de procesar |

---

## Agregar dominio personalizado (opcional)

Si tienes un dominio propio (ej: `bolisabuelita.com`):

1. En Supabase → **Authentication → URL Configuration**:
   - Agrega `https://bolisabuelita.com` a **Site URL**
   - Agrega `https://bolisabuelita.com/**` a **Redirect URLs**
2. En GitHub → **Settings → Pages**:
   - En **Custom domain** escribe tu dominio
   - Activa **Enforce HTTPS**
3. En tu registrador de dominio, apunta el DNS a GitHub Pages

---

## Actualizar el inventario desde el teléfono

El panel admin funciona completamente en móvil. Solo ve a:
`https://TU_SITIO.github.io/bolis-gourmet/admin.html`

Desde tu celular puedes:
- Agregar sabores nuevos (subir fotos directamente de la cámara)
- Actualizar stock después de cada producción
- Ver y procesar pedidos de WhatsApp
- Marcar sabores como agotados cuando se terminan

---

## Soporte

El proyecto fue construido con:
- **GitHub Pages** — hosting gratuito
- **Supabase** — base de datos, storage y edge functions gratuito (plan Free: 500MB DB, 1GB Storage, 500K invocaciones/mes)
- **Tailwind CSS** — estilos (CDN, gratis)
- **WhatsApp wa.me** — sin costo

Para dudas técnicas, el código fuente está completamente documentado en español.
