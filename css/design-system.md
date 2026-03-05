# Sistema de Diseno - Bolis Dimomat

Version: 1.0
Fecha: 2026-03-04
Autor: Disenador UI/UX

---

## 1. Identidad Visual

**Nombre:** Bolis Dimomat
**Personalidad:** Tropical, vibrante, artesanal, familiar y divertido.
**Tono visual:** Colores calidos y saturados que evocan frutas tropicales, paletas y verano. Tipografia amigable y redondeada.

---

## 2. Paleta de Colores

### Colores Principales

| Token CSS              | Valor Hex | Nombre          | Uso principal                          |
|------------------------|-----------|-----------------|----------------------------------------|
| `--color-primary`      | `#FF6B6B` | Coral / Sandia  | Navbar, botones CTA, titulos, precios  |
| `--color-primary-dark` | `#EE5A5A` | Coral oscuro    | Hover de botones primarios             |
| `--color-secondary`    | `#FFD93D` | Amarillo mango  | Badges del carrito, acentos            |
| `--color-accent`       | `#6BCB77` | Verde lima      | Estado "agregado", toggle activo       |
| `--color-purple`       | `#845EC2` | Morado uva      | Gradiente del login admin              |
| `--color-blue`         | `#4D96FF` | Azul cielo      | Reservado para elementos informativos  |

### Fondos

| Token CSS       | Valor Hex | Uso                          |
|-----------------|-----------|------------------------------|
| `--bg-main`     | `#FFF9F0` | Fondo general de la pagina   |
| `--bg-card`     | `#FFFFFF` | Fondo de cards y paneles     |
| `--bg-header`   | `#FF6B6B` | Fondo del navbar             |

### Textos

| Token CSS          | Valor Hex | Uso                            |
|--------------------|-----------|--------------------------------|
| `--text-primary`   | `#2D3748` | Texto principal, titulos       |
| `--text-secondary` | `#718096` | Texto secundario, subtitulos   |
| `--text-light`     | `#FFFFFF` | Texto sobre fondos de color    |

### Paleta de Categorias (badges)

| Categoria  | Clase CSS      | Fondo     | Texto     |
|------------|----------------|-----------|-----------|
| Frutal     | `.cat-frutal`  | `#FFF0F0` | `#E53E3E` |
| Cremoso    | `.cat-cremoso` | `#F0FFF4` | `#276749` |
| Picante    | `.cat-picante` | `#FFFAF0` | `#C05621` |
| Especial   | `.cat-especial`| `#FAF5FF` | `#6B46C1` |
| Clasico    | `.cat-clasico` | `#EBF4FF` | `#2B6CB0` |

### Paleta de Stock (badges)

| Estado     | Clase CSS         | Descripcion                 |
|------------|-------------------|-----------------------------|
| Disponible | `.badge-available`| Stock suficiente (> 5)      |
| Poco stock | `.badge-low`      | Stock bajo (1-5 unidades)   |
| Agotado    | `.badge-out`      | Stock = 0, boton deshabilitado|

---

## 3. Tipografia

### Fuentes

Ambas fuentes se cargan desde Google Fonts via `@import` en `style.css`.

```
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Pacifico&display=swap');
```

| Fuente      | Tipo       | Pesos disponibles | Uso                                      |
|-------------|------------|-------------------|------------------------------------------|
| **Pacifico**| Display    | 400 (regular)     | Logo/brand, titulos hero, titulos de seccion, modal titles |
| **Nunito**  | Sans-serif | 400, 600, 700, 800, 900 | Todo el resto: body, botones, labels, precios |

### Jerarquia tipografica

| Elemento          | Fuente   | Peso | Tamano aproximado | Clase / contexto         |
|-------------------|----------|------|-------------------|--------------------------|
| Brand/Logo        | Pacifico | 400  | 1.5rem            | `.navbar-brand`          |
| Titulo hero       | Pacifico | 400  | clamp(1.8-3rem)   | `.hero-title`            |
| Titulo de seccion | Pacifico | 400  | 1.8rem            | `.section-title`         |
| Titulo modal      | Pacifico | 400  | 1.3rem            | `.modal-title`           |
| Nombre sabor      | Nunito   | 800  | 1.05rem           | `.flavor-name`           |
| Precio            | Nunito   | 900  | 1.2rem            | `.flavor-price`          |
| Descripcion       | Nunito   | 400  | 0.85rem           | `.flavor-desc`           |
| Botones           | Nunito   | 700-800 | 0.95-1.1rem    | `.add-to-cart-btn`, etc. |
| Labels de form    | Nunito   | 700  | 0.85rem           | `.form-label`            |

---

## 4. Espaciado y Bordes

| Token CSS           | Valor  | Uso                               |
|---------------------|--------|-----------------------------------|
| `--border-radius`   | `16px` | Cards, drawer, modales            |
| `--border-radius-sm`| `8px`  | Botones, inputs, badges           |

### Sombras

| Token CSS          | Valor                                      | Uso                        |
|--------------------|--------------------------------------------|----------------------------|
| `--shadow-card`    | `0 4px 20px rgba(255,107,107, 0.15)`       | Cards en estado normal     |
| `--shadow-hover`   | `0 8px 30px rgba(255,107,107, 0.3)`        | Cards en hover             |
| `--shadow-header`  | `0 2px 20px rgba(0,0,0,0.1)`               | Navbar sticky              |

---

## 5. Componentes del Sistema

### 5.1 Navbar

**Clases:** `.navbar`, `.navbar-brand`, `.cart-btn`, `.cart-badge`

Comportamiento:
- `position: sticky; top: 0` — se queda fijo al hacer scroll
- El badge del carrito tiene animacion `badge-pop` al actualizarse
- El boton del carrito eleva con `translateY(-2px)` en hover

Uso con Tailwind:
```html
<nav class="navbar">
  <a href="/" class="navbar-brand">Bolis Dimomat</a>
  <button class="cart-btn">
    Carrito
    <span class="cart-badge">3</span>
  </button>
</nav>
```

---

### 5.2 Hero Section

**Clases:** `.hero`, `.hero-title`, `.hero-subtitle`, `.hero-btn`

- Gradiente: `#FF6B6B -> #FF8E53 -> #FFD93D`
- Pseudo-elemento `::before` agrega emoji decorativo de fondo con opacidad baja
- El boton hero tiene sombra y elevacion en hover

```html
<section class="hero">
  <h1 class="hero-title">Bolis Artesanales</h1>
  <p class="hero-subtitle">Los mejores sabores de la temporada</p>
  <button class="hero-btn">Ver Sabores</button>
</section>
```

---

### 5.3 Flavor Card (Tarjeta de Sabor)

**Clases:** `.flavor-card`, `.flavor-card-img`, `.flavor-card-body`, `.flavor-name`, `.flavor-desc`, `.flavor-footer`, `.flavor-price`, `.flavor-stock-badge`, `.add-to-cart-btn`

Estados del boton:
- Normal: fondo `--color-primary` (coral)
- Hover: `--color-primary-dark` + scale 1.02
- Disabled (stock=0): fondo `#CBD5E0` gris, cursor `not-allowed`
- Added (recien agregado): fondo `--color-accent` verde + animacion `btn-pulse`

```html
<div class="flavor-card">
  <div class="flavor-card-img">🍓</div>
  <div class="flavor-card-body">
    <h3 class="flavor-name">Fresa con Crema</h3>
    <p class="flavor-desc">Boli de fresa natural con crema suave y azucar...</p>
    <div class="flavor-footer">
      <span class="flavor-price">$15.00</span>
      <span class="flavor-stock-badge badge-available">Disponible</span>
    </div>
    <button class="add-to-cart-btn">+ Agregar al carrito</button>
  </div>
</div>
```

---

### 5.4 Skeleton Loading

**Clases:** `.skeleton-card`, `.skeleton-img`, `.skeleton-line`

Animacion `skeleton-loading` pulsa entre `#f0f0f0` y `#e0e0e0` con duracion 1.2s infinite.

```html
<div class="skeleton-card">
  <div class="skeleton-img"></div>
  <div class="skeleton-line" style="width: 70%"></div>
  <div class="skeleton-line" style="width: 50%"></div>
  <div class="skeleton-line" style="width: 90%; margin-bottom: 16px"></div>
</div>
```

---

### 5.5 Cart Drawer (Carrito Lateral)

**Clases:** `.cart-overlay`, `.cart-drawer`, `.cart-drawer-header`, `.cart-drawer-title`, `.cart-close-btn`, `.cart-items-list`, `.cart-item`, `.cart-item-name`, `.cart-item-price`, `.qty-controls`, `.qty-btn`, `.qty-value`, `.remove-item-btn`, `.cart-empty`, `.cart-footer`, `.cart-total`, `.cart-total-amount`, `.whatsapp-btn`

Apertura/cierre controlado via JS toggling la clase `.open`:
- `.cart-overlay.open` — opacidad 1, pointer-events habilitados
- `.cart-drawer.open` — `right: 0` (desliza desde la derecha)

Estructura de un item del carrito:
```html
<div class="cart-item">
  <span class="cart-item-name">Fresa con Crema</span>
  <div class="qty-controls">
    <button class="qty-btn">-</button>
    <span class="qty-value">2</span>
    <button class="qty-btn">+</button>
  </div>
  <span class="cart-item-price">$30.00</span>
  <button class="remove-item-btn">x</button>
</div>
```

---

### 5.6 Formularios (Login y Modal Admin)

**Clases:** `.form-group`, `.form-label`, `.form-input`, `.error-message`, `.btn-primary`, `.btn-secondary`

Estados del input:
- Normal: border `#E2E8F0`
- Focus: border `--color-primary`
- Error: border `#FC8181` + clase `.error` en el input + `.error-message` debajo

---

### 5.7 Admin Dashboard

**Clases principales:**
- Header: `.admin-header`, `.admin-header-brand`, `.btn-logout`
- Estadisticas: `.stats-grid`, `.stat-card`, `.stat-value`, `.stat-label`
- Tabla: `.table-container`, `.table-header`, `.admin-table`, `.table-img`
- Acciones: `.btn-add-flavor`, `.action-btn`, `.toggle-available`, `.toggle-slider`

El toggle de disponibilidad es un checkbox HTML estilizado con CSS puro:
```html
<label class="toggle-available">
  <input type="checkbox" checked>
  <span class="toggle-slider"></span>
</label>
```

---

### 5.8 Modal

**Clases:** `.modal-overlay`, `.modal`, `.modal-header`, `.modal-title`, `.modal-body`, `.modal-footer`

Apertura via clase `.open` en `.modal-overlay`:
- Fondo oscurecido con opacidad 0.6
- Modal con `transform: translateY(20px)` -> `translateY(0)` al abrir (animacion suave)
- Header sticky dentro del modal para formularios largos

---

### 5.9 Toast de Exito

**Clase:** `.success-toast`

Se inserta dinamicamente en el DOM. Tiene animacion automatica:
- `toast-in` (0-0.3s): aparece desde abajo
- `toast-out` (2.7-3s): desaparece hacia abajo

```javascript
// Uso en JS
const toast = document.createElement('div');
toast.className = 'success-toast';
toast.textContent = 'Sabor guardado exitosamente';
document.body.appendChild(toast);
setTimeout(() => toast.remove(), 3200);
```

---

### 5.10 Area de Carga de Imagen

**Clases:** `.img-upload-area`, `.img-preview`

Estado `dragover` activado via JS al arrastrar archivos:
```javascript
dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
```

---

## 6. Integracion con Tailwind CSS

El proyecto usa **Tailwind CSS via CDN** + las clases personalizadas de `style.css`. La estrategia es:

- **Tailwind** maneja: layout (flex, grid), padding/margin utilitario, visibilidad rapida
- **style.css** define: componentes complejos, animaciones, variables de color, tipografia

### Combinacion recomendada

```html
<!-- Usar clase personalizada para el componente + Tailwind para ajustes rapidos -->
<div class="flavor-card mb-4">...</div>

<!-- Usar solo Tailwind para layout de contenedor -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">...</div>

<!-- Usar clase de style.css para estados con animacion -->
<button class="add-to-cart-btn" onclick="this.classList.add('added')">
  + Agregar
</button>
```

### Variables CSS en Tailwind (config inline)

Para usar los tokens de color en clases arbitrarias de Tailwind:
```html
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          primary: '#FF6B6B',
          secondary: '#FFD93D',
          accent: '#6BCB77'
        }
      }
    }
  }
</script>
```

---

## 7. Animaciones

| Nombre             | Duracion  | Uso                                          |
|--------------------|-----------|----------------------------------------------|
| `badge-pop`        | 0.3s ease | Badge del carrito al actualizar cantidad     |
| `btn-pulse`        | 0.4s ease | Boton "Agregar" al confirmar accion           |
| `skeleton-loading` | 1.2s inf  | Placeholder mientras cargan los datos        |
| `toast-in`         | 0.3s ease | Toast de confirmacion al aparecer            |
| `toast-out`        | 0.3s ease | Toast de confirmacion al desaparecer (delay 2.7s) |

---

## 8. Diseno Responsivo

| Breakpoint | Ancho max | Cambios aplicados                                                      |
|------------|-----------|------------------------------------------------------------------------|
| Default    | > 640px   | Grid auto-fill minmax(240px), drawer 420px                            |
| `sm`       | <= 640px  | Grid 2 columnas, imagenes de card 130px alto, drawer 100vw, oculta columnas 3 y 4 de tabla |
| `xs`       | <= 400px  | Grid 1 columna                                                         |

El diseno sigue el principio **mobile-first** con `clamp()` para tipografia fluida.

---

*Sistema de diseno creado para Bolis Dimomat — 2026-03-04*
