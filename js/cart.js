// ================================================
// CARRITO DE COMPRAS - Bolis Dimomat
// ================================================

var CART_KEY = 'bolis_dimomat_cart';


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

function getCart() {
  try {
    var data = localStorage.getItem(CART_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
}

function saveCart(cart) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); }
  catch (e) { console.error('Error guardando carrito:', e); }
}

function addToCart(flavorId, name, price, stock) {
  var cart = getCart();
  var found = false;
  for (var i = 0; i < cart.length; i++) {
    if (cart[i].id === flavorId) {
      if (stock && cart[i].quantity >= stock) return; // at stock limit
      cart[i].quantity += 1;
      if (stock) cart[i].stock = stock;
      found = true;
      break;
    }
  }
  if (!found) cart.push({ id: flavorId, name: name, price: price, quantity: 1, stock: stock || 0 });
  saveCart(cart);
  updateCartBadge();
  renderCart();
}

function removeFromCart(flavorId) {
  saveCart(getCart().filter(function (item) { return item.id !== flavorId; }));
  updateCartBadge();
  renderCart();
}

function updateQuantity(flavorId, delta) {
  var cart = getCart();
  for (var i = 0; i < cart.length; i++) {
    if (cart[i].id === flavorId) {
      var newQty = cart[i].quantity + delta;
      if (delta > 0 && cart[i].stock && newQty > cart[i].stock) return; // cap at stock
      cart[i].quantity = Math.max(1, newQty);
      break;
    }
  }
  saveCart(cart);
  updateCartBadge();
  renderCart();
}

function clearCart() {
  saveCart([]);
  updateCartBadge();
  renderCart();
}

function getTotal() {
  return getCart().reduce(function (sum, item) { return sum + normalizeAmount(item.price) * item.quantity; }, 0);
}

function getItemCount() {
  return getCart().reduce(function (sum, item) { return sum + item.quantity; }, 0);
}

function updateCartBadge() {
  var badge = document.getElementById('cart-badge');
  if (!badge) return;
  var count = getItemCount();
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

function renderCart() {
  var list = document.getElementById('cart-items-list');
  var totalEl = document.getElementById('cart-total-amount');
  var whatsappBtn = document.getElementById('whatsapp-order-btn');
  if (!list) return;

  var cart = getCart();

  if (cart.length === 0) {
    list.innerHTML = '<div class="cart-empty">' +
      '<div class="cart-empty-icon">🛒</div>' +
      '<p style="font-weight:700;font-size:1.05rem">Tu carrito está vacío</p>' +
      '<p style="color:#718096;font-size:0.9rem">Agrega tus bolis favoritos</p>' +
      '</div>';
    if (totalEl) totalEl.textContent = formatColones(0);
    if (whatsappBtn) whatsappBtn.disabled = true;
    return;
  }

  var html = '';
  for (var i = 0; i < cart.length; i++) {
    var item = cart[i];
    var subtotal = formatColones(normalizeAmount(item.price) * item.quantity);
    var safeName = String(item.name).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var atStockLimit = item.stock && item.quantity >= item.stock;
    html += '<div class="cart-item">' +
      '<div class="cart-item-name">' + safeName + '</div>' +
      '<div class="qty-controls">' +
        '<button class="qty-btn" onclick="updateQuantity(\'' + item.id + '\', -1)">−</button>' +
        '<span class="qty-value">' + item.quantity + '</span>' +
        '<button class="qty-btn" onclick="updateQuantity(\'' + item.id + '\', 1)"' + (atStockLimit ? ' disabled title="Stock maximo"' : '') + '>+</button>' +
      '</div>' +
      '<div class="cart-item-price">' + subtotal + '</div>' +
      '<button class="remove-item-btn" onclick="removeFromCart(\'' + item.id + '\')" title="Eliminar">✕</button>' +
    '</div>';
  }
  list.innerHTML = html;

  if (totalEl) totalEl.textContent = formatColones(getTotal());
  if (whatsappBtn) whatsappBtn.disabled = false;
}

function openCart() {
  var overlay = document.getElementById('cart-overlay');
  var drawer = document.getElementById('cart-drawer');
  if (overlay) overlay.classList.add('open');
  if (drawer) drawer.classList.add('open');
  renderCart();
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  var overlay = document.getElementById('cart-overlay');
  var drawer = document.getElementById('cart-drawer');
  if (overlay) overlay.classList.remove('open');
  if (drawer) drawer.classList.remove('open');
  document.body.style.overflow = '';
}
