// ================================================
// CATALOGO DE SABORES - Bolis Dimomat
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

var allFlavors = [];
var activeFilterCat = '';

var CATEGORY_EMOJI = {
  frutal: '🍓',
  cremoso: '🍦',
  picante: '🌶️',
  especial: '⭐',
  clasico: '🧊'
};

var allCatalogCategories = [];
var DEFAULT_CATALOG_CATEGORIES = [
  { slug: 'clasico', name: 'Clásico', emoji: '🧊' },
  { slug: 'frutal',  name: 'Frutal',  emoji: '🍓' },
  { slug: 'cremoso', name: 'Cremoso', emoji: '🍦' },
  { slug: 'picante', name: 'Picante', emoji: '🌶️' },
  { slug: 'especial',name: 'Especial',emoji: '⭐' }
];

async function loadCategoriesForCatalog() {
  if (!supabaseClient) {
    allCatalogCategories = DEFAULT_CATALOG_CATEGORIES;
    renderFilterChips();
    return;
  }
  try {
    var result = await supabaseClient.from('categories').select('*').order('sort_order').order('name');
    if (result.error) throw result.error;
    allCatalogCategories = (result.data && result.data.length > 0) ? result.data : DEFAULT_CATALOG_CATEGORIES;
  } catch (e) {
    allCatalogCategories = DEFAULT_CATALOG_CATEGORIES;
  }
  for (var i = 0; i < allCatalogCategories.length; i++) {
    CATEGORY_EMOJI[allCatalogCategories[i].slug] = allCatalogCategories[i].emoji || '🍦';
  }
  renderFilterChips();
}

function renderFilterChips() {
  var container = document.getElementById('filter-chips-container');
  if (!container) return;
  var current = activeFilterCat;
  var html = '<button class="filter-chip' + (current === '' ? ' active' : '') + '" data-cat="" onclick="selectFilterChip(this)">Todos</button>';
  for (var i = 0; i < allCatalogCategories.length; i++) {
    var c = allCatalogCategories[i];
    var isActive = current === c.slug;
    html += '<button class="filter-chip' + (isActive ? ' active' : '') + '" data-cat="' + escapeHtml(c.slug) + '" onclick="selectFilterChip(this)">' +
      (c.emoji ? c.emoji + ' ' : '') + escapeHtml(c.name) + '</button>';
  }
  container.innerHTML = html;
}

var isLoadingFlavors = false;


function formatColones(amount) {
  var value = normalizeAmount(amount);
  return value.toLocaleString('es-CR', { style: 'currency', currency: 'CRC', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeAmount(amount) {
  if (typeof amount === 'number') return Number.isFinite(amount) ? amount : 0;
  if (typeof amount !== 'string') return Number(amount) || 0;

  var raw = amount.trim();
  if (!raw) return 0;
  var cleaned = raw.replace(/[^\d,.-]/g, '');
  if (cleaned.indexOf(',') !== -1 && cleaned.indexOf('.') === -1) {
    cleaned = cleaned.replace(',', '.');
  } else {
    cleaned = cleaned.replace(/,/g, '');
  }
  var parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Carga sabores desde Supabase o usa datos de muestra
async function loadFlavors(options) {
  var silent = options && options.silent === true;
  if (!silent) showSkeletons();
  if (isLoadingFlavors) return;
  isLoadingFlavors = true;

  if (!supabaseClient) {
    console.warn('Usando datos de muestra (Supabase no configurado)');
    setTimeout(function () {
      renderCatalog(SAMPLE_FLAVORS.filter(function (f) { return f.is_available; }));
      isLoadingFlavors = false;
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
      isLoadingFlavors = false;
      return;
    }

    renderCatalog(result.data);
  } catch (error) {
    console.error('Error cargando sabores:', error);
    if (!silent) showCatalogError();
  } finally {
    isLoadingFlavors = false;
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
  allFlavors = flavors || [];
  activeFilterCat = '';
  var chip = document.querySelector('.filter-chip[data-cat=""]');
  if (chip) {
    document.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.remove('active'); });
    chip.classList.add('active');
  }
  var search = document.getElementById('catalog-search');
  if (search) search.value = '';
  _updateFilterChips(allFlavors);
  _renderFilteredCatalog(allFlavors);
}

function _updateFilterChips(flavors) {
  var cats = {};
  for (var i = 0; i < flavors.length; i++) {
    if (flavors[i].category) cats[flavors[i].category] = true;
  }
  document.querySelectorAll('.filter-chip[data-cat]').forEach(function (chip) {
    var cat = chip.getAttribute('data-cat');
    chip.style.display = (cat === '' || cats[cat]) ? '' : 'none';
  });
}

function _renderFilteredCatalog(flavors) {
  var grid = document.getElementById('flavors-grid');
  if (!grid) return;
  if (!flavors || flavors.length === 0) {
    var isFiltered = activeFilterCat || (document.getElementById('catalog-search') && document.getElementById('catalog-search').value.trim());
    if (isFiltered) {
      grid.innerHTML = '<div class="no-results-msg"><div style="font-size:2.5rem">🔍</div><p style="font-size:1.1rem;font-weight:800;margin:0.5rem 0 0.25rem">Sin resultados</p><p style="font-size:0.9rem">Prueba con otra búsqueda o categoría</p></div>';
    } else {
      showEmptyCatalog();
    }
    return;
  }
  var html = '';
  for (var i = 0; i < flavors.length; i++) { html += renderFlavorCard(flavors[i]); }
  grid.innerHTML = html;
}

function filterCatalog() {
  var query = (document.getElementById('catalog-search') ? document.getElementById('catalog-search').value : '').toLowerCase().trim();
  var filtered = allFlavors.filter(function (f) {
    var matchCat = !activeFilterCat || f.category === activeFilterCat;
    var matchName = !query ||
      (f.name || '').toLowerCase().indexOf(query) !== -1 ||
      (f.description || '').toLowerCase().indexOf(query) !== -1;
    return matchCat && matchName;
  });
  _renderFilteredCatalog(filtered);
}

function selectFilterChip(btn) {
  document.querySelectorAll('.filter-chip').forEach(function (c) { c.classList.remove('active'); });
  btn.classList.add('active');
  activeFilterCat = btn.dataset.cat || '';
  filterCatalog();
}

function getCartQtyForId(id) {
  var cart = typeof getCart === 'function' ? getCart() : [];
  for (var i = 0; i < cart.length; i++) {
    if (String(cart[i].id) === String(id)) return cart[i].quantity;
  }
  return 0;
}

function renderFlavorCard(flavor) {
  var isOutOfStock = flavor.stock === 0;
  var isLowStock = flavor.stock > 0 && flavor.stock <= 5;
  var emoji = CATEGORY_EMOJI[flavor.category] || '🧊';
  var price = formatColones(parseFloat(flavor.price));

  var stockBadge = isOutOfStock
    ? '<span class="flavor-stock-badge badge-out">Agotado</span>'
    : isLowStock
      ? '<span class="flavor-stock-badge badge-low">Últimos ' + flavor.stock + '</span>'
      : '<span class="flavor-stock-badge badge-available">' + flavor.stock + ' disp.</span>';

  var emojiFallback = '<span style="font-size:3.5rem">' + emoji + '</span>';
  var imgHtml = flavor.image_url
    ? '<img src="' + escapeHtml(flavor.image_url) + '" alt="' + escapeHtml(flavor.name) + '" data-cat="' + escapeHtml(flavor.category) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="_cardImgFallback(this)">'
    : emojiFallback;

  var safeName = escapeHtml(flavor.name);
  var idForJs = JSON.stringify(String(flavor.id)).replace(/"/g, '&quot;');
  var nameForJs = JSON.stringify(String(flavor.name || '')).replace(/"/g, '&quot;');
  var priceForJs = normalizeAmount(flavor.price);
  if (!Number.isFinite(priceForJs)) priceForJs = 0;
  var stockForJs = Number(flavor.stock) || 0;
  var cartQty = getCartQtyForId(flavor.id);
  var atLimit = !isOutOfStock && stockForJs > 0 && cartQty >= stockForJs;
  var btnDisabled = isOutOfStock || atLimit ? 'disabled' : '';
  var btnText = isOutOfStock
    ? 'Agotado'
    : atLimit
      ? 'Limite alcanzado (' + cartQty + ')'
      : cartQty > 0
        ? 'Agregar mas (' + cartQty + ' en carrito) 🛒'
        : 'Agregar al carrito 🛒';

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
        ' onclick="handleAddToCart(' + idForJs + ', ' + nameForJs + ', ' + priceForJs + ', this, ' + stockForJs + ')">' +
        btnText +
      '</button>' +
    '</div>' +
  '</div>';
}

function handleAddToCart(id, name, price, btn, stock) {
  var added = addToCart(id, name, price, stock);
  var qty = getCartQtyForId(id);

  if (!added) {
    btn.disabled = true;
    btn.classList.remove('added');
    btn.textContent = 'Limite alcanzado (' + qty + ')';
    return;
  }

  if (stock > 0 && qty >= stock) {
    btn.disabled = true;
    btn.classList.remove('added');
    btn.textContent = 'Limite alcanzado (' + qty + ')';
  } else {
    btn.classList.add('added');
    btn.textContent = '✓ ' + qty + ' en carrito';
    setTimeout(function () {
      btn.classList.remove('added');
      btn.textContent = 'Agregar mas (' + qty + ' en carrito) 🛒';
    }, 1200);
  }
}

function showEmptyCatalog() {
  var grid = document.getElementById('flavors-grid');
  if (!grid) return;
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:#718096">' +
    '<div style="margin-bottom:0.5rem"><img src="assets/images/logo.svg" class="logo-img logo-coral" style="height:3rem;width:auto" alt=""></div>' +
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

// Fallback cuando una imagen de sabor falla al cargar
function _cardImgFallback(el) {
  el.onerror = null;
  el.style.display = 'none';
  var cat = el.getAttribute('data-cat') || '';
  var fb;
  fb = document.createElement('span');
  fb.style.fontSize = '3.5rem';
  fb.textContent = CATEGORY_EMOJI[cat] || '🍓';
  el.parentNode.appendChild(fb);
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
