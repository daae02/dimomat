// ================================================
// CARRITO DE COMPRAS - Bolis Gourmet
// ================================================

var CART_KEY = 'bolis_gourmet_cart';

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

function addToCart(flavorId, name, price) {
  var cart = getCart();
  var found = false;
  for (var i = 0; i < cart.length; i++) {
    if (cart[i].id === flavorId) { cart[i].quantity += 1; found = true; break; }
  }
  if (!found) cart.push({ id: flavorId, name: name, price: price, quantity: 1 });
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
      cart[i].quantity = Math.max(1, cart[i].quantity + delta);
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
  return getCart().reduce(function (sum, item) { return sum + item.price * item.quantity; }, 0);
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
  var sym = typeof CURRENCY_SYMBOL !== 'undefined' ? CURRENCY_SYMBOL : '$';

  if (cart.length === 0) {
    list.innerHTML = '<div class="cart-empty">' +
      '<div class="cart-empty-icon">🛒</div>' +
      '<p style="font-weight:700;font-size:1.05rem">Tu carrito está vacío</p>' +
      '<p style="color:#718096;font-size:0.9rem">Agrega tus bolis favoritos</p>' +
      '</div>';
    if (totalEl) totalEl.textContent = sym + '0.00';
    if (whatsappBtn) whatsappBtn.disabled = true;
    return;
  }

  var html = '';
  for (var i = 0; i < cart.length; i++) {
    var item = cart[i];
    var subtotal = sym + (item.price * item.quantity).toFixed(2);
    var safeName = String(item.name).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html += '<div class="cart-item">' +
      '<div class="cart-item-name">' + safeName + '</div>' +
      '<div class="qty-controls">' +
        '<button class="qty-btn" onclick="updateQuantity(\'' + item.id + '\', -1)">−</button>' +
        '<span class="qty-value">' + item.quantity + '</span>' +
        '<button class="qty-btn" onclick="updateQuantity(\'' + item.id + '\', 1)">+</button>' +
      '</div>' +
      '<div class="cart-item-price">' + subtotal + '</div>' +
      '<button class="remove-item-btn" onclick="removeFromCart(\'' + item.id + '\')" title="Eliminar">✕</button>' +
    '</div>';
  }
  list.innerHTML = html;

  if (totalEl) totalEl.textContent = sym + getTotal().toFixed(2);
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
