// ================================================
// CATALOGO DE SABORES - Bolis Gourmet
// ================================================
// Requiere: supabase-client.js, cart.js cargados antes

var SAMPLE_FLAVORS = [
  { id: '1', name: 'Fresa Natural', description: 'Fresas frescas con leche condensada. Sabor auténtico y refrescante.', price: 20, stock: 50, category: 'frutal', is_available: true, image_url: null },
  { id: '2', name: 'Mango Chamoy', description: 'Mango con chamoy especial y chile piquín. ¡Irresistible!', price: 25, stock: 30, category: 'picante', is_available: true, image_url: null },
  { id: '3', name: 'Tamarindo Enchilado', description: 'Tamarindo con chile, sal y limón. El favorito de los atrevidos.', price: 20, stock: 40, category: 'picante', is_available: true, image_url: null },
  { id: '4', name: 'Nuez y Cajeta', description: 'Cajeta artesanal de cabra con trozos de nuez. Sabor gourmet único.', price: 30, stock: 20, category: 'cremoso', is_available: true, image_url: null },
  { id: '5', name: 'Horchata Canela', description: 'Horchata tradicional con canela molida. Cremoso y reconfortante.', price: 25, stock: 0, category: 'cremoso', is_available: false, image_url: null },
  { id: '6', name: 'Limón con Chile', description: 'Limón fresco con chile piquín. Refrescante y picosito a la vez.', price: 20, stock: 35, category: 'picante', is_available: true, image_url: null }
];

var CATEGORY_EMOJI = {
  frutal: '🍓',
  cremoso: '🍦',
  picante: '🌶️',
  especial: '⭐',
  clasico: '🧊'
};

// Carga sabores desde Supabase o usa datos de muestra
async function loadFlavors() {
  showSkeletons();

  if (!supabaseClient) {
    console.warn('Usando datos de muestra (Supabase no configurado)');
    setTimeout(function () {
      renderCatalog(SAMPLE_FLAVORS.filter(function (f) { return f.is_available; }));
    }, 800);
    return;
  }

  try {
    var result = await supabaseClient
      .from('flavors')
      .select('*')
      .eq('is_available', true)
      .order('name');

    if (result.error) throw result.error;

    if (!result.data || result.data.length === 0) {
      showEmptyCatalog();
      return;
    }

    renderCatalog(result.data);
  } catch (error) {
    console.error('Error cargando sabores:', error);
    showCatalogError();
  }
}

function showSkeletons() {
  var grid = document.getElementById('flavors-grid');
  if (!grid) return;
  var html = '';
  for (var i = 0; i < 6; i++) {
    html += '<div class="skeleton-card">' +
      '<div class="skeleton-img"></div>' +
      '<div class="skeleton-line" style="width:70%;margin-top:12px"></div>' +
      '<div class="skeleton-line" style="width:90%"></div>' +
      '<div class="skeleton-line" style="width:50%"></div>' +
      '</div>';
  }
  grid.innerHTML = html;
}

function renderCatalog(flavors) {
  var grid = document.getElementById('flavors-grid');
  if (!grid) return;
  if (!flavors || flavors.length === 0) { showEmptyCatalog(); return; }
  var html = '';
  for (var i = 0; i < flavors.length; i++) { html += renderFlavorCard(flavors[i]); }
  grid.innerHTML = html;
}

function renderFlavorCard(flavor) {
  var isOutOfStock = flavor.stock === 0;
  var isLowStock = flavor.stock > 0 && flavor.stock <= 5;
  var emoji = CATEGORY_EMOJI[flavor.category] || '🧊';
  var sym = typeof CURRENCY_SYMBOL !== 'undefined' ? CURRENCY_SYMBOL : '$';
  var price = sym + parseFloat(flavor.price).toFixed(2);

  var stockBadge = isOutOfStock
    ? '<span class="flavor-stock-badge badge-out">Agotado</span>'
    : isLowStock
      ? '<span class="flavor-stock-badge badge-low">Últimos ' + flavor.stock + '</span>'
      : '<span class="flavor-stock-badge badge-available">Disponible</span>';

  var imgHtml = flavor.image_url
    ? '<img src="' + escapeHtml(flavor.image_url) + '" alt="' + escapeHtml(flavor.name) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="this.parentNode.innerHTML=\'<span style=font-size:3.5rem>' + emoji + '</span>\'">'
    : '<span style="font-size:3.5rem">' + emoji + '</span>';

  var safeId = escapeHtml(String(flavor.id));
  var safeName = escapeHtml(flavor.name);          // solo para display HTML
  var nameForJs = JSON.stringify(flavor.name);     // nombre original para el argumento JS (evita doble-escape)
  var btnDisabled = isOutOfStock ? 'disabled' : '';
  var btnText = isOutOfStock ? 'Agotado' : 'Agregar al carrito 🛒';

  return '<div class="flavor-card">' +
    '<div class="flavor-card-img">' + imgHtml + '</div>' +
    '<div class="flavor-card-body">' +
      '<h3 class="flavor-name">' + safeName + '</h3>' +
      '<p class="flavor-desc">' + escapeHtml(flavor.description || '') + '</p>' +
      '<div class="flavor-footer">' +
        '<span class="flavor-price">' + price + '</span>' +
        stockBadge +
      '</div>' +
      '<button class="add-to-cart-btn" ' + btnDisabled +
        ' onclick="handleAddToCart(\'' + safeId + '\', ' + nameForJs + ', ' + parseFloat(flavor.price) + ', this)">' +
        btnText +
      '</button>' +
    '</div>' +
  '</div>';
}

function handleAddToCart(id, name, price, btn) {
  addToCart(id, name, price);
  btn.classList.add('added');
  btn.textContent = '✓ Agregado';
  setTimeout(function () {
    btn.classList.remove('added');
    btn.textContent = 'Agregar al carrito 🛒';
  }, 1500);
}

function showEmptyCatalog() {
  var grid = document.getElementById('flavors-grid');
  if (!grid) return;
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:#718096">' +
    '<div style="font-size:3rem">🧊</div>' +
    '<p style="font-size:1.1rem;font-weight:700">No hay sabores disponibles en este momento</p>' +
    '<p>¡Vuelve pronto para ver nuevos sabores!</p></div>';
}

function showCatalogError() {
  var grid = document.getElementById('flavors-grid');
  if (!grid) return;
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:#718096">' +
    '<div style="font-size:3rem">😓</div>' +
    '<p style="font-size:1.1rem;font-weight:700">Error al cargar los sabores</p>' +
    '<p>Por favor recarga la página.</p>' +
    '<button onclick="loadFlavors()" style="margin-top:1rem;background:#FF6B6B;color:white;border:none;border-radius:8px;padding:0.6rem 1.2rem;cursor:pointer;font-weight:700">Reintentar</button>' +
    '</div>';
}

// Escapa HTML para prevenir XSS
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
