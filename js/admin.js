// ================================================
// PANEL DE ADMINISTRACION - Bolis Dimomat
// ================================================
// Requiere: supabase-client.js cargado antes

var currentEditId = null;
var manualOrderCatalog = [];
var allAdminFlavors = [];
var allOrders = [];
var orderEditorCatalog = [];
var allCategories = [];
var currentEditCategoryId = null;
var DEFAULT_CATEGORIES = [
  { id: null, slug: 'clasico', name: 'Clásico',  emoji: '🧊' },
  { id: null, slug: 'frutal',  name: 'Frutal',   emoji: '🍓' },
  { id: null, slug: 'cremoso', name: 'Cremoso',  emoji: '🍦' },
  { id: null, slug: 'picante', name: 'Picante',  emoji: '🌶️' },
  { id: null, slug: 'especial',name: 'Especial', emoji: '⭐' }
];

function formatMoney(amount) {
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

// ---- AUTH ----

async function initAuth() {
  if (!supabaseClient) {
    showAuthError('Supabase no configurado. Actualiza js/config.js con tus credenciales.');
    return;
  }
  try {
    var sessionResult = await supabaseClient.auth.getSession();
    var session = sessionResult.data.session;
    if (session) {
      showDashboard(session.user);
      loadAdminFlavors();
      loadOrders();
    } else {
      showLogin();
    }
    supabaseClient.auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_IN' && session) {
        showDashboard(session.user);
        loadAdminFlavors();
        loadOrders();
      } else if (event === 'SIGNED_OUT') {
        showLogin();
      }
    });
  } catch (error) {
    showAuthError('Error al verificar sesión: ' + error.message);
  }
}

async function login() {
  var email = document.getElementById('login-email').value.trim();
  var password = document.getElementById('login-password').value;
  var btn = document.getElementById('login-btn');
  var errorEl = document.getElementById('login-error');

  if (!email || !password) { errorEl.textContent = 'Por favor ingresa tu correo y contraseña.'; return; }

  btn.disabled = true;
  btn.textContent = 'Ingresando...';
  errorEl.textContent = '';

  try {
    var result = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
    if (result.error) throw result.error;
  } catch (error) {
    errorEl.textContent = error.message.includes('Email not confirmed')
      ? 'Confirma tu correo electrónico antes de continuar.'
      : 'Correo o contraseña incorrectos.';
    btn.disabled = false;
    btn.textContent = 'Iniciar Sesión';
  }
}

async function logout() {
  if (supabaseClient) await supabaseClient.auth.signOut();
}

function showAuthError(msg) {
  var el = document.getElementById('login-section');
  if (el) {
    el.innerHTML = '<div style="text-align:center;padding:2rem;color:#E53E3E;font-family:Nunito,sans-serif"><p style="font-size:1.1rem;font-weight:700">⚠️ ' + msg + '</p></div>';
    el.style.display = 'flex';
  }
}

function showLogin() {
  document.getElementById('login-section').style.display = 'flex';
  document.getElementById('dashboard-section').style.display = 'none';
}

function showDashboard(user) {
  document.getElementById('login-section').style.display = 'none';
  document.getElementById('dashboard-section').style.display = 'block';
  var el = document.getElementById('admin-user-email');
  if (el) el.textContent = user.email;
  loadCategories();
  subscribeAnalyticsRealtime();
  if (typeof initProductionModule === 'function') initProductionModule();
}

// ---- TABS ----

function switchTab(tabName, btn) {
  document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
  document.querySelectorAll('.admin-tab').forEach(function (t) { t.classList.remove('active'); });
  document.getElementById('tab-' + tabName).classList.add('active');
  btn.classList.add('active');
  if (tabName === 'ordenes') loadOrders();
  if (tabName === 'categorias') loadCategories();
  if (tabName === 'analiticas') renderAnalytics();
  if (tabName === 'produccion' && typeof loadAndRenderIngredients === 'function') {
    switchProdSubtab('ingredientes');
  }
}

// ---- CRUD SABORES ----

async function loadAdminFlavors() {
  var tbody = document.getElementById('flavors-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:#718096">Cargando inventario...</td></tr>';
  try {
    var result = await supabaseClient.from('flavors').select('*, category:categories(id,name,slug,emoji)').order('created_at', { ascending: false });
    if (result.error) throw result.error;
    allAdminFlavors = result.data || [];
    renderAdminTable(allAdminFlavors);
    renderStatsCards(allAdminFlavors);
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:#E53E3E">Error: ' + error.message + '</td></tr>';
  }
}

async function renderStatsCards(flavors) {
  var s = function (id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
  s('stat-total', flavors.length);
  s('stat-stock', flavors.reduce(function (a, f) { return a + (f.stock || 0); }, 0));
  s('stat-available', flavors.filter(function (f) { return f.is_available; }).length);

  // Contar pedidos pendientes
  try {
    var r = await supabaseClient.from('orders').select('id', { count: 'exact' }).eq('status', 'pending');
    s('stat-orders-pending', r.count || 0);
  } catch (e) {
    s('stat-orders-pending', '—');
  }
}

function filterAdminFlavors() {
  var query = (document.getElementById('admin-flavor-search') ? document.getElementById('admin-flavor-search').value : '').toLowerCase().trim();
  var cat = document.getElementById('admin-cat-filter') ? document.getElementById('admin-cat-filter').value : '';
  var stock = document.getElementById('admin-stock-filter') ? document.getElementById('admin-stock-filter').value : '';
  var filtered = allAdminFlavors.filter(function (f) {
    var matchName = !query || (f.name || '').toLowerCase().indexOf(query) !== -1;
    var matchCat = !cat || (f.category && f.category.id === cat);
    var matchStock = !stock ||
      (stock === 'available' && f.is_available && f.stock > 0) ||
      (stock === 'low' && f.stock > 0 && f.stock <= 5) ||
      (stock === 'out' && f.stock === 0);
    return matchName && matchCat && matchStock;
  });
  renderAdminTable(filtered);
}

var CAT_LABELS = { frutal: 'Frutal', cremoso: 'Cremoso', picante: 'Picante', especial: 'Especial', clasico: 'Clásico' };

function getCatLabel(slug) {
  for (var i = 0; i < allCategories.length; i++) {
    if (allCategories[i].slug === slug) return allCategories[i].name;
  }
  return CAT_LABELS[slug] || slug;
}

function getCatEmoji(slug) {
  for (var i = 0; i < allCategories.length; i++) {
    if (allCategories[i].slug === slug) return allCategories[i].emoji || '';
  }
  return '';
}

function renderAdminTable(flavors) {
  var tbody = document.getElementById('flavors-tbody');
  if (!tbody) return;
  if (flavors.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:#718096">No hay sabores registrados. ¡Agrega el primero!</td></tr>';
    return;
  }
  var html = '';
  for (var i = 0; i < flavors.length; i++) {
    var f = flavors[i];
    var imgHtml = f.image_url
      ? '<img src="' + safeAttr(f.image_url) + '" class="table-img" alt="' + safeAttr(f.name) + '" onerror="this.style.display=\'none\'">'
      : '<div class="table-img"><img src="assets/images/logo.svg" class="logo-img logo-coral" style="height:32px;width:auto" alt=""></div>';
    var stockStyle = f.stock === 0 ? 'color:#E53E3E;font-weight:800' : f.stock <= 5 ? 'color:#D97706;font-weight:700' : 'color:#276749';
    var productionCost = parseFloat(f.production_cost) || 0;
    var costDisplay = productionCost > 0 ? '₡' + productionCost.toLocaleString('es-CR') : '<span style="color:#A0AEC0">—</span>';
    // Usar data-flavor-id para abrir el modal — evita embeber JSON crudo en onclick
    var safeRowId = safeAttr(f.id);
    html += '<tr>' +
      '<td>' + imgHtml + '</td>' +
      '<td><strong>' + safeText(f.name) + '</strong></td>' +
      '<td><span class="category-badge cat-' + safeAttr((f.category && f.category.slug) || '') + '">' + safeText((f.category && f.category.emoji) || '') + ' ' + safeText((f.category && f.category.name) || 'Sin categoría') + '</span></td>' +
      '<td>' + formatMoney(parseFloat(f.price)) + '</td>' +
      '<td style="font-size:0.9rem">' + costDisplay + '</td>' +
      '<td style="' + stockStyle + '">' + (f.stock || 0) + '</td>' +
      '<td><label class="toggle-available"><input type="checkbox" ' + (f.is_available ? 'checked' : '') + ' onchange="toggleAvailability(\'' + safeRowId + '\', this.checked)"><span class="toggle-slider"></span></label></td>' +
      '<td>' +
        '<button class="action-btn" data-flavor-id="' + safeRowId + '" onclick="openEditModalById(this.dataset.flavorId)" title="Editar">✏️</button>' +
        '<button class="action-btn" onclick="confirmDeleteFlavor(\'' + safeRowId + '\', \'' + safeAttr(f.name) + '\')" title="Eliminar">🗑️</button>' +
      '</td>' +
    '</tr>';
  }
  tbody.innerHTML = html;
}

async function saveFlavor() {
  var name = document.getElementById('f-name').value.trim();
  var desc = document.getElementById('f-description').value.trim();
  var price = parseFloat(document.getElementById('f-price').value);
  var stock = parseInt(document.getElementById('f-stock').value, 10);
  var category = document.getElementById('f-category').value;
  var isAvailable = document.getElementById('f-available').checked;
  var productionCostVal = document.getElementById('f-production-cost').value;
  var productionCost = productionCostVal !== '' ? parseFloat(productionCostVal) : 0;
  var imageFile = document.getElementById('f-image').files[0];
  var currentImageUrl = document.getElementById('f-current-image').value;
  var errorEl = document.getElementById('form-error');
  var saveBtn = document.getElementById('save-btn');

  errorEl.textContent = '';
  if (!name) { errorEl.textContent = 'El nombre es requerido.'; return; }
  if (isNaN(price) || price <= 0) { errorEl.textContent = 'El precio debe ser mayor a 0.'; return; }
  if (isNaN(stock) || stock < 0) { errorEl.textContent = 'El stock no puede ser negativo.'; return; }
  if (isNaN(productionCost) || productionCost < 0) { errorEl.textContent = 'El costo de producción no puede ser negativo.'; return; }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';

  try {
    var imageUrl = currentImageUrl;
    if (imageFile) imageUrl = await uploadImage(imageFile);

    var data = { name: name, description: desc, price: price, stock: stock, category_id: category || null, is_available: isAvailable, image_url: imageUrl || null, production_cost: productionCost || 0 };
    var result = currentEditId
      ? await supabaseClient.from('flavors').update(data).eq('id', currentEditId)
      : await supabaseClient.from('flavors').insert([data]);

    if (result.error) throw result.error;
    closeModal();
    loadAdminFlavors();
    showToast(currentEditId ? '✓ Sabor actualizado' : '✓ Sabor agregado');
  } catch (error) {
    errorEl.textContent = 'Error al guardar: ' + error.message;
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar';
  }
}

async function confirmDeleteFlavor(id, name) {
  if (!confirm('¿Eliminar "' + name + '"?\nEsta acción no se puede deshacer.')) return;
  try {
    var result = await supabaseClient.from('flavors').delete().eq('id', id);
    if (result.error) throw result.error;
    loadAdminFlavors();
    showToast('Sabor eliminado');
  } catch (error) { alert('Error: ' + error.message); }
}

async function toggleAvailability(id, newStatus) {
  try {
    var result = await supabaseClient.from('flavors').update({ is_available: newStatus }).eq('id', id);
    if (result.error) throw result.error;
    showToast(newStatus ? 'Sabor disponible' : 'Sabor no disponible');
    var r = await supabaseClient.from('flavors').select('*');
    if (!r.error) renderStatsCards(r.data);
  } catch (error) { alert('Error: ' + error.message); }
}

// ---- MODAL SABOR ----

function openAddModal() {
  currentEditId = null;
  document.getElementById('modal-title').textContent = 'Agregar Sabor';
  document.getElementById('flavor-form').reset();
  document.getElementById('f-current-image').value = '';
  document.getElementById('img-preview').style.display = 'none';
  document.getElementById('form-error').textContent = '';
  document.getElementById('save-btn').disabled = false;
  document.getElementById('save-btn').textContent = 'Guardar';
  openModalEl();
}

// Abre el modal de edición buscando el sabor por ID (evita JSON en onclick)
async function openEditModalById(flavorId) {
  try {
    var result = await supabaseClient.from('flavors').select('*, category:categories(id,name,slug,emoji)').eq('id', flavorId).single();
    if (result.error) throw result.error;
    openEditModal(result.data);
  } catch (error) {
    alert('Error al cargar el sabor: ' + error.message);
  }
}

function openEditModal(flavor) {
  currentEditId = flavor.id;
  document.getElementById('modal-title').textContent = 'Editar Sabor';
  document.getElementById('f-name').value = flavor.name || '';
  document.getElementById('f-description').value = flavor.description || '';
  document.getElementById('f-price').value = flavor.price || '';
  document.getElementById('f-stock').value = flavor.stock !== undefined ? flavor.stock : 0;
  document.getElementById('f-production-cost').value = flavor.production_cost !== undefined && flavor.production_cost !== null ? parseFloat(flavor.production_cost) : 0;
  document.getElementById('f-category').value = (flavor.category && flavor.category.id) || '';
  document.getElementById('f-available').checked = flavor.is_available !== false;
  document.getElementById('f-current-image').value = flavor.image_url || '';
  document.getElementById('form-error').textContent = '';
  document.getElementById('save-btn').disabled = false;
  document.getElementById('save-btn').textContent = 'Guardar';
  var preview = document.getElementById('img-preview');
  preview.style.display = flavor.image_url ? 'block' : 'none';
  if (flavor.image_url) preview.src = flavor.image_url;
  openModalEl();
}

function openModalEl() {
  var overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  var overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
  currentEditId = null;
}

// ---- STORAGE ----

async function uploadImage(file) {
  if (file.size > 2 * 1024 * 1024) throw new Error('La imagen no puede superar 2MB.');
  var ext = file.name.split('.').pop().toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) throw new Error('Solo JPG, PNG o WebP.');
  var fileName = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  var result = await supabaseClient.storage.from('bolis-images').upload(fileName, file, { upsert: false });
  if (result.error) throw result.error;
  return supabaseClient.storage.from('bolis-images').getPublicUrl(fileName).data.publicUrl;
}

function previewImage(input) {
  var preview = document.getElementById('img-preview');
  if (input.files && input.files[0]) {
    var reader = new FileReader();
    reader.onload = function (e) { preview.src = e.target.result; preview.style.display = 'block'; };
    reader.readAsDataURL(input.files[0]);
  }
}

// ================================================
// GESTION DE ORDENES
// ================================================

// Marca como 'expired' en la BD los pedidos pendientes con más de 24 h sin resolver.
// Muta el array local para evitar un segundo fetch.
async function autoExpireOrders(orders) {
  if (!supabaseClient) return;
  var toExpire = orders.filter(function (o) {
    return (o.status === 'pending' || o.status === 'confirmed') &&
      (Date.now() - new Date(o.created_at).getTime()) > 86400000;
  });
  if (toExpire.length === 0) return;
  var ids = toExpire.map(function (o) { return o.id; });
  try {
    var result = await supabaseClient.from('orders').update({ status: 'expired' }).in('id', ids);
    if (!result.error) {
      toExpire.forEach(function (o) { o.status = 'expired'; });
    }
  } catch (e) { /* silently ignore */ }
}

// Carga y muestra la lista de órdenes
async function loadOrders() {
  var container = document.getElementById('orders-list');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:2rem;color:#718096">Cargando pedidos...</div>';

  try {
    var result = await supabaseClient
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (result.error) throw result.error;

    var orders = result.data || [];
    allOrders = orders;
    await autoExpireOrders(orders);

    if (orders.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:2rem;color:#718096">' +
        '<div style="font-size:2.5rem">🛒</div>' +
        '<p style="font-weight:700">No hay pedidos todavía</p>' +
        '<p style="font-size:0.9rem">Los pedidos aparecerán aquí cuando los clientes hagan una orden por WhatsApp</p>' +
        '</div>';
      return;
    }

    var conflicts = getPendingStockConflicts(orders);

    var html = '';
    for (var i = 0; i < orders.length; i++) {
      var o = orders[i];
      var statusClass = 'status-' + (o.status || 'pending');
      var statusLabel = { pending: 'Pendiente', confirmed: 'Confirmado', processed: 'Procesado', cancelled: 'Cancelado', expired: 'Vencido' }[o.status] || o.status;
      var date = new Date(o.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
      var itemCount = Array.isArray(o.items) ? o.items.reduce(function (s, it) { return s + it.quantity; }, 0) : 0;
      var customerName = o.customer_name ? safeText(o.customer_name) : 'Sin nombre';

      var isExpired = o.status === 'expired';

      var conflictBadge = '';
      if (conflicts[o.id]) {
        var conflictLines = conflicts[o.id].map(function (c) {
          var competingNums = c.competing.map(function (x) { return x.orderNumber; }).join(' y ');
          var suficiente = c.stock >= c.qty;
          var msg = 'Solo hay ' + c.stock + ' ' + safeText(c.name) + ' en stock';
          if (c.competing.length > 0) {
            msg += ', pero entre este pedido (' + c.qty + ') y el ' + safeText(competingNums) +
              ' (' + c.competing.map(function(x){return x.qty;}).join('+') + ') se piden ' + c.total + ' en total';
            msg += suficiente
              ? ' — aceptar este podría dejar al otro sin nada'
              : ' — no alcanza para todos, aceptar uno rechaza al otro';
          }
          return msg;
        });
        conflictBadge = '<div class="order-conflict-warning">⚠️ ' + conflictLines.join('<br>⚠️ ') + '</div>';
      }

      html += '<div class="orders-list-item' + (isExpired ? ' order-expired' : '') + '" onclick="openOrderEditor(\'' + o.id + '\')">' +
        '<span class="order-number-big" style="font-size:1rem">' + safeText(o.order_number) + '</span>' +
        '<div>' +
          '<div style="font-weight:700;font-size:0.9rem">' + itemCount + ' boli(s) — ' + formatMoney(parseFloat(o.total)) + '</div>' +
          '<div style="font-size:0.82rem;color:#4A5568">Cliente: ' + customerName + '</div>' +
          '<div style="font-size:0.8rem;color:#718096">' + date + '</div>' +
          conflictBadge +
        '</div>' +
        '<span class="order-status-badge ' + statusClass + '">' + statusLabel + '</span>' +
        '<span style="color:#718096;font-size:1.2rem">›</span>' +
      '</div>';
    }
    container.innerHTML = html;

  } catch (error) {
    container.innerHTML = '<div style="text-align:center;padding:2rem;color:#E53E3E">Error: ' + error.message + '</div>';
  }
}

// Buscar orden por número de pedido
async function searchOrderByNumber() {
  var input = document.getElementById('order-search-input');
  var orderNumber = input.value.trim().toUpperCase();

  if (!orderNumber) {
    alert('Por favor ingresa el número de pedido.');
    return;
  }

  var editor = document.getElementById('order-editor');
  editor.innerHTML = '<div style="padding:1rem;color:#718096">Buscando ' + safeText(orderNumber) + '...</div>';
  editor.style.display = 'block';

  try {
    var result = await supabaseClient
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .single();

    if (result.error || !result.data) {
      editor.innerHTML = '<div class="order-card"><div style="padding:1.5rem;text-align:center;color:#E53E3E">' +
        '<div style="font-size:2rem">🔍</div>' +
        '<p style="font-weight:700">Pedido "' + safeText(orderNumber) + '" no encontrado</p>' +
        '<p style="font-size:0.9rem;color:#718096">Verifica el número e intenta de nuevo</p>' +
        '</div></div>';
      return;
    }

    renderOrderEditor(result.data);

  } catch (error) {
    editor.innerHTML = '<div style="padding:1rem;color:#E53E3E">Error: ' + error.message + '</div>';
  }
}

// Abrir editor desde la lista de órdenes
async function openOrderEditor(orderId) {
  // Cambiar a tab órdenes
  var ordersTab = document.querySelector('.admin-tab[onclick*="ordenes"]');
  if (ordersTab) switchTab('ordenes', ordersTab);

  var editor = document.getElementById('order-editor');
  editor.innerHTML = '<div style="padding:1rem;color:#718096">Cargando pedido...</div>';
  editor.style.display = 'block';
  editor.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    await loadOrderEditorCatalog();
    var result = await supabaseClient.from('orders').select('*').eq('id', orderId).single();
    if (result.error) throw result.error;
    renderOrderEditor(result.data);
  } catch (error) {
    editor.innerHTML = '<div style="padding:1rem;color:#E53E3E">Error: ' + error.message + '</div>';
  }
}

// Renderiza el editor de una orden
function renderOrderEditor(order) {
  var editor = document.getElementById('order-editor');
  if (!editor) return;

  var statusLabel = { pending: 'Pendiente', confirmed: 'Confirmado', processed: 'Procesado', cancelled: 'Cancelado', expired: 'Vencido' }[order.status] || order.status;
  var statusClass = 'status-' + order.status;
  var isProcessed = order.status === 'processed' || order.status === 'cancelled' || order.status === 'expired';
  var date = new Date(order.created_at).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
  var customerName = order.customer_name ? safeText(order.customer_name) : 'Sin nombre';

  var itemsHtml = '';
  var items = Array.isArray(order.items) ? order.items : [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var readonlyAttr = isProcessed ? 'readonly style="background:#f5f5f5"' : '';
    itemsHtml += '<div class="order-item-row" data-idx="' + i + '">' +
      '<div>' +
        '<div class="order-item-name">' + safeText(item.name) + '</div>' +
        '<div class="order-item-price">' + formatMoney(parseFloat(item.price)) + ' c/u</div>' +
      '</div>' +
      '<div style="font-size:0.85rem;color:#718096">Qty:</div>' +
      '<input class="order-qty-input" type="number" min="0" value="' + item.quantity + '" ' + readonlyAttr +
        ' onchange="updateOrderItemQty(\'' + order.id + '\', ' + i + ', this.value)" data-price="' + item.price + '">' +
      '<div style="font-weight:800;color:#FF6B6B;min-width:60px;text-align:right" id="item-subtotal-' + i + '">' + formatMoney(item.price * item.quantity) + '</div>' +
      (isProcessed ? '' : '<button class="btn-secondary" style="padding:0.45rem 0.65rem;width:auto" onclick="removeOrderItem(\'' + order.id + '\', ' + i + ')">Quitar</button>') +
    '</div>';
  }

  var addItemControls = '';
  if (!isProcessed) {
    addItemControls = '<div style="margin-top:1rem;padding-top:1rem;border-top:1px dashed #E2E8F0">' +
      '<div style="font-size:0.85rem;color:#718096;font-weight:700;margin-bottom:0.5rem">Agregar otros bolis al pedido</div>' +
      '<div style="display:grid;grid-template-columns:minmax(200px,1fr) 90px auto;gap:0.5rem;align-items:center">' +
        '<select id="order-add-item-select-' + order.id + '" class="form-input">' + buildOrderEditorFlavorOptions() + '</select>' +
        '<input id="order-add-item-qty-' + order.id + '" class="form-input" type="number" min="1" step="1" value="1">' +
        '<button class="btn-primary" style="width:auto" onclick="addOrderItemFromCatalog(\'' + order.id + '\')">+ Agregar</button>' +
      '</div>' +
    '</div>';
  }

  var actionButtons = '';
  if (!isProcessed) {
    actionButtons = '<div style="display:flex;gap:0.75rem;flex-wrap:wrap;padding:1.25rem 1.5rem;border-top:1px solid #f0f0f0">' +
      '<div class="form-group" style="flex:1;min-width:200px">' +
        '<label class="form-label">Notas del administrador</label>' +
        '<input id="order-admin-notes-' + order.id + '" class="form-input" type="text" placeholder="Cambios, notas, observaciones..." value="' + safeAttr(order.admin_notes || '') + '">' +
      '</div>' +
      '<div style="display:flex;gap:0.75rem;align-items:flex-end">' +
        '<button class="btn-primary" style="width:auto;background:#25D366" onclick="processOrder(\'' + order.id + '\')">✓ Confirmar y Descontar Inventario</button>' +
        '<button class="btn-secondary" onclick="cancelOrder(\'' + order.id + '\')">✕ Cancelar Pedido</button>' +
      '</div>' +
    '</div>';
  } else if (order.status === 'processed' && order.processed_at) {
    var procDate = new Date(order.processed_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
    actionButtons = '<div style="padding:1rem 1.5rem;background:#F0FFF4;color:#276749;font-weight:700;font-size:0.9rem">' +
      '✓ Procesado el ' + procDate + ' — Inventario actualizado' +
      (order.admin_notes ? '<br><span style="font-weight:400">Nota: ' + safeText(order.admin_notes) + '</span>' : '') +
    '</div>';
  } else if (order.status === 'expired') {
    actionButtons = '<div style="padding:1rem 1.5rem;background:#EDE9FE;color:#5B21B6;font-weight:700;font-size:0.9rem">' +
      '⏰ Este pedido venció sin ser procesado — pasó más de un día sin respuesta.' +
      (order.admin_notes ? '<br><span style="font-weight:400">Nota: ' + safeText(order.admin_notes) + '</span>' : '') +
    '</div>';
  }

  editor.innerHTML = '<div class="order-card">' +
    '<div class="order-card-header">' +
      '<div>' +
        '<span class="order-number-big">' + safeText(order.order_number) + '</span>' +
        '<span style="font-size:0.85rem;color:#718096;margin-left:0.75rem">' + date + '</span>' +
        '<div style="font-size:0.85rem;color:#4A5568;margin-top:0.25rem">Cliente: ' + customerName + '</div>' +
      '</div>' +
      '<span class="order-status-badge ' + statusClass + '">' + statusLabel + '</span>' +
    '</div>' +
    '<div class="order-items-editor">' +
      '<p style="font-weight:700;color:#718096;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 0.75rem">Items del pedido ' + (isProcessed ? '' : '— puedes editar cantidades') + '</p>' +
      itemsHtml +
      addItemControls +
      '<div style="display:flex;justify-content:flex-end;margin-top:1rem;padding-top:0.75rem;border-top:2px solid #f0f0f0">' +
        '<div style="text-align:right">' +
          '<div style="font-size:0.85rem;color:#718096">Total del pedido</div>' +
          '<div style="font-size:1.4rem;font-weight:900;color:#FF6B6B" id="order-total-display-' + order.id + '">' + formatMoney(parseFloat(order.total)) + '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    actionButtons +
  '</div>';

  // Guardar referencia a los items editables
  editor.dataset.orderId = order.id;
  editor.dataset.orderItems = JSON.stringify(items);
  editor.dataset.orderData = JSON.stringify(order);
}

// Actualiza la cantidad de un item en el editor (recalcula total visual)
function updateOrderItemQty(orderId, idx, newQty) {
  var editor = document.getElementById('order-editor');
  if (!editor) return;

  var items = JSON.parse(editor.dataset.orderItems || '[]');
  if (items[idx]) {
    items[idx].quantity = Math.max(0, parseInt(newQty, 10) || 0);
    editor.dataset.orderItems = JSON.stringify(items);

    // Actualizar subtotal visual del item
    var subtotalEl = document.getElementById('item-subtotal-' + idx);
    if (subtotalEl) subtotalEl.textContent = formatMoney(items[idx].price * items[idx].quantity);

    // Recalcular total
    var total = items.reduce(function (s, it) { return s + it.price * it.quantity; }, 0);
    var totalEl = document.getElementById('order-total-display-' + orderId);
    if (totalEl) totalEl.textContent = formatMoney(total);

    persistOrderEditorState(items);
  }
}

function persistOrderEditorState(items) {
  var editor = document.getElementById('order-editor');
  if (!editor) return;

  editor.dataset.orderItems = JSON.stringify(items);

  var orderData = JSON.parse(editor.dataset.orderData || '{}');
  orderData.items = items;
  orderData.total = items.reduce(function (s, it) { return s + Number(it.price || 0) * (parseInt(it.quantity, 10) || 0); }, 0);
  editor.dataset.orderData = JSON.stringify(orderData);
}

function rerenderOrderEditorWithItems(items) {
  var editor = document.getElementById('order-editor');
  if (!editor) return;
  var orderData = JSON.parse(editor.dataset.orderData || '{}');
  orderData.items = items;
  orderData.total = items.reduce(function (s, it) { return s + Number(it.price || 0) * (parseInt(it.quantity, 10) || 0); }, 0);
  renderOrderEditor(orderData);
}

function removeOrderItem(orderId, idx) {
  var editor = document.getElementById('order-editor');
  if (!editor) return;
  var items = JSON.parse(editor.dataset.orderItems || '[]');
  if (!items[idx]) return;

  items.splice(idx, 1);
  rerenderOrderEditorWithItems(items);
}

function buildOrderEditorFlavorOptions() {
  var options = '<option value="">Seleccionar sabor...</option>';
  for (var i = 0; i < orderEditorCatalog.length; i++) {
    var flavor = orderEditorCatalog[i];
    options += '<option value="' + safeAttr(flavor.id) + '">' +
      safeText(flavor.name) + ' (' + formatMoney(flavor.price) + ', stock: ' + flavor.stock + ')' +
      '</option>';
  }
  return options;
}

async function loadOrderEditorCatalog() {
  var result = await supabaseClient
    .from('flavors')
    .select('id, name, price, stock, is_available')
    .eq('is_available', true)
    .order('name');

  if (result.error) throw result.error;
  orderEditorCatalog = result.data || [];
}

async function addOrderItemFromCatalog(orderId) {
  var selectEl = document.getElementById('order-add-item-select-' + orderId);
  var qtyEl = document.getElementById('order-add-item-qty-' + orderId);
  var editor = document.getElementById('order-editor');
  if (!selectEl || !qtyEl || !editor) return;

  if (!selectEl.value) {
    alert('Selecciona un sabor para agregar.');
    return;
  }

  var qtyToAdd = Math.max(1, parseInt(qtyEl.value, 10) || 1);
  var flavor = orderEditorCatalog.find(function (f) { return f.id === selectEl.value; });
  if (!flavor) {
    alert('No se encontró el sabor seleccionado.');
    return;
  }

  var items = JSON.parse(editor.dataset.orderItems || '[]');
  var existing = items.find(function (it) {
    return (it.flavor_id && it.flavor_id === flavor.id) || (it.id && it.id === flavor.id) || it.name === flavor.name;
  });

  if (existing) {
    existing.quantity = (parseInt(existing.quantity, 10) || 0) + qtyToAdd;
  } else {
    items.push({
      flavor_id: flavor.id,
      id: flavor.id,
      name: flavor.name,
      price: Number(flavor.price) || 0,
      quantity: qtyToAdd
    });
  }

  rerenderOrderEditorWithItems(items);
}

async function getAdminAccessToken() {
  var sessionResult = await supabaseClient.auth.getSession();
  var session = sessionResult.data.session || null;
  var nowSec = Math.floor(Date.now() / 1000);
  if (!session || (session.expires_at && session.expires_at <= nowSec + 60)) {
    var refreshed = await supabaseClient.auth.refreshSession();
    session = refreshed.data.session || null;
  }
  var token = session ? session.access_token : null;
  if (!token) throw new Error('Sesion expirada. Por favor vuelve a iniciar sesion.');
  return token;
}

async function callProcessOrder(orderId, items, notes) {
  var functionsUrl = typeof FUNCTIONS_URL !== 'undefined' ? FUNCTIONS_URL : null;
  if (!functionsUrl) throw new Error('FUNCTIONS_URL no configurado en config.js');
  var token = await getAdminAccessToken();
  var anonKey = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '';

  var response = await fetch(functionsUrl + '/process-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: 'Bearer ' + token
    },
    body: JSON.stringify({
      order_id: orderId,
      items: items,
      admin_notes: notes || ''
    })
  });

  var rawBody = await response.text();
  var data = {};
  try {
    data = rawBody ? JSON.parse(rawBody) : {};
  } catch (_) {
    data = { raw: rawBody };
  }

  if (!response.ok) {
    var errMsg = data.error || data.message || data.msg || data.raw || ('HTTP ' + response.status);
    if (Array.isArray(data.details) && data.details.length > 0) {
      errMsg += '\n' + data.details.join('\n');
    }
    throw new Error(errMsg);
  }

  return data;
}

function buildManualFlavorOptions() {
  var options = '<option value="">Seleccionar sabor...</option>';
  for (var i = 0; i < manualOrderCatalog.length; i++) {
    var f = manualOrderCatalog[i];
    options += '<option value="' + safeAttr(f.id) + '">' +
      safeText(f.name) + ' (' + formatMoney(f.price) + ', stock: ' + f.stock + ')' +
      '</option>';
  }
  return options;
}

function addManualOrderRow() {
  var list = document.getElementById('manual-items-list');
  if (!list || manualOrderCatalog.length === 0) return;

  var rowId = 'manual-row-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
  var rowHtml = '<div id="' + rowId + '" class="manual-order-row" style="display:grid;grid-template-columns:1fr 110px auto;gap:0.5rem;align-items:center">' +
    '<select class="form-input" onchange="recalcManualOrderTotal()">' + buildManualFlavorOptions() + '</select>' +
    '<input class="form-input" type="number" min="1" step="1" value="1" oninput="recalcManualOrderTotal()">' +
    '<button class="btn-secondary" style="padding:0.5rem 0.75rem" onclick="removeManualOrderRow(\'' + rowId + '\')">Quitar</button>' +
  '</div>';
  list.insertAdjacentHTML('beforeend', rowHtml);
  recalcManualOrderTotal();
}

function removeManualOrderRow(rowId) {
  var row = document.getElementById(rowId);
  if (row) row.remove();
  recalcManualOrderTotal();
}

function recalcManualOrderTotal() {
  var total = 0;
  var rows = document.querySelectorAll('#manual-items-list .manual-order-row');
  rows.forEach(function (row) {
    var sel = row.querySelector('select');
    var qtyInput = row.querySelector('input');
    if (!sel || !qtyInput) return;
    var qty = Math.max(0, parseInt(qtyInput.value, 10) || 0);
    var flavor = manualOrderCatalog.find(function (f) { return f.id === sel.value; });
    if (flavor && qty > 0) total += Number(flavor.price) * qty;
  });
  var totalEl = document.getElementById('manual-order-total');
  if (totalEl) totalEl.textContent = formatMoney(total);
}

async function openManualOrderModal() {
  var overlay = document.getElementById('manual-order-overlay');
  var list = document.getElementById('manual-items-list');
  if (!overlay || !list) return;

  var result = await supabaseClient
    .from('flavors')
    .select('id, name, price, stock, is_available')
    .eq('is_available', true)
    .gt('stock', 0)
    .order('name');

  if (result.error) {
    alert('No se pudo cargar inventario: ' + result.error.message);
    return;
  }

  manualOrderCatalog = result.data || [];
  list.innerHTML = '';
  document.getElementById('manual-order-notes').value = '';

  if (manualOrderCatalog.length === 0) {
    list.innerHTML = '<div style="padding:1rem;border:1px dashed #CBD5E0;border-radius:8px;color:#718096">No hay sabores con stock disponible.</div>';
  } else {
    addManualOrderRow();
  }

  recalcManualOrderTotal();
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeManualOrderModal() {
  var overlay = document.getElementById('manual-order-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

function collectManualOrderItems() {
  var errors = [];
  var items = [];
  var rows = document.querySelectorAll('#manual-items-list .manual-order-row');
  rows.forEach(function (row, idx) {
    var sel = row.querySelector('select');
    var qtyInput = row.querySelector('input');
    if (!sel || !qtyInput || !sel.value) {
      errors.push('Item ' + (idx + 1) + ': selecciona un sabor.');
      return;
    }
    var qty = parseInt(qtyInput.value, 10) || 0;
    if (qty <= 0) {
      errors.push('Item ' + (idx + 1) + ': cantidad invalida.');
      return;
    }
    var flavor = manualOrderCatalog.find(function (f) { return f.id === sel.value; });
    if (!flavor) {
      errors.push('Item ' + (idx + 1) + ': sabor no encontrado.');
      return;
    }
    if (qty > flavor.stock) {
      errors.push('Item ' + (idx + 1) + ': stock insuficiente para ' + flavor.name + '.');
      return;
    }
    items.push({
      flavor_id: flavor.id,
      name: flavor.name,
      price: Number(flavor.price) || 0,
      quantity: qty
    });
  });

  var total = items.reduce(function (sum, it) { return sum + it.price * it.quantity; }, 0);
  return { items: items, total: total, errors: errors };
}

async function submitManualOrder() {
  var payload = collectManualOrderItems();
  if (payload.errors.length > 0) {
    alert(payload.errors.join('\n'));
    return;
  }
  if (payload.items.length === 0) {
    alert('Agrega al menos un item.');
    return;
  }

  var notesEl = document.getElementById('manual-order-notes');
  var notes = notesEl ? notesEl.value.trim() : '';
  var saveBtn = document.getElementById('manual-order-save-btn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Procesando...';
  }

  try {
    var insert = await supabaseClient
      .from('orders')
      .insert([{
        items: payload.items,
        total: payload.total,
        status: 'pending',
        admin_notes: notes || 'Orden manual'
      }])
      .select('id')
      .single();

    if (insert.error || !insert.data) throw (insert.error || new Error('No se pudo crear la orden manual'));
    await callProcessOrder(insert.data.id, payload.items, notes || 'Orden manual');

    showToast('Compra manual registrada y procesada');
    closeManualOrderModal();
    loadOrders();
    loadAdminFlavors();
  } catch (error) {
    alert('Error en compra manual:\n' + error.message);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar y procesar';
    }
  }
}

// Procesa la orden via Edge Function: descuenta inventario
async function processOrder(orderId) {
  var editor = document.getElementById('order-editor');
  var items = JSON.parse(editor.dataset.orderItems || '[]');
  var adminNotes = document.getElementById('order-admin-notes-' + orderId);
  var notes = adminNotes ? adminNotes.value.trim() : '';

  // Filtrar items con cantidad > 0 y normalizar shape para la Edge Function.
  var validItems = items
    .filter(function (it) { return (parseInt(it.quantity, 10) || 0) > 0; })
    .map(function (it) {
      return {
        flavor_id: it.flavor_id || it.id || null,
        name: it.name,
        price: Number(it.price) || 0,
        quantity: parseInt(it.quantity, 10) || 0
      };
    });
  if (validItems.length === 0) {
    alert('No hay items con cantidad mayor a 0.');
    return;
  }

  var impacted = getImpactedOrders(orderId, validItems, allOrders);
  var confirmMsg = impacted.length > 0
    ? buildImpactWarning(impacted)
    : '¿Confirmar pedido y descontar inventario?\n\nEsta acción actualizará el stock de los sabores.';
  if (!confirm(confirmMsg)) return;

  var processBtn = editor.querySelector('button[onclick*="processOrder"]');
  if (processBtn) { processBtn.disabled = true; processBtn.textContent = '⏳ Procesando...'; }

  try {
    var data = await callProcessOrder(orderId, validItems, notes);

    showToast('✓ Pedido ' + data.order_number + ' procesado — inventario actualizado');
    loadAdminFlavors();
    loadOrders();

    // Recargar el editor para mostrar estado procesado
    setTimeout(function () { openOrderEditor(orderId); }, 500);

  } catch (error) {
    alert('Error al procesar pedido:\n' + error.message);
    if (processBtn) { processBtn.disabled = false; processBtn.textContent = '✓ Confirmar y Descontar Inventario'; }
  }
}

// ---- Detección de conflictos de stock entre pedidos pendientes ----

// Calcula qué pedidos pendientes compiten por el mismo stock limitado.
// Devuelve { orderId: [{ name, qty, stock }] }
function getPendingStockConflicts(orders) {
  var stockByName = {};
  allAdminFlavors.forEach(function (f) { stockByName[f.name] = f.stock || 0; });

  var pending = orders.filter(function (o) { return o.status === 'pending' || o.status === 'confirmed'; });

  var totalDemand = {};
  var demandByOrder = {};
  pending.forEach(function (o) {
    demandByOrder[o.id] = {};
    (o.items || []).forEach(function (item) {
      var n = item.name;
      var qty = parseInt(item.quantity, 10) || 0;
      totalDemand[n] = (totalDemand[n] || 0) + qty;
      demandByOrder[o.id][n] = (demandByOrder[o.id][n] || 0) + qty;
    });
  });

  var overbooked = {};
  Object.keys(totalDemand).forEach(function (n) {
    if (stockByName[n] !== undefined && totalDemand[n] > stockByName[n]) {
      overbooked[n] = { stock: stockByName[n], total: totalDemand[n] };
    }
  });

  var conflictsByOrder = {};
  pending.forEach(function (o) {
    var conflicts = [];
    Object.keys(demandByOrder[o.id] || {}).forEach(function (n) {
      if (overbooked[n]) {
        var competing = pending
          .filter(function (other) { return other.id !== o.id && demandByOrder[other.id][n]; })
          .map(function (other) { return { orderNumber: other.order_number, qty: demandByOrder[other.id][n] }; });
        conflicts.push({
          name: n,
          qty: demandByOrder[o.id][n],
          stock: overbooked[n].stock,
          total: overbooked[n].total,
          competing: competing
        });
      }
    });
    if (conflicts.length > 0) conflictsByOrder[o.id] = conflicts;
  });

  return conflictsByOrder;
}

// Simula procesar un pedido y devuelve qué otros pedidos quedarían sin stock.
function getImpactedOrders(processingOrderId, processingItems, orders) {
  var stockByName = {};
  allAdminFlavors.forEach(function (f) { stockByName[f.name] = f.stock || 0; });

  processingItems.forEach(function (item) {
    if (stockByName[item.name] !== undefined) {
      stockByName[item.name] -= parseInt(item.quantity, 10) || 0;
    }
  });

  var otherPending = orders.filter(function (o) {
    return o.id !== processingOrderId && (o.status === 'pending' || o.status === 'confirmed');
  });

  var impacted = [];
  otherPending.forEach(function (o) {
    var shortfalls = [];
    (o.items || []).forEach(function (item) {
      var remaining = stockByName[item.name] !== undefined ? stockByName[item.name] : 9999;
      var needed = parseInt(item.quantity, 10) || 0;
      if (remaining < needed) {
        shortfalls.push({ name: item.name, needed: needed, available: Math.max(0, remaining) });
      }
    });
    if (shortfalls.length > 0) impacted.push({ order: o, shortfalls: shortfalls });
  });

  return impacted;
}

// Genera el mensaje amigable que se muestra al confirmar un pedido con conflictos.
function buildImpactWarning(impacted) {
  var lines = ['⚠️ ¡Ojo, revisa esto antes de confirmar!', ''];
  lines.push('Si aceptas este pedido, no va a quedar suficiente stock para completar otros pedidos pendientes:');
  lines.push('');
  impacted.forEach(function (imp) {
    var who = imp.order.order_number + (imp.order.customer_name ? ' — ' + imp.order.customer_name : '');
    imp.shortfalls.forEach(function (s) {
      var quedaría = s.available === 0
        ? 'no quedaría ninguno'
        : 'solo quedaría ' + s.available;
      lines.push('• Pedido ' + who + ': pide ' + s.needed + ' ' + s.name + ', pero ' + quedaría + '.');
    });
  });
  lines.push('');
  lines.push('Puede que tengas que cancelar esos pedidos o hablar antes con esos clientes.');
  lines.push('');
  lines.push('¿Quieres confirmar este pedido de todas formas?');
  return lines.join('\n');
}

// Cancela una orden
async function cancelOrder(orderId) {
  if (!confirm('¿Cancelar este pedido?\nNo se afectará el inventario.')) return;
  try {
    var result = await supabaseClient.from('orders').update({ status: 'cancelled' }).eq('id', orderId);
    if (result.error) throw result.error;
    showToast('Pedido cancelado');
    loadOrders();
    openOrderEditor(orderId);
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// ================================================
// ANALÍTICAS v2 — orientado a PYME
// ================================================

var analyticsCurrentPeriod = 'hoy';
var analyticsCustomFrom = '';
var analyticsCustomTo = '';
var analyticsCharts = {};
var analyticsRealtimeSub = null;
var analyticsIsLoading = false;

// ---- Period & range ----

function switchAnalyticsPeriod(period, btn) {
  analyticsCurrentPeriod = period;
  document.querySelectorAll('.period-btn').forEach(function (b) { b.classList.remove('active'); });
  btn.classList.add('active');
  var customEl = document.getElementById('analytics-custom-range');
  if (customEl) customEl.style.display = period === 'custom' ? 'flex' : 'none';
  if (period !== 'custom') renderAnalytics();
}

function applyCustomRange() {
  var f = document.getElementById('analytics-from');
  var t = document.getElementById('analytics-to');
  if (!f || !t || !f.value || !t.value) { alert('Selecciona ambas fechas.'); return; }
  analyticsCustomFrom = f.value;
  analyticsCustomTo = t.value;
  renderAnalytics();
}

function getAnalyticsRange() {
  var now = new Date();
  switch (analyticsCurrentPeriod) {
    case 'hoy':
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()), to: new Date() };
    case 'semana': {
      var dow = now.getDay();
      var daysBack = dow === 0 ? 6 : dow - 1;
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysBack), to: new Date() };
    }
    case 'mes':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date() };
    case 'anio':
      return { from: new Date(now.getFullYear(), 0, 1), to: new Date() };
    case 'custom': {
      var cf = analyticsCustomFrom ? new Date(analyticsCustomFrom + 'T00:00:00') : new Date(now.getFullYear(), now.getMonth(), 1);
      var ct = analyticsCustomTo ? new Date(analyticsCustomTo + 'T23:59:59') : new Date();
      return { from: cf, to: ct };
    }
    default:
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate()), to: new Date() };
  }
}

function getGranularity(period, range) {
  if (period === 'hoy') return 'hour';
  if (period === 'semana' || period === 'mes') return 'day';
  if (period === 'anio') return 'month';
  var days = (range.to - range.from) / 86400000;
  if (days <= 2) return 'hour';
  if (days <= 90) return 'day';
  return 'month';
}

function getBucketKey(date, gran) {
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var d = String(date.getDate()).padStart(2, '0');
  var h = String(date.getHours()).padStart(2, '0');
  if (gran === 'hour') return y + '-' + m + '-' + d + 'T' + h;
  if (gran === 'day')  return y + '-' + m + '-' + d;
  return y + '-' + m;
}

function buildBuckets(range, gran) {
  var labels = [], keys = [];
  var now = new Date();
  var MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  var DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

  if (gran === 'hour') {
    var baseDay = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate());
    var maxH = (now.toDateString() === baseDay.toDateString()) ? now.getHours() : 23;
    for (var h = 0; h <= maxH; h++) {
      labels.push(h + ':00');
      keys.push(getBucketKey(new Date(baseDay.getTime() + h * 3600000), 'hour'));
    }
  } else if (gran === 'day') {
    var cur = new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate());
    var end = new Date(Math.min(range.to.getTime(), now.getTime()));
    while (cur <= end) {
      labels.push(analyticsCurrentPeriod === 'semana'
        ? DAYS[cur.getDay()] + ' ' + cur.getDate()
        : cur.getDate() + '/' + (cur.getMonth() + 1));
      keys.push(getBucketKey(cur, 'day'));
      cur = new Date(cur.getTime() + 86400000);
    }
  } else {
    var startM = range.from.getMonth();
    var endM = Math.min(range.to.getMonth(), now.getMonth());
    var yr = range.from.getFullYear();
    for (var mo = startM; mo <= endM; mo++) {
      labels.push(MONTHS[mo]);
      keys.push(yr + '-' + String(mo + 1).padStart(2, '0'));
    }
  }
  return { labels: labels, keys: keys };
}

// ---- Data fetch & processing ----

function getPrevRange(range) {
  var duration = range.to - range.from;
  return { from: new Date(range.from - duration), to: new Date(range.from) };
}

async function loadAnalyticsData() {
  var range = getAnalyticsRange();
  var prev  = getPrevRange(range);

  var [curRes, prevRes, flavorsRes] = await Promise.all([
    supabaseClient.from('orders').select('*')
      .gte('created_at', range.from.toISOString())
      .lte('created_at', range.to.toISOString())
      .order('created_at'),
    supabaseClient.from('orders').select('total,status,created_at,items')
      .gte('created_at', prev.from.toISOString())
      .lt('created_at',  prev.to.toISOString()),
    supabaseClient.from('flavors').select('name, production_cost')
  ]);

  if (curRes.error) throw curRes.error;

  // Build a lookup map: flavorName -> productionCost
  var flavorCostMap = {};
  (flavorsRes.data || []).forEach(function (f) {
    flavorCostMap[f.name] = parseFloat(f.production_cost) || 0;
  });

  return { orders: curRes.data || [], prevOrders: prevRes.data || [], range: range, flavorCostMap: flavorCostMap };
}

function processAnalyticsData(orders, prevOrders, range, flavorCostMap) {
  flavorCostMap = flavorCostMap || {};
  var processed = orders.filter(function (o) { return o.status === 'processed'; });
  var cancelled = orders.filter(function (o) { return o.status === 'cancelled'; });
  var expired   = orders.filter(function (o) { return o.status === 'expired'; });
  var revenue  = processed.reduce(function (s, o) { return s + parseFloat(o.total || 0); }, 0);
  var avgOrder = processed.length > 0 ? revenue / processed.length : 0;

  // ---- Previous period ----
  var prevProcessed = prevOrders.filter(function (o) { return o.status === 'processed'; });
  var prevRevenue   = prevProcessed.reduce(function (s, o) { return s + parseFloat(o.total || 0); }, 0);
  var prevTotal     = prevOrders.length;
  var prevCompletion= prevTotal > 0 ? (prevProcessed.length / prevTotal) * 100 : null;

  // ---- Status counts ----
  var statusCounts = {};
  orders.forEach(function (o) { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });

  // ---- Timeline buckets ----
  var gran = getGranularity(analyticsCurrentPeriod, range);
  var buckets = buildBuckets(range, gran);
  var revBucket = {}, procBucket = {}, cancBucket = {}, expBucket = {}, totalBucket = {};
  buckets.keys.forEach(function (k) { revBucket[k] = procBucket[k] = cancBucket[k] = expBucket[k] = totalBucket[k] = 0; });
  orders.forEach(function (o) {
    var k = getBucketKey(new Date(o.created_at), gran);
    if (totalBucket[k] !== undefined) {
      totalBucket[k]++;
      if (o.status === 'processed') { procBucket[k]++; revBucket[k] += parseFloat(o.total || 0); }
      if (o.status === 'cancelled') cancBucket[k]++;
      if (o.status === 'expired')   expBucket[k]++;
    }
  });

  // ---- Hourly distribution (all orders, hour of day 0-23) ----
  var hourlyDist = new Array(24).fill(0);
  orders.forEach(function (o) {
    var h = new Date(o.created_at).getHours();
    hourlyDist[h]++;
  });
  var peakHour = hourlyDist.indexOf(Math.max.apply(null, hourlyDist));

  // ---- Top flavors + revenue % ----
  var flavorQty = {}, flavorRev = {};
  processed.forEach(function (o) {
    (o.items || []).forEach(function (item) {
      var n = item.name || '?';
      var qty = parseInt(item.quantity, 10) || 0;
      var rev = parseFloat(item.price || 0) * qty;
      flavorQty[n] = (flavorQty[n] || 0) + qty;
      flavorRev[n] = (flavorRev[n] || 0) + rev;
    });
  });
  var topFlavors = Object.keys(flavorQty)
    .map(function (n) { return { name: n, qty: flavorQty[n], rev: flavorRev[n] || 0 }; })
    .sort(function (a, b) { return b.qty - a.qty; })
    .slice(0, 8);
  var topFlavor = topFlavors[0] || null;
  var topFlavorRevPct = (topFlavor && revenue > 0)
    ? Math.round((topFlavor.rev / revenue) * 100) : 0;

  // ---- Production cost & profitability per flavor ----
  var flavorCost = {};
  processed.forEach(function (o) {
    (o.items || []).forEach(function (item) {
      var n = item.name || '?';
      var qty = parseInt(item.quantity, 10) || 0;
      var costPerUnit = flavorCostMap[n] || 0;
      flavorCost[n] = (flavorCost[n] || 0) + costPerUnit * qty;
    });
  });

  var totalProductionCosts = Object.keys(flavorCost).reduce(function (s, n) { return s + flavorCost[n]; }, 0);
  var netIncome = revenue - totalProductionCosts;
  var avgMargin = revenue > 0 ? (netIncome / revenue) * 100 : null;

  // Per-flavor profitability array (all flavors with sales)
  var flavorProfitability = Object.keys(flavorQty).map(function (n) {
    var rev = flavorRev[n] || 0;
    var cost = flavorCost[n] || 0;
    var profit = rev - cost;
    return { name: n, qty: flavorQty[n], rev: rev, cost: cost, profit: profit };
  });

  // Top flavors sorted by net profit descending (up to 8)
  var topProfitFlavors = flavorProfitability.slice()
    .sort(function (a, b) { return b.profit - a.profit; })
    .slice(0, 8);

  // ---- Projection ----
  var projection = null;
  if (analyticsCurrentPeriod === 'mes' || analyticsCurrentPeriod === 'anio') {
    var now = new Date();
    var daysPassed = Math.max(1, (now - range.from) / 86400000);
    var totalDays = analyticsCurrentPeriod === 'mes'
      ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      : 365;
    projection = (revenue / daysPassed) * totalDays;
  }

  // ---- Peak label ----
  var peakBucketLabel = null, peakBucketCount = 0;
  buckets.keys.forEach(function (k, i) {
    if (totalBucket[k] > peakBucketCount) { peakBucketCount = totalBucket[k]; peakBucketLabel = buckets.labels[i]; }
  });

  return {
    revenue: revenue, avgOrder: avgOrder, prevRevenue: prevRevenue,
    totalOrders: orders.length, prevTotal: prevTotal,
    processedCount: processed.length, cancelledCount: cancelled.length, expiredCount: expired.length,
    prevCompletion: prevCompletion,
    statusCounts: statusCounts,
    buckets: buckets, gran: gran,
    revBucket: revBucket, procBucket: procBucket, cancBucket: cancBucket, expBucket: expBucket, totalBucket: totalBucket,
    hourlyDist: hourlyDist, peakHour: peakHour,
    topFlavors: topFlavors, topFlavor: topFlavor, topFlavorRevPct: topFlavorRevPct,
    projection: projection,
    peakBucketLabel: peakBucketLabel, peakBucketCount: peakBucketCount,
    totalProductionCosts: totalProductionCosts, netIncome: netIncome, avgMargin: avgMargin,
    flavorProfitability: flavorProfitability, topProfitFlavors: topProfitFlavors
  };
}

// ---- Render orchestrator ----

async function renderAnalytics() {
  if (analyticsIsLoading) return;
  analyticsIsLoading = true;

  var loadingEl = document.getElementById('analytics-loading');
  var contentEl = document.getElementById('analytics-content');
  if (loadingEl) { loadingEl.style.display = 'block'; }
  if (contentEl) { contentEl.style.display = 'none'; }

  try {
    var res = await loadAnalyticsData();
    var data = processAnalyticsData(res.orders, res.prevOrders, res.range, res.flavorCostMap);

    renderAnalyticsKPIs(data);
    renderAnalyticsInsights(data);
    renderChartRevenue(data);
    renderChartHourlyRhythm(data);
    renderChartTopFlavors(data);
    renderChartOrdersTimeline(data);
    renderChartFlavorProfit(data);
    renderChartTopProfitFlavors(data);
    loadBehaviorData();

    var updEl = document.getElementById('analytics-last-updated');
    if (updEl) updEl.textContent = new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });

    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';
  } catch (err) {
    if (loadingEl) loadingEl.innerHTML = '<p style="color:#E53E3E;font-weight:700">Error: ' + err.message + '</p>';
  } finally {
    analyticsIsLoading = false;
  }
}

// ---- COMPORTAMIENTO DE VISITANTES ----

async function loadBehaviorData() {
  var loadEl = document.getElementById('behavior-loading');
  var contEl = document.getElementById('behavior-content');
  if (loadEl) loadEl.style.display = 'block';
  if (contEl) contEl.style.display = 'none';

  try {
    var since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    var result = await supabaseClient
      .from('page_events')
      .select('session_id,event,props,device')
      .gte('created_at', since);
    if (result.error) throw result.error;
    renderBehavior(result.data || []);
  } catch (e) {
    if (loadEl) loadEl.textContent = 'Sin datos de comportamiento aún.';
  }
}

function renderBehavior(events) {
  var visits      = events.filter(function (e) { return e.event === 'pageview'; }).length;
  var sessions    = new Set(events.map(function (e) { return e.session_id; })).size;
  var addCarts    = events.filter(function (e) { return e.event === 'add_to_cart'; }).length;
  var cartOpens   = events.filter(function (e) { return e.event === 'cart_open'; }).length;
  var waOrders    = events.filter(function (e) { return e.event === 'whatsapp_order'; }).length;

  var leaves = events.filter(function (e) { return e.event === 'page_leave' && e.props && e.props.seconds_on_page; });
  var avgSec = leaves.length > 0
    ? leaves.reduce(function (a, e) { return a + (e.props.seconds_on_page || 0); }, 0) / leaves.length
    : 0;
  var avgTime = avgSec >= 60
    ? (avgSec / 60).toFixed(1) + ' min'
    : Math.round(avgSec) + ' seg';

  function setBkpi(id, val) {
    var el = document.getElementById('bkpi-' + id);
    if (el) el.textContent = val;
  }
  setBkpi('visits',      visits);
  setBkpi('sessions',    sessions);
  setBkpi('add-to-cart', addCarts);
  setBkpi('cart-opens',  cartOpens);
  setBkpi('orders',      waOrders);
  setBkpi('avg-time',    avgTime);

  function topList(items, labelKey, countKey) {
    return items.sort(function (a, b) { return b[countKey] - a[countKey]; }).slice(0, 5);
  }
  function countBy(arr, fn) {
    var map = {};
    arr.forEach(function (e) {
      var k = fn(e);
      if (k) map[k] = (map[k] || 0) + 1;
    });
    return Object.keys(map).map(function (k) { return { label: k, count: map[k] }; });
  }

  function renderList(elId, items) {
    var ul = document.getElementById(elId);
    if (!ul) return;
    if (!items.length) { ul.innerHTML = '<li style="color:#A0AEC0;font-size:0.8rem">Sin datos aún</li>'; return; }
    ul.innerHTML = items.map(function (it) {
      return '<li>' + safeText(it.label) + ' <span>' + it.count + '</span></li>';
    }).join('');
  }

  var searches = countBy(
    events.filter(function (e) { return e.event === 'search' && e.props && e.props.query; }),
    function (e) { return e.props.query; }
  );
  var flavors = countBy(
    events.filter(function (e) { return e.event === 'add_to_cart' && e.props && e.props.name; }),
    function (e) { return e.props.name; }
  );
  var devices = countBy(
    events.filter(function (e) { return e.device; }),
    function (e) { return e.device; }
  );

  renderList('behavior-searches', topList(searches, 'label', 'count'));
  renderList('behavior-flavors',  topList(flavors,  'label', 'count'));
  renderList('behavior-devices',  topList(devices,  'label', 'count'));

  var loadEl = document.getElementById('behavior-loading');
  var contEl = document.getElementById('behavior-content');
  if (loadEl) loadEl.style.display = 'none';
  if (contEl) contEl.style.display = 'block';
}

// ---- KPIs ----

function trendBadge(current, prev) {
  if (prev === null || prev === undefined) return '';
  if (prev === 0) return current > 0 ? '<span class="trend-up">↑ Nuevo</span>' : '';
  var pct = Math.round(((current - prev) / prev) * 100);
  if (pct > 0)  return '<span class="trend-up">↑ ' + pct + '%</span>';
  if (pct < 0)  return '<span class="trend-down">↓ ' + Math.abs(pct) + '%</span>';
  return '<span class="trend-neutral">= Sin cambio</span>';
}

function setKpi(id, value, badge) {
  var valEl = document.getElementById(id);
  if (valEl) valEl.textContent = value;
  var badgeEl = document.getElementById(id + '-trend');
  if (badgeEl) badgeEl.innerHTML = badge || '';
}

function renderAnalyticsKPIs(data) {
  var completion = data.totalOrders > 0 ? Math.round((data.processedCount / data.totalOrders) * 100) : 0;
  var prevCompletion = data.prevCompletion !== null ? data.prevCompletion : null;

  setKpi('kpi-revenue',    formatMoney(data.revenue),   trendBadge(data.revenue, data.prevRevenue));
  setKpi('kpi-orders',     data.totalOrders,             trendBadge(data.totalOrders, data.prevTotal));
  setKpi('kpi-completion', completion + '%',             trendBadge(completion, prevCompletion));
  setKpi('kpi-avg-order',  data.processedCount > 0 ? formatMoney(data.avgOrder) : '—', '');
  setKpi('kpi-top-flavor', data.topFlavor
    ? data.topFlavor.name + (data.topFlavorRevPct ? ' · ' + data.topFlavorRevPct + '%' : '')
    : '—', '');
  setKpi('kpi-projection', data.projection ? formatMoney(data.projection) : '—', '');

  var compEl = document.getElementById('kpi-completion');
  if (compEl) compEl.style.color = completion >= 70 ? '#276749' : completion >= 40 ? '#D97706' : '#E53E3E';

  // Net income KPI
  var netIncomeEl = document.getElementById('kpi-net-income');
  if (netIncomeEl) {
    netIncomeEl.textContent = data.processedCount > 0 ? formatMoney(data.netIncome) : '—';
    netIncomeEl.style.color = data.netIncome >= 0 ? '#16a34a' : '#dc2626';
  }
  var netIncomeCard = document.getElementById('kpi-net-income-card');
  if (netIncomeCard) {
    netIncomeCard.style.borderLeftColor = data.netIncome >= 0 ? '#16a34a' : '#dc2626';
  }

  // Average margin KPI
  var marginEl = document.getElementById('kpi-avg-margin');
  if (marginEl) {
    if (data.avgMargin !== null && data.processedCount > 0) {
      marginEl.textContent = Math.round(data.avgMargin) + '%';
      marginEl.style.color = '#7c3aed';
    } else {
      marginEl.textContent = '—';
      marginEl.style.color = '';
    }
  }
}

// ---- Insights ----

function renderAnalyticsInsights(data) {
  var el = document.getElementById('analytics-insights');
  if (!el) return;
  el.innerHTML = generateInsights(data).map(function (t) {
    return '<p class="insight-line">' + t + '</p>';
  }).join('');
}

function generateInsights(data) {
  var lines = [];
  var completion = data.totalOrders > 0 ? Math.round((data.processedCount / data.totalOrders) * 100) : 0;
  var ES_HOURS = ['12am','1am','2am','3am','4am','5am','6am','7am','8am','9am','10am','11am',
                  '12pm','1pm','2pm','3pm','4pm','5pm','6pm','7pm','8pm','9pm','10pm','11pm'];

  if (data.totalOrders === 0) {
    lines.push('📭 Sin pedidos en este período. Si acabas de abrir, ¡el primero es el más especial!');
    return lines;
  }

  // Revenue headline with trend
  if (data.revenue > 0) {
    var revenueLine = '💰 Generaste <strong>' + formatMoney(data.revenue) + '</strong> con <strong>' + data.processedCount + '</strong> pedido(s) completado(s).';
    if (data.prevRevenue > 0) {
      var revDiff = Math.round(((data.revenue - data.prevRevenue) / data.prevRevenue) * 100);
      revenueLine += revDiff > 0
        ? ' <span class="insight-tag tag-up">↑ ' + revDiff + '% vs período anterior</span>'
        : revDiff < 0
        ? ' <span class="insight-tag tag-down">↓ ' + Math.abs(revDiff) + '% vs período anterior</span>'
        : ' <span class="insight-tag tag-neutral">= igual que el período anterior</span>';
    }
    lines.push(revenueLine);
  } else {
    lines.push('📦 Hay <strong>' + data.totalOrders + '</strong> pedido(s) sin procesar aún. Procésalos para registrar ingresos.');
  }

  // Projection (only for mes/anio)
  if (data.projection && data.projection > data.revenue) {
    var periodName = analyticsCurrentPeriod === 'mes' ? 'este mes' : 'este año';
    lines.push('📈 Al ritmo actual, terminarás <strong>' + periodName + '</strong> con aproximadamente <strong>' + formatMoney(data.projection) + '</strong>.');
  }

  // Top flavor with revenue %
  if (data.topFlavor) {
    var flavorLine = '🏆 <strong>' + data.topFlavor.name + '</strong> fue tu sabor estrella: <strong>' + data.topFlavor.qty + '</strong> unidad(es)';
    if (data.topFlavorRevPct > 0) flavorLine += ', el <strong>' + data.topFlavorRevPct + '%</strong> de tus ingresos';
    lines.push(flavorLine + '.');
  }

  // Peak hour (actionable for a bolis seller)
  var peakOrders = data.hourlyDist[data.peakHour];
  if (peakOrders > 0) {
    lines.push('⏰ Tu hora pico es las <strong>' + ES_HOURS[data.peakHour] + '</strong>. Ten el producto listo y WhatsApp activo en ese momento.');
  }

  // Completion + pending alert
  var pending = (data.statusCounts['pending'] || 0) + (data.statusCounts['confirmed'] || 0);
  if (pending > 0) {
    lines.push('🔔 Tienes <strong>' + pending + '</strong> pedido(s) pendiente(s) — ve a la pestaña Órdenes para procesarlos.');
  } else if (completion === 100) {
    lines.push('✨ ¡Todo al día! El 100% de los pedidos fue procesado.');
  } else if (data.cancelledCount > 0) {
    lines.push('⚠️ <strong>' + data.cancelledCount + '</strong> pedido(s) cancelado(s). Tasa de completación: <strong>' + completion + '%</strong>.');
  }

  // Expired orders alert
  if (data.expiredCount > 0) {
    lines.push('⏰ <strong>' + data.expiredCount + '</strong> pedido(s) se vencieron sin ser atendidos — el cliente esperó más de un día sin respuesta. Intenta contestar más rápido la próxima vez.');
  }

  return lines;
}

// ---- Charts ----

var C = {
  coral: '#FF6B6B', coralBg: 'rgba(255,107,107,0.18)',
  lima:  '#6BCB77', limaBg:  'rgba(107,203,119,0.75)',
  mango: '#FFD93D',
  blue:  '#4D96FF', blueBg:  'rgba(77,150,255,0.15)',
  purple:'#845EC2',
  cancelBg: 'rgba(255,107,107,0.75)',
  palette: ['#FF6B6B','#4D96FF','#6BCB77','#FFD93D','#845EC2','#F97316','#14B8A6','#EC4899']
};
var FONT = "'Nunito', sans-serif";

function freshCanvas(id) {
  destroyAnalyticsChart(id);
  var old = document.getElementById(id);
  if (!old) return null;
  var wrap = old.parentNode;
  old.remove();
  var c = document.createElement('canvas');
  c.id = id;
  wrap.insertBefore(c, wrap.firstChild);
  return c;
}

function destroyAnalyticsChart(id) {
  if (analyticsCharts[id]) { analyticsCharts[id].destroy(); delete analyticsCharts[id]; }
}

function showChartEmpty(id, show) {
  var el = document.getElementById(id + '-empty');
  var canvas = document.getElementById(id);
  if (el) el.style.display = show ? 'flex' : 'none';
  if (canvas) canvas.style.display = show ? 'none' : 'block';
}

function renderChartRevenue(data) {
  var hasData = data.totalOrders > 0;
  showChartEmpty('chart-revenue', !hasData);
  if (!hasData) return;
  var ctx = freshCanvas('chart-revenue');
  if (!ctx) return;

  var labels = data.buckets.labels.slice();
  var bucketKeys = data.buckets.keys.slice();
  var revenueSeries = bucketKeys.map(function (k) { return data.revBucket[k] || 0; });
  var ordersSeries = bucketKeys.map(function (k) { return data.totalBucket[k] || 0; });
  var projectionSeries = null;

  if (data.projection && (analyticsCurrentPeriod === 'mes' || analyticsCurrentPeriod === 'anio')) {
    var now = new Date();
    var projectedBuckets = bucketKeys.length;
    if (analyticsCurrentPeriod === 'mes' && data.gran === 'day') {
      var totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      projectedBuckets = totalDays;
      for (var day = bucketKeys.length + 1; day <= totalDays; day++) {
        labels.push(day + '/' + (now.getMonth() + 1));
        revenueSeries.push(null);
        ordersSeries.push(null);
      }
    }

    if (analyticsCurrentPeriod === 'anio' && data.gran === 'month') {
      var MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      projectedBuckets = 12;
      for (var mo = now.getMonth() + 1; mo < 12; mo++) {
        labels.push(MONTHS[mo]);
        revenueSeries.push(null);
        ordersSeries.push(null);
      }
    }

    var projectedPerBucket = projectedBuckets > 0 ? data.projection / projectedBuckets : 0;
    projectionSeries = new Array(projectedBuckets).fill(projectedPerBucket);
  }

  var datasets = [
    {
      label: 'Ingresos (₡)',
      data: revenueSeries,
      borderColor: C.coral, backgroundColor: C.coralBg,
      fill: true, tension: 0.4, yAxisID: 'yRev',
      pointBackgroundColor: C.coral, pointRadius: 4, pointHoverRadius: 7
    },
    {
      label: 'Pedidos',
      data: ordersSeries,
      borderColor: C.blue, backgroundColor: 'transparent',
      borderDash: [6, 4], tension: 0.4, yAxisID: 'yOrd',
      pointBackgroundColor: C.blue, pointRadius: 4, pointHoverRadius: 7
    }
  ];

  if (projectionSeries) {
    datasets.push({
      label: 'Proyección ingresos (₡)',
      data: projectionSeries,
      borderColor: C.lima,
      backgroundColor: 'transparent',
      borderDash: [8, 6],
      tension: 0.2,
      fill: false,
      yAxisID: 'yRev',
      pointRadius: 0,
      pointHoverRadius: 5
    });
  }

  analyticsCharts['revenue'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { font: { family: FONT, weight: '700' }, color: '#4A5568' } },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              if (ctx.dataset.yAxisID === 'yOrd') return ' ' + ctx.parsed.y + ' pedido(s)';
              return ' ' + formatMoney(ctx.parsed.y);
            }
          }
        }
      },
      scales: {
        x: { ticks: { font: { family: FONT }, color: '#718096' }, grid: { color: 'rgba(0,0,0,0.04)' } },
        yRev: {
          type: 'linear', position: 'left',
          ticks: { font: { family: FONT }, color: C.coral, callback: function (v) { return '₡' + v.toLocaleString('es-CR'); } },
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        yOrd: {
          type: 'linear', position: 'right',
          ticks: { font: { family: FONT }, color: C.blue, stepSize: 1 },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

function renderChartHourlyRhythm(data) {
  var hasOrders = data.totalOrders > 0;
  showChartEmpty('chart-hourly-rhythm', !hasOrders);
  if (!hasOrders) return;
  var ctx = freshCanvas('chart-hourly-rhythm');
  if (!ctx) return;

  var maxVal = Math.max.apply(null, data.hourlyDist);
  var bgColors = data.hourlyDist.map(function (v, h) {
    if (v === 0) return 'rgba(203,213,224,0.4)';
    var intensity = maxVal > 0 ? 0.3 + (v / maxVal) * 0.7 : 0.3;
    return h === data.peakHour
      ? 'rgba(255,107,107,' + intensity + ')'
      : 'rgba(77,150,255,' + intensity + ')';
  });

  var HOUR_LABELS = [];
  for (var h = 0; h < 24; h++) HOUR_LABELS.push(h + ':00');

  analyticsCharts['hourlyRhythm'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: HOUR_LABELS,
      datasets: [{
        label: 'Pedidos',
        data: data.hourlyDist,
        backgroundColor: bgColors,
        borderRadius: 5,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: function (items) { return items[0].label + 'hs'; },
            label: function (ctx) {
              return ' ' + ctx.parsed.y + ' pedido(s)' + (ctx.dataIndex === data.peakHour ? ' 🔥 hora pico' : '');
            }
          }
        }
      },
      scales: {
        x: { ticks: { font: { family: FONT, size: 10 }, color: '#718096', maxRotation: 0 }, grid: { display: false } },
        y: { ticks: { font: { family: FONT }, color: '#718096', stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.04)' }, min: 0 }
      }
    }
  });
}

function renderChartTopFlavors(data) {
  showChartEmpty('chart-top-flavors', data.topFlavors.length === 0);
  if (data.topFlavors.length === 0) return;
  var ctx = freshCanvas('chart-top-flavors');
  if (!ctx) return;

  analyticsCharts['topFlavors'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.topFlavors.map(function (f) { return f.name; }),
      datasets: [{
        label: 'Unidades vendidas',
        data: data.topFlavors.map(function (f) { return f.qty; }),
        backgroundColor: data.topFlavors.map(function (_, i) { return C.palette[i % C.palette.length]; }),
        borderRadius: 8, borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              var f = data.topFlavors[ctx.dataIndex];
              var rev = f && data.revenue > 0 ? ' · ' + Math.round((f.rev / data.revenue) * 100) + '% de ingresos' : '';
              return ' ' + ctx.parsed.x + ' unidad(es)' + rev;
            }
          }
        }
      },
      scales: {
        x: { ticks: { font: { family: FONT }, color: '#718096', stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.04)' } },
        y: { ticks: { font: { family: FONT, weight: '700' }, color: '#2D3748' }, grid: { display: false } }
      }
    }
  });
}

function renderChartOrdersTimeline(data) {
  var hasData = data.totalOrders > 0;
  showChartEmpty('chart-orders-timeline', !hasData);
  if (!hasData) return;
  var ctx = freshCanvas('chart-orders-timeline');
  if (!ctx) return;

  analyticsCharts['ordersTimeline'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.buckets.labels,
      datasets: [
        {
          label: 'Procesados',
          data: data.buckets.keys.map(function (k) { return data.procBucket[k] || 0; }),
          backgroundColor: C.limaBg, borderColor: C.lima, borderWidth: 1,
          borderRadius: 4, stack: 'stack'
        },
        {
          label: 'Cancelados',
          data: data.buckets.keys.map(function (k) { return data.cancBucket[k] || 0; }),
          backgroundColor: C.cancelBg, borderColor: C.coral, borderWidth: 1,
          borderRadius: 4, stack: 'stack'
        },
        {
          label: 'Vencidos',
          data: data.buckets.keys.map(function (k) { return data.expBucket[k] || 0; }),
          backgroundColor: 'rgba(124,58,237,0.65)', borderColor: '#7C3AED', borderWidth: 1,
          borderRadius: 4, stack: 'stack'
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      interaction: { mode: 'index' },
      plugins: {
        legend: { labels: { font: { family: FONT, weight: '700' }, color: '#4A5568' } },
        tooltip: { callbacks: { label: function (ctx) { return ' ' + ctx.dataset.label + ': ' + ctx.parsed.y; } } }
      },
      scales: {
        x: { ticks: { font: { family: FONT }, color: '#718096' }, grid: { color: 'rgba(0,0,0,0.04)' }, stacked: true },
        y: { ticks: { font: { family: FONT }, color: '#718096', stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.04)' }, stacked: true, min: 0 }
      }
    }
  });
}

function renderChartFlavorProfit(data) {
  var flavors = data.flavorProfitability || [];
  showChartEmpty('chart-flavor-profit', flavors.length === 0);
  if (flavors.length === 0) return;
  var ctx = freshCanvas('chart-flavor-profit');
  if (!ctx) return;

  // Sort by revenue descending for display
  var sorted = flavors.slice().sort(function (a, b) { return b.rev - a.rev; }).slice(0, 8);

  analyticsCharts['flavorProfit'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(function (f) { return f.name; }),
      datasets: [
        {
          label: 'Ingresos (₡)',
          data: sorted.map(function (f) { return f.rev; }),
          backgroundColor: 'rgba(22,163,74,0.75)',
          borderColor: '#16a34a',
          borderWidth: 1,
          borderRadius: 4
        },
        {
          label: 'Costo de producción (₡)',
          data: sorted.map(function (f) { return f.cost; }),
          backgroundColor: 'rgba(249,115,22,0.75)',
          borderColor: '#f97316',
          borderWidth: 1,
          borderRadius: 4
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      interaction: { mode: 'index' },
      plugins: {
        legend: { labels: { font: { family: FONT, weight: '700' }, color: '#4A5568' } },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              var f = sorted[ctx.dataIndex];
              if (ctx.datasetIndex === 0) return ' Ingresos: ' + formatMoney(ctx.parsed.x);
              var profit = f ? f.profit : 0;
              return ' Costo: ' + formatMoney(ctx.parsed.x) + ' · Ganancia neta: ' + formatMoney(profit);
            }
          }
        }
      },
      scales: {
        x: { ticks: { font: { family: FONT }, color: '#718096', callback: function (v) { return '₡' + v.toLocaleString('es-CR'); } }, grid: { color: 'rgba(0,0,0,0.04)' } },
        y: { ticks: { font: { family: FONT, weight: '700' }, color: '#2D3748' }, grid: { display: false } }
      }
    }
  });
}

function renderChartTopProfitFlavors(data) {
  var flavors = data.topProfitFlavors || [];
  showChartEmpty('chart-top-profit-flavors', flavors.length === 0);
  if (flavors.length === 0) return;
  var ctx = freshCanvas('chart-top-profit-flavors');
  if (!ctx) return;

  analyticsCharts['topProfitFlavors'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: flavors.map(function (f) { return f.name; }),
      datasets: [{
        label: 'Ganancia neta (₡)',
        data: flavors.map(function (f) { return f.profit; }),
        backgroundColor: flavors.map(function (f) {
          return f.profit >= 0 ? 'rgba(22,163,74,0.75)' : 'rgba(220,38,38,0.75)';
        }),
        borderColor: flavors.map(function (f) {
          return f.profit >= 0 ? '#16a34a' : '#dc2626';
        }),
        borderWidth: 1,
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              var f = flavors[ctx.dataIndex];
              var units = f ? ' · ' + f.qty + ' unidad(es)' : '';
              return ' Ganancia neta: ' + formatMoney(ctx.parsed.x) + units;
            }
          }
        }
      },
      scales: {
        x: { ticks: { font: { family: FONT }, color: '#718096', callback: function (v) { return '₡' + v.toLocaleString('es-CR'); } }, grid: { color: 'rgba(0,0,0,0.04)' } },
        y: { ticks: { font: { family: FONT, weight: '700' }, color: '#2D3748' }, grid: { display: false } }
      }
    }
  });
}

// ---- Realtime ----

function subscribeAnalyticsRealtime() {
  if (!supabaseClient || analyticsRealtimeSub) return;
  try {
    analyticsRealtimeSub = supabaseClient
      .channel('analytics-orders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, function () {
        var tab = document.getElementById('tab-analiticas');
        if (tab && tab.classList.contains('active')) renderAnalytics();
      })
      .subscribe();
  } catch (e) { /* realtime not available */ }
}

// ---- CATEGORIAS ----

async function loadCategories() {
  if (!supabaseClient) {
    allCategories = DEFAULT_CATEGORIES;
    populateCategorySelects();
    renderCategoriesTable();
    return;
  }
  try {
    var result = await supabaseClient.from('categories').select('*').order('sort_order').order('name');
    if (result.error) throw result.error;
    allCategories = (result.data && result.data.length > 0) ? result.data : DEFAULT_CATEGORIES;
  } catch (e) {
    allCategories = DEFAULT_CATEGORIES;
  }
  populateCategorySelects();
  renderCategoriesTable();
}

function populateCategorySelects() {
  var selects = [
    { el: document.getElementById('f-category'),       prefix: '' },
    { el: document.getElementById('admin-cat-filter'), prefix: '<option value="">Todas las categorías</option>' }
  ];
  selects.forEach(function (s) {
    if (!s.el) return;
    var current = s.el.value;
    s.el.innerHTML = s.prefix;
    for (var i = 0; i < allCategories.length; i++) {
      var c = allCategories[i];
      s.el.innerHTML += '<option value="' + safeAttr(c.id || c.slug) + '">' + (c.emoji ? c.emoji + ' ' : '') + safeText(c.name) + '</option>';
    }
    if (current) s.el.value = current;
  });
}

function renderCategoriesTable() {
  var tbody = document.getElementById('categories-tbody');
  if (!tbody) return;
  if (allCategories.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:2rem;color:#718096">No hay categorías. ¡Agrega la primera!</td></tr>';
    return;
  }
  var html = '';
  for (var i = 0; i < allCategories.length; i++) {
    var c = allCategories[i];
    html += '<tr>' +
      '<td style="font-size:1.5rem;text-align:center">' + safeText(c.emoji || '—') + '</td>' +
      '<td><strong>' + safeText(c.name) + '</strong></td>' +
      '<td><code style="background:#F7FAFC;padding:0.2rem 0.5rem;border-radius:4px;font-size:0.85rem">' + safeText(c.slug) + '</code></td>' +
      '<td>' +
        (c.id
          ? '<button class="action-btn" onclick="openEditCategoryModal(\'' + safeAttr(c.id) + '\')" title="Editar">✏️</button> ' +
            '<button class="action-btn" onclick="confirmDeleteCategory(\'' + safeAttr(c.id) + '\', \'' + safeAttr(c.name) + '\', \'' + safeAttr(c.slug) + '\')" title="Eliminar">🗑️</button>'
          : '<span style="font-size:0.8rem;color:#A0AEC0">Crea la tabla categories primero</span>') +
      '</td>' +
    '</tr>';
  }
  tbody.innerHTML = html;
}

function openAddCategoryModal() {
  currentEditCategoryId = null;
  document.getElementById('cat-modal-title').textContent = 'Nueva Categoría';
  document.getElementById('cat-form').reset();
  document.getElementById('cat-sort-order').value = allCategories.length + 1;
  document.getElementById('cat-form-error').textContent = '';
  document.getElementById('cat-save-btn').disabled = false;
  document.getElementById('cat-save-btn').textContent = 'Guardar';
  openCategoryModalEl();
}

function openEditCategoryModal(catId) {
  var cat = null;
  for (var i = 0; i < allCategories.length; i++) {
    if (allCategories[i].id === catId) { cat = allCategories[i]; break; }
  }
  if (!cat) return;
  currentEditCategoryId = catId;
  document.getElementById('cat-modal-title').textContent = 'Editar Categoría';
  document.getElementById('cat-name').value = cat.name || '';
  document.getElementById('cat-slug').value = cat.slug || '';
  document.getElementById('cat-emoji').value = cat.emoji || '';
  document.getElementById('cat-sort-order').value = cat.sort_order || 0;
  document.getElementById('cat-form-error').textContent = '';
  document.getElementById('cat-save-btn').disabled = false;
  document.getElementById('cat-save-btn').textContent = 'Guardar';
  openCategoryModalEl();
}

function openCategoryModalEl() {
  var overlay = document.getElementById('cat-modal-overlay');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCategoryModal() {
  var overlay = document.getElementById('cat-modal-overlay');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
  currentEditCategoryId = null;
}

async function saveCategory() {
  var name = document.getElementById('cat-name').value.trim();
  var slug = document.getElementById('cat-slug').value.trim()
    .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  var emoji = document.getElementById('cat-emoji').value.trim();
  var sortOrder = parseInt(document.getElementById('cat-sort-order').value, 10) || 0;
  var errorEl = document.getElementById('cat-form-error');
  var saveBtn = document.getElementById('cat-save-btn');

  errorEl.textContent = '';
  if (!name) { errorEl.textContent = 'El nombre es requerido.'; return; }
  if (!slug)  { errorEl.textContent = 'El slug es requerido.'; return; }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';

  try {
    var data = { name: name, slug: slug, emoji: emoji || null, sort_order: sortOrder };
    var result = currentEditCategoryId
      ? await supabaseClient.from('categories').update(data).eq('id', currentEditCategoryId)
      : await supabaseClient.from('categories').insert([data]);
    if (result.error) throw result.error;
    closeCategoryModal();
    await loadCategories();
    showToast(currentEditCategoryId ? '✓ Categoría actualizada' : '✓ Categoría creada');
  } catch (error) {
    errorEl.textContent = 'Error: ' + error.message;
    saveBtn.disabled = false;
    saveBtn.textContent = 'Guardar';
  }
}

async function confirmDeleteCategory(id, name, slug) {
  try {
    var check = await supabaseClient.from('flavors').select('id', { count: 'exact' }).eq('category_id', id);
    if ((check.count || 0) > 0) {
      alert('No se puede eliminar "' + name + '" porque ' + check.count + ' sabor(es) la usan.\nCambia su categoría primero.');
      return;
    }
  } catch (e) { /* ignorar error del check */ }
  if (!confirm('¿Eliminar la categoría "' + name + '"?\nEsta acción no se puede deshacer.')) return;
  try {
    var result = await supabaseClient.from('categories').delete().eq('id', id);
    if (result.error) throw result.error;
    await loadCategories();
    showToast('Categoría eliminada');
  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// ---- UTILS ----

function showToast(msg, type) {
  var old = document.querySelector('.success-toast');
  if (old) old.remove();
  var toast = document.createElement('div');
  toast.className = 'success-toast' + (type === 'error' ? ' success-toast--error' : '');
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(function () { if (toast.parentNode) toast.remove(); }, 3000);
}

function safeText(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function safeAttr(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---- INIT ----

document.addEventListener('DOMContentLoaded', function () {
  initAuth();
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeModal();
      closeManualOrderModal();
      closeCategoryModal();
    }
  });
  var pwd = document.getElementById('login-password');
  if (pwd) pwd.addEventListener('keydown', function (e) { if (e.key === 'Enter') login(); });
  var overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.addEventListener('click', function (e) { if (e.target === this) closeModal(); });
  var manualOverlay = document.getElementById('manual-order-overlay');
  if (manualOverlay) manualOverlay.addEventListener('click', function (e) { if (e.target === this) closeManualOrderModal(); });
  var catOverlay = document.getElementById('cat-modal-overlay');
  if (catOverlay) catOverlay.addEventListener('click', function (e) { if (e.target === this) closeCategoryModal(); });

  // Buscar orden con Enter
  var searchInput = document.getElementById('order-search-input');
  if (searchInput) searchInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') searchOrderByNumber(); });
});
