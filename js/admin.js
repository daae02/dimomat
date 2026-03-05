// ================================================
// PANEL DE ADMINISTRACION - Bolis Gourmet
// ================================================
// Requiere: supabase-client.js cargado antes

var currentEditId = null;

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
}

// ---- TABS ----

function switchTab(tabName, btn) {
  document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
  document.querySelectorAll('.admin-tab').forEach(function (t) { t.classList.remove('active'); });
  document.getElementById('tab-' + tabName).classList.add('active');
  btn.classList.add('active');
  if (tabName === 'ordenes') loadOrders();
}

// ---- CRUD SABORES ----

async function loadAdminFlavors() {
  var tbody = document.getElementById('flavors-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#718096">Cargando inventario...</td></tr>';
  try {
    var result = await supabaseClient.from('flavors').select('*').order('created_at', { ascending: false });
    if (result.error) throw result.error;
    renderAdminTable(result.data || []);
    renderStatsCards(result.data || []);
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#E53E3E">Error: ' + error.message + '</td></tr>';
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

var CAT_LABELS = { frutal: 'Frutal', cremoso: 'Cremoso', picante: 'Picante', especial: 'Especial', clasico: 'Clásico' };

function renderAdminTable(flavors) {
  var tbody = document.getElementById('flavors-tbody');
  if (!tbody) return;
  if (flavors.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:#718096">No hay sabores registrados. ¡Agrega el primero!</td></tr>';
    return;
  }
  var html = '';
  for (var i = 0; i < flavors.length; i++) {
    var f = flavors[i];
    var imgHtml = f.image_url
      ? '<img src="' + safeAttr(f.image_url) + '" class="table-img" alt="' + safeAttr(f.name) + '" onerror="this.style.display=\'none\'">'
      : '<div class="table-img" style="font-size:1.5rem;text-align:center;line-height:48px">🧊</div>';
    var stockStyle = f.stock === 0 ? 'color:#E53E3E;font-weight:800' : f.stock <= 5 ? 'color:#D97706;font-weight:700' : 'color:#276749';
    // Usar data-flavor-id para abrir el modal — evita embeber JSON crudo en onclick
    var safeRowId = safeAttr(f.id);
    html += '<tr>' +
      '<td>' + imgHtml + '</td>' +
      '<td><strong>' + safeText(f.name) + '</strong></td>' +
      '<td><span class="category-badge cat-' + (f.category || 'clasico') + '">' + (CAT_LABELS[f.category] || f.category) + '</span></td>' +
      '<td>$' + parseFloat(f.price).toFixed(2) + '</td>' +
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
  var imageFile = document.getElementById('f-image').files[0];
  var currentImageUrl = document.getElementById('f-current-image').value;
  var errorEl = document.getElementById('form-error');
  var saveBtn = document.getElementById('save-btn');

  errorEl.textContent = '';
  if (!name) { errorEl.textContent = 'El nombre es requerido.'; return; }
  if (isNaN(price) || price <= 0) { errorEl.textContent = 'El precio debe ser mayor a 0.'; return; }
  if (isNaN(stock) || stock < 0) { errorEl.textContent = 'El stock no puede ser negativo.'; return; }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';

  try {
    var imageUrl = currentImageUrl;
    if (imageFile) imageUrl = await uploadImage(imageFile);

    var data = { name: name, description: desc, price: price, stock: stock, category: category, is_available: isAvailable, image_url: imageUrl || null };
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
    var result = await supabaseClient.from('flavors').select('*').eq('id', flavorId).single();
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
  document.getElementById('f-category').value = flavor.category || 'clasico';
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

    if (orders.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:2rem;color:#718096">' +
        '<div style="font-size:2.5rem">🛒</div>' +
        '<p style="font-weight:700">No hay pedidos todavía</p>' +
        '<p style="font-size:0.9rem">Los pedidos aparecerán aquí cuando los clientes hagan una orden por WhatsApp</p>' +
        '</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < orders.length; i++) {
      var o = orders[i];
      var statusClass = 'status-' + (o.status || 'pending');
      var statusLabel = { pending: 'Pendiente', confirmed: 'Confirmado', processed: 'Procesado', cancelled: 'Cancelado' }[o.status] || o.status;
      var date = new Date(o.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
      var itemCount = Array.isArray(o.items) ? o.items.reduce(function (s, it) { return s + it.quantity; }, 0) : 0;

      html += '<div class="orders-list-item" onclick="openOrderEditor(\'' + o.id + '\')">' +
        '<span class="order-number-big" style="font-size:1rem">' + safeText(o.order_number) + '</span>' +
        '<div>' +
          '<div style="font-weight:700;font-size:0.9rem">' + itemCount + ' boli(s) — $' + parseFloat(o.total).toFixed(2) + '</div>' +
          '<div style="font-size:0.8rem;color:#718096">' + date + '</div>' +
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

  var statusLabel = { pending: 'Pendiente', confirmed: 'Confirmado', processed: 'Procesado', cancelled: 'Cancelado' }[order.status] || order.status;
  var statusClass = 'status-' + order.status;
  var isProcessed = order.status === 'processed' || order.status === 'cancelled';
  var date = new Date(order.created_at).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });

  var itemsHtml = '';
  var items = Array.isArray(order.items) ? order.items : [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var readonlyAttr = isProcessed ? 'readonly style="background:#f5f5f5"' : '';
    itemsHtml += '<div class="order-item-row" data-idx="' + i + '">' +
      '<div>' +
        '<div class="order-item-name">' + safeText(item.name) + '</div>' +
        '<div class="order-item-price">$' + parseFloat(item.price).toFixed(2) + ' c/u</div>' +
      '</div>' +
      '<div style="font-size:0.85rem;color:#718096">Qty:</div>' +
      '<input class="order-qty-input" type="number" min="0" value="' + item.quantity + '" ' + readonlyAttr +
        ' onchange="updateOrderItemQty(\'' + order.id + '\', ' + i + ', this.value)" data-price="' + item.price + '">' +
      '<div style="font-weight:800;color:#FF6B6B;min-width:60px;text-align:right" id="item-subtotal-' + i + '">$' + (item.price * item.quantity).toFixed(2) + '</div>' +
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
  }

  editor.innerHTML = '<div class="order-card">' +
    '<div class="order-card-header">' +
      '<div>' +
        '<span class="order-number-big">' + safeText(order.order_number) + '</span>' +
        '<span style="font-size:0.85rem;color:#718096;margin-left:0.75rem">' + date + '</span>' +
      '</div>' +
      '<span class="order-status-badge ' + statusClass + '">' + statusLabel + '</span>' +
    '</div>' +
    '<div class="order-items-editor">' +
      '<p style="font-weight:700;color:#718096;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 0.75rem">Items del pedido ' + (isProcessed ? '' : '— puedes editar cantidades') + '</p>' +
      itemsHtml +
      '<div style="display:flex;justify-content:flex-end;margin-top:1rem;padding-top:0.75rem;border-top:2px solid #f0f0f0">' +
        '<div style="text-align:right">' +
          '<div style="font-size:0.85rem;color:#718096">Total del pedido</div>' +
          '<div style="font-size:1.4rem;font-weight:900;color:#FF6B6B" id="order-total-display-' + order.id + '">$' + parseFloat(order.total).toFixed(2) + '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    actionButtons +
  '</div>';

  // Guardar referencia a los items editables
  editor.dataset.orderId = order.id;
  editor.dataset.orderItems = JSON.stringify(items);
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
    if (subtotalEl) subtotalEl.textContent = '$' + (items[idx].price * items[idx].quantity).toFixed(2);

    // Recalcular total
    var total = items.reduce(function (s, it) { return s + it.price * it.quantity; }, 0);
    var totalEl = document.getElementById('order-total-display-' + orderId);
    if (totalEl) totalEl.textContent = '$' + total.toFixed(2);
  }
}

// Procesa la orden via Edge Function: descuenta inventario
async function processOrder(orderId) {
  var editor = document.getElementById('order-editor');
  var items = JSON.parse(editor.dataset.orderItems || '[]');
  var adminNotes = document.getElementById('order-admin-notes-' + orderId);
  var notes = adminNotes ? adminNotes.value.trim() : '';

  // Filtrar items con cantidad > 0
  var validItems = items.filter(function (it) { return it.quantity > 0; });
  if (validItems.length === 0) {
    alert('No hay items con cantidad mayor a 0.');
    return;
  }

  if (!confirm('¿Confirmar pedido y descontar inventario?\n\nEsta acción actualizará el stock de los sabores.')) return;

  var processBtn = editor.querySelector('button[onclick*="processOrder"]');
  if (processBtn) { processBtn.disabled = true; processBtn.textContent = '⏳ Procesando...'; }

  try {
    var functionsUrl = typeof FUNCTIONS_URL !== 'undefined' ? FUNCTIONS_URL : null;
    if (!functionsUrl) throw new Error('FUNCTIONS_URL no configurado en config.js');

    var sessionResult = await supabaseClient.auth.getSession();
    var token = sessionResult.data.session ? sessionResult.data.session.access_token : null;
    if (!token) throw new Error('Sesión expirada. Por favor vuelve a iniciar sesión.');

    var anonKey = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '';

    var response = await fetch(functionsUrl + '/process-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': anonKey,
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        order_id: orderId,
        items: validItems,
        admin_notes: notes
      })
    });

    var data = await response.json();

    if (!response.ok) {
      var errMsg = data.error || 'Error al procesar';
      if (data.details) errMsg += '\n' + data.details.join('\n');
      throw new Error(errMsg);
    }

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

// ---- UTILS ----

function showToast(msg) {
  var old = document.querySelector('.success-toast');
  if (old) old.remove();
  var toast = document.createElement('div');
  toast.className = 'success-toast';
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
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
  var pwd = document.getElementById('login-password');
  if (pwd) pwd.addEventListener('keydown', function (e) { if (e.key === 'Enter') login(); });
  var overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.addEventListener('click', function (e) { if (e.target === this) closeModal(); });

  // Buscar orden con Enter
  var searchInput = document.getElementById('order-search-input');
  if (searchInput) searchInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') searchOrderByNumber(); });
});
