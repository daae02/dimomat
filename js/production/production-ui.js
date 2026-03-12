// ================================================
// PRODUCTION UI — módulo de costos de producción
// Depende de: production-db.js, production-logic.js, admin.js
// ================================================

var prodIngredients = [];
var prodBatches = [];

// Helper local: setea textContent de un elemento DOM de forma segura
function _setText(el, text) { if (el) el.textContent = text || ''; }

// ---- INIT ----

async function initProductionModule() {
  try {
    prodIngredients = await db_getIngredients();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ---- INGREDIENTES ----

async function loadAndRenderIngredients() {
  try {
    prodIngredients = await db_getIngredients();
    renderIngredientsList(prodIngredients);
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderIngredientsList(ingredients) {
  var container = document.getElementById('prod-ingredients-list');
  if (!container) return;

  if (!ingredients || ingredients.length === 0) {
    container.innerHTML = '<p style="text-align:center;padding:2rem;color:#718096;font-weight:700">No hay ingredientes registrados.</p>';
    return;
  }

  var html = '<div style="overflow-x:auto"><table class="admin-table"><thead><tr>' +
    '<th>Nombre</th><th>Unidad</th><th>Stock</th><th>Costo Prom.</th><th>Acciones</th>' +
    '</tr></thead><tbody>';

  for (var i = 0; i < ingredients.length; i++) {
    var ing = ingredients[i];
    html += '<tr>' +
      '<td style="font-weight:700">' + (ing.nombre || '') + '</td>' +
      '<td>' + (ing.unidad || '') + '</td>' +
      '<td>' + (Number(ing.qty_stock) || 0) + '</td>' +
      '<td>' + formatMoney(ing.costo_unitario_avg || 0) + '</td>' +
      '<td>' +
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap">' +
          '<button class="btn-secondary" style="padding:0.3rem 0.75rem;font-size:0.8rem" onclick="openIngredientModal(\'' + ing.id + '\')">Editar</button>' +
          '<button class="btn-secondary" style="padding:0.3rem 0.75rem;font-size:0.8rem;background:#6BCB77;color:#fff" onclick="openPurchaseModal(\'' + ing.id + '\')">Compra</button>' +
          '<button class="btn-secondary" style="padding:0.3rem 0.75rem;font-size:0.8rem;background:#4D96FF;color:#fff" onclick="openPurchaseHistoryModal(\'' + ing.id + '\')">Historial</button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }

  html += '</tbody></table></div>';
  container.innerHTML = html;
}

// ---- SUBTABS ----

function switchProdSubtab(subtab) {
  document.querySelectorAll('.prod-panel').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.prod-subtab-btn').forEach(function(b) { b.classList.remove('active'); });

  var panel = document.getElementById('prod-panel-' + subtab);
  if (panel) panel.classList.add('active');

  var btns = document.querySelectorAll('.prod-subtab-btn');
  for (var i = 0; i < btns.length; i++) {
    if (btns[i].dataset.subtab === subtab) {
      btns[i].classList.add('active');
      break;
    }
  }

  if (subtab === 'ingredientes') loadAndRenderIngredients();
  if (subtab === 'tandas') loadAndRenderBatches();
}

// ---- MODAL INGREDIENTE ----

function openIngredientModal(ingredientId) {
  var overlay = document.getElementById('modal-ingredient-overlay');
  if (!overlay) return;

  var titleEl = document.getElementById('modal-ingredient-title');
  var idInput = document.getElementById('ing-id');
  var nameInput = document.getElementById('ing-nombre');
  var unitInput = document.getElementById('ing-unidad');
  var notasInput = document.getElementById('ing-notas');

  if (ingredientId) {
    var ing = null;
    for (var i = 0; i < prodIngredients.length; i++) {
      if (String(prodIngredients[i].id) === String(ingredientId)) {
        ing = prodIngredients[i];
        break;
      }
    }
    if (titleEl) _setText(titleEl, 'Editar Ingrediente');
    if (idInput) idInput.value = ing ? ing.id : '';
    if (nameInput) nameInput.value = ing ? (ing.nombre || '') : '';
    if (unitInput) unitInput.value = ing ? (ing.unidad || '') : '';
    if (notasInput) notasInput.value = ing ? (ing.notas || '') : '';
  } else {
    if (titleEl) _setText(titleEl, 'Nuevo Ingrediente');
    if (idInput) idInput.value = '';
    if (nameInput) nameInput.value = '';
    if (unitInput) unitInput.value = '';
    if (notasInput) notasInput.value = '';
  }

  overlay.classList.add('open');
}

function closeIngredientModal() {
  var overlay = document.getElementById('modal-ingredient-overlay');
  if (overlay) overlay.classList.remove('open');
}

async function saveIngredient() {
  var idInput = document.getElementById('ing-id');
  var nameInput = document.getElementById('ing-nombre');
  var unitInput = document.getElementById('ing-unidad');
  var notasInput = document.getElementById('ing-notas');

  var payload = {
    nombre: nameInput ? nameInput.value.trim() : '',
    unidad: unitInput ? unitInput.value.trim() : '',
    notas: notasInput ? notasInput.value.trim() : ''
  };
  if (idInput && idInput.value) payload.id = idInput.value;

  if (!payload.nombre || !payload.unidad) {
    showToast('Nombre y unidad son requeridos.', 'error');
    return;
  }

  try {
    await db_saveIngredient(payload);
    showToast('Ingrediente guardado', 'success');
    closeIngredientModal();
    await loadAndRenderIngredients();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ---- MODAL COMPRA ----

function openPurchaseModal(ingredientId) {
  var overlay = document.getElementById('modal-purchase-overlay');
  if (!overlay) return;

  overlay.dataset.ingredientId = ingredientId;

  var ing = null;
  for (var i = 0; i < prodIngredients.length; i++) {
    if (String(prodIngredients[i].id) === String(ingredientId)) {
      ing = prodIngredients[i];
      break;
    }
  }

  var nameEl = document.getElementById('modal-purchase-ing-name');
  if (nameEl && ing) _setText(nameEl, ing.nombre);

  var unitLabel = document.getElementById('modal-purchase-unit-label');
  if (unitLabel && ing) _setText(unitLabel, ing.unidad || '');

  var qtyInput = document.getElementById('purchase-qty');
  var costoInput = document.getElementById('purchase-costo-unitario');
  var fechaInput = document.getElementById('purchase-fecha');
  var notasInput = document.getElementById('purchase-notas');

  if (qtyInput) qtyInput.value = '';
  if (costoInput) costoInput.value = '';
  if (fechaInput) fechaInput.value = new Date().toISOString().slice(0, 10);
  if (notasInput) notasInput.value = '';

  overlay.classList.add('open');
}

function closePurchaseModal() {
  var overlay = document.getElementById('modal-purchase-overlay');
  if (overlay) overlay.classList.remove('open');
}

async function savePurchase() {
  var overlay = document.getElementById('modal-purchase-overlay');
  var ingredientId = overlay ? overlay.dataset.ingredientId : null;

  var qtyInput = document.getElementById('purchase-qty');
  var costoInput = document.getElementById('purchase-costo-unitario');
  var fechaInput = document.getElementById('purchase-fecha');
  var notasInput = document.getElementById('purchase-notas');

  var qty = qtyInput ? parseFloat(qtyInput.value) : 0;
  var costo = costoInput ? parseFloat(costoInput.value) : 0;
  var fecha = fechaInput ? fechaInput.value : '';
  var notas = notasInput ? notasInput.value.trim() : '';

  if (!ingredientId) { showToast('Ingrediente no identificado.', 'error'); return; }
  if (!qty || qty <= 0) { showToast('La cantidad debe ser mayor a 0.', 'error'); return; }
  if (!costo || costo <= 0) { showToast('El costo unitario debe ser mayor a 0.', 'error'); return; }
  if (!fecha) { showToast('La fecha es requerida.', 'error'); return; }

  var payload = {
    ingredient_id: ingredientId,
    qty: qty,
    costo_unitario: costo,
    fecha: fecha,
    notas: notas
  };

  try {
    await db_recordPurchase(payload);
    showToast('Compra registrada', 'success');
    closePurchaseModal();
    await loadAndRenderIngredients();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ---- MODAL HISTORIAL DE COMPRAS ----

async function openPurchaseHistoryModal(ingredientId) {
  var overlay = document.getElementById('modal-purchase-history-overlay');
  if (!overlay) return;

  var ing = null;
  for (var i = 0; i < prodIngredients.length; i++) {
    if (String(prodIngredients[i].id) === String(ingredientId)) {
      ing = prodIngredients[i];
      break;
    }
  }

  var titleEl = document.getElementById('modal-purchase-history-title');
  if (titleEl && ing) _setText(titleEl, 'Historial de compras: ' + ing.nombre);

  var listEl = document.getElementById('purchase-history-list');
  if (listEl) listEl.innerHTML = '<p style="text-align:center;color:#718096;padding:1rem">Cargando...</p>';

  overlay.classList.add('open');

  try {
    var purchases = await db_getPurchasesByIngredient(ingredientId);
    if (!listEl) return;

    if (!purchases || purchases.length === 0) {
      listEl.innerHTML = '<p style="text-align:center;color:#718096;padding:1rem;font-weight:700">Sin compras registradas.</p>';
      return;
    }

    var html = '<table class="admin-table"><thead><tr>' +
      '<th>Fecha</th><th>Cantidad</th><th>Costo Unit.</th><th>Total</th><th>Notas</th>' +
      '</tr></thead><tbody>';

    for (var j = 0; j < purchases.length; j++) {
      var p = purchases[j];
      var total = (Number(p.qty) || 0) * (Number(p.costo_unitario) || 0);
      html += '<tr>' +
        '<td>' + (p.fecha || '') + '</td>' +
        '<td>' + (p.qty || 0) + ' ' + (ing ? ing.unidad : '') + '</td>' +
        '<td>' + formatMoney(p.costo_unitario) + '</td>' +
        '<td>' + formatMoney(total) + '</td>' +
        '<td style="color:#718096;font-size:0.85rem">' + (p.notas || '—') + '</td>' +
      '</tr>';
    }

    html += '</tbody></table>';
    listEl.innerHTML = html;
  } catch (error) {
    showToast(error.message, 'error');
    if (listEl) listEl.innerHTML = '<p style="text-align:center;color:#E53E3E;padding:1rem">' + error.message + '</p>';
  }
}

function closePurchaseHistoryModal() {
  var overlay = document.getElementById('modal-purchase-history-overlay');
  if (overlay) overlay.classList.remove('open');
}

// ---- MODAL NUEVA TANDA ----

function openNewBatchModal() {
  var overlay = document.getElementById('modal-batch-overlay');
  if (!overlay) return;

  // Reset form
  var fechaInput = document.getElementById('batch-fecha');
  var notasInput = document.getElementById('batch-notas');
  var generalContainer = document.getElementById('batch-general-ingredients');
  var flavorsContainer = document.getElementById('batch-flavors-container');
  var previewEl = document.getElementById('batch-cost-preview');

  if (fechaInput) fechaInput.value = new Date().toISOString().slice(0, 10);
  if (notasInput) notasInput.value = '';
  if (generalContainer) generalContainer.innerHTML = '';
  if (flavorsContainer) flavorsContainer.innerHTML = '';
  if (previewEl) previewEl.innerHTML = '<p style="color:#718096;font-size:0.85rem">Agrega sabores y cantidades para ver el costo estimado.</p>';

  // Populate flavor select
  var flavorSelect = document.getElementById('batch-flavor-select');
  if (flavorSelect) {
    flavorSelect.innerHTML = '<option value="">-- Seleccionar sabor --</option>';
    for (var i = 0; i < allAdminFlavors.length; i++) {
      var f = allAdminFlavors[i];
      var opt = document.createElement('option');
      opt.value = f.id;
      _setText(opt, f.name || f.nombre || '');
      flavorSelect.appendChild(opt);
    }
  }

  overlay.classList.add('open');
}

function closeNewBatchModal() {
  var overlay = document.getElementById('modal-batch-overlay');
  if (overlay) overlay.classList.remove('open');
}

// ---- FILAS DE INGREDIENTES (TANDA) ----

function _buildIngredientSelect(selectedId) {
  var select = document.createElement('select');
  select.className = 'form-input';
  select.style.fontSize = '0.85rem';
  select.style.padding = '0.35rem 0.5rem';

  var defaultOpt = document.createElement('option');
  defaultOpt.value = '';
  _setText(defaultOpt, '-- Ingrediente --');
  select.appendChild(defaultOpt);

  for (var i = 0; i < prodIngredients.length; i++) {
    var ing = prodIngredients[i];
    var opt = document.createElement('option');
    opt.value = ing.id;
    _setText(opt, (ing.nombre || '') + ' (' + (ing.unidad || '') + ')');
    if (selectedId && String(ing.id) === String(selectedId)) opt.selected = true;
    select.appendChild(opt);
  }

  select.addEventListener('change', function() {
    var row = select.closest('.ingredient-row');
    if (!row) return;
    var unitLabel = row.querySelector('.ing-unit-label');
    if (!unitLabel) return;
    var found = null;
    for (var j = 0; j < prodIngredients.length; j++) {
      if (String(prodIngredients[j].id) === String(select.value)) {
        found = prodIngredients[j];
        break;
      }
    }
    _setText(unitLabel, found ? (found.unidad || '') : '');
    updateBatchCostPreview();
  });

  return select;
}

function _buildIngredientRow(flavorId) {
  var row = document.createElement('div');
  row.className = 'ingredient-row';
  row.dataset.flavorId = flavorId !== undefined && flavorId !== null ? String(flavorId) : '';

  var select = _buildIngredientSelect(null);
  row.appendChild(select);

  var qtyInput = document.createElement('input');
  qtyInput.type = 'number';
  qtyInput.className = 'form-input';
  qtyInput.placeholder = 'Cantidad';
  qtyInput.min = '0';
  qtyInput.step = 'any';
  qtyInput.style.fontSize = '0.85rem';
  qtyInput.style.padding = '0.35rem 0.5rem';
  qtyInput.addEventListener('input', updateBatchCostPreview);
  row.appendChild(qtyInput);

  var unitLabel = document.createElement('span');
  unitLabel.className = 'ing-unit-label';
  unitLabel.style.color = '#718096';
  unitLabel.style.fontSize = '0.8rem';
  unitLabel.style.minWidth = '2.5rem';
  _setText(unitLabel, '');
  row.appendChild(unitLabel);

  var removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn-secondary';
  removeBtn.style.padding = '0.25rem 0.6rem';
  removeBtn.style.fontSize = '0.8rem';
  removeBtn.style.background = '#FED7D7';
  removeBtn.style.color = '#C53030';
  _setText(removeBtn, '✕');
  removeBtn.addEventListener('click', function() { removeIngredientRow(removeBtn); });
  row.appendChild(removeBtn);

  return row;
}

function addGeneralIngredientRow() {
  var container = document.getElementById('batch-general-ingredients');
  if (!container) return;
  container.appendChild(_buildIngredientRow(null));
}

function removeIngredientRow(btn) {
  var row = btn.closest('.ingredient-row');
  if (row) {
    row.parentNode.removeChild(row);
    updateBatchCostPreview();
  }
}

// ---- SABORES EN TANDA ----

function addFlavorToBatch() {
  var select = document.getElementById('batch-flavor-select');
  if (!select || !select.value) {
    showToast('Selecciona un sabor primero.', 'error');
    return;
  }

  var flavorId = select.value;
  var flavorName = select.options[select.selectedIndex].text;
  var container = document.getElementById('batch-flavors-container');
  if (!container) return;

  // Check if already added
  var existing = container.querySelector('[data-flavor-id="' + flavorId + '"]');
  if (existing) {
    showToast('Este sabor ya fue agregado a la tanda.', 'error');
    return;
  }

  var card = document.createElement('div');
  card.className = 'prod-flavor-card';
  card.dataset.flavorId = flavorId;

  // Header
  var header = document.createElement('div');
  header.className = 'prod-flavor-card-header';

  var nameSpan = document.createElement('span');
  nameSpan.style.fontWeight = '800';
  nameSpan.style.fontSize = '0.95rem';
  _setText(nameSpan, flavorName);
  header.appendChild(nameSpan);

  var headerRight = document.createElement('div');
  headerRight.style.display = 'flex';
  headerRight.style.alignItems = 'center';
  headerRight.style.gap = '0.75rem';

  var qtyWrap = document.createElement('div');
  qtyWrap.style.display = 'flex';
  qtyWrap.style.alignItems = 'center';
  qtyWrap.style.gap = '0.4rem';

  var qtyLabel = document.createElement('label');
  qtyLabel.style.fontWeight = '700';
  qtyLabel.style.fontSize = '0.85rem';
  qtyLabel.style.color = '#718096';
  _setText(qtyLabel, 'Qty:');
  qtyWrap.appendChild(qtyLabel);

  var qtyInput = document.createElement('input');
  qtyInput.type = 'number';
  qtyInput.className = 'form-input';
  qtyInput.dataset.role = 'qty-producida';
  qtyInput.placeholder = '0';
  qtyInput.min = '0';
  qtyInput.step = 'any';
  qtyInput.style.width = '80px';
  qtyInput.style.fontSize = '0.85rem';
  qtyInput.style.padding = '0.3rem 0.5rem';
  qtyInput.addEventListener('input', updateBatchCostPreview);
  qtyWrap.appendChild(qtyInput);

  var bolisLabel = document.createElement('span');
  bolisLabel.style.fontSize = '0.8rem';
  bolisLabel.style.color = '#718096';
  _setText(bolisLabel, 'bolis');
  qtyWrap.appendChild(bolisLabel);

  headerRight.appendChild(qtyWrap);

  var removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn-secondary';
  removeBtn.style.padding = '0.25rem 0.6rem';
  removeBtn.style.fontSize = '0.8rem';
  removeBtn.style.background = '#FED7D7';
  removeBtn.style.color = '#C53030';
  _setText(removeBtn, 'Quitar sabor');
  removeBtn.addEventListener('click', function() { removeFlavorFromBatch(removeBtn); });
  headerRight.appendChild(removeBtn);

  header.appendChild(headerRight);
  card.appendChild(header);

  // Specific ingredients section
  var ingSection = document.createElement('div');
  ingSection.className = 'prod-flavor-specific-ings';
  ingSection.style.marginTop = '0.6rem';

  var ingTitle = document.createElement('p');
  ingTitle.style.fontWeight = '700';
  ingTitle.style.fontSize = '0.8rem';
  ingTitle.style.color = '#718096';
  ingTitle.style.margin = '0 0 0.4rem';
  _setText(ingTitle, 'Ingredientes específicos de este sabor:');
  ingSection.appendChild(ingTitle);

  var ingRows = document.createElement('div');
  ingRows.className = 'flavor-specific-rows';
  ingRows.dataset.flavorId = flavorId;
  ingSection.appendChild(ingRows);

  var addIngBtn = document.createElement('button');
  addIngBtn.type = 'button';
  addIngBtn.className = 'btn-secondary';
  addIngBtn.style.marginTop = '0.4rem';
  addIngBtn.style.padding = '0.3rem 0.75rem';
  addIngBtn.style.fontSize = '0.8rem';
  _setText(addIngBtn, '+ Agregar ingrediente específico');
  addIngBtn.addEventListener('click', function() { addFlavorIngredientRow(addIngBtn); });
  ingSection.appendChild(addIngBtn);

  card.appendChild(ingSection);
  container.appendChild(card);

  // Reset select
  select.value = '';
  updateBatchCostPreview();
}

function removeFlavorFromBatch(btn) {
  var card = btn.closest('.prod-flavor-card');
  if (card) {
    card.parentNode.removeChild(card);
    updateBatchCostPreview();
  }
}

function addFlavorIngredientRow(btn) {
  var card = btn.closest('.prod-flavor-card');
  if (!card) return;
  var flavorId = card.dataset.flavorId;
  var rowsContainer = card.querySelector('.flavor-specific-rows');
  if (!rowsContainer) return;
  rowsContainer.appendChild(_buildIngredientRow(flavorId));
}

// ---- PREVISUALIZACIÓN DE COSTOS ----

function updateBatchCostPreview() {
  var previewEl = document.getElementById('batch-cost-preview');
  if (!previewEl) return;

  // Build costMap from prodIngredients
  var costMap = {};
  for (var k = 0; k < prodIngredients.length; k++) {
    costMap[prodIngredients[k].id] = Number(prodIngredients[k].costo_unitario_avg) || 0;
  }

  // Collect general ingredient rows
  var allIngRows = [];
  var generalRows = document.querySelectorAll('#batch-general-ingredients .ingredient-row');
  for (var i = 0; i < generalRows.length; i++) {
    var sel = generalRows[i].querySelector('select');
    var qty = generalRows[i].querySelector('input[type=number]');
    if (sel && sel.value && qty && parseFloat(qty.value) > 0) {
      allIngRows.push({ ingredient_id: sel.value, qty_usada: parseFloat(qty.value), flavor_id: null });
    }
  }

  // Collect flavor-specific rows
  var flavorCards = document.querySelectorAll('#batch-flavors-container .prod-flavor-card');
  for (var j = 0; j < flavorCards.length; j++) {
    var flavorId = flavorCards[j].dataset.flavorId;
    var specificRows = flavorCards[j].querySelectorAll('.flavor-specific-rows .ingredient-row');
    for (var m = 0; m < specificRows.length; m++) {
      var sSel = specificRows[m].querySelector('select');
      var sQty = specificRows[m].querySelector('input[type=number]');
      if (sSel && sSel.value && sQty && parseFloat(sQty.value) > 0) {
        allIngRows.push({ ingredient_id: sSel.value, qty_usada: parseFloat(sQty.value), flavor_id: flavorId });
      }
    }
  }

  // Collect output rows
  var outputRows = [];
  for (var n = 0; n < flavorCards.length; n++) {
    var fId = flavorCards[n].dataset.flavorId;
    var qtyInput = flavorCards[n].querySelector('[data-role="qty-producida"]');
    var qtyVal = qtyInput ? parseFloat(qtyInput.value) : 0;
    if (fId && qtyVal > 0) {
      outputRows.push({ flavor_id: fId, qty_producida: qtyVal });
    }
  }

  if (outputRows.length === 0) {
    previewEl.innerHTML = '<p style="color:#718096;font-size:0.85rem">Agrega sabores y cantidades para ver el costo estimado.</p>';
    return;
  }

  var costs = logic_calculateBatchCosts(allIngRows, costMap, outputRows);

  var html = '<table class="admin-table" style="font-size:0.85rem"><thead><tr>' +
    '<th>Sabor</th><th>Qty</th><th>Costo Unit.</th><th>Costo Total</th>' +
    '</tr></thead><tbody>';

  for (var p = 0; p < outputRows.length; p++) {
    var out = outputRows[p];
    var costoUnit = costs[out.flavor_id] || 0;
    var costoTotal = costoUnit * out.qty_producida;

    // Find flavor name
    var fName = out.flavor_id;
    for (var q = 0; q < allAdminFlavors.length; q++) {
      if (String(allAdminFlavors[q].id) === String(out.flavor_id)) {
        fName = allAdminFlavors[q].name || allAdminFlavors[q].nombre || out.flavor_id;
        break;
      }
    }

    html += '<tr>' +
      '<td style="font-weight:700">' + fName + '</td>' +
      '<td>' + out.qty_producida + '</td>' +
      '<td>' + formatMoney(costoUnit) + '</td>' +
      '<td>' + formatMoney(costoTotal) + '</td>' +
    '</tr>';
  }

  html += '</tbody></table>';
  previewEl.innerHTML = html;
}

// ---- GUARDAR TANDA ----

async function saveNewBatch() {
  var fechaInput = document.getElementById('batch-fecha');
  var notasInput = document.getElementById('batch-notas');

  var fecha = fechaInput ? fechaInput.value : '';
  var notas = notasInput ? notasInput.value.trim() : '';

  // Collect general ingredient rows
  var allIngRows = [];
  var generalRows = document.querySelectorAll('#batch-general-ingredients .ingredient-row');
  for (var i = 0; i < generalRows.length; i++) {
    var gSel = generalRows[i].querySelector('select');
    var gQty = generalRows[i].querySelector('input[type=number]');
    var ingId = gSel ? gSel.value : '';
    var ingQty = gQty ? parseFloat(gQty.value) : 0;
    if (ingId || ingQty > 0) {
      var stockDisp = null;
      for (var ii = 0; ii < prodIngredients.length; ii++) {
        if (String(prodIngredients[ii].id) === String(ingId)) {
          stockDisp = Number(prodIngredients[ii].qty_stock) || 0;
          break;
        }
      }
      allIngRows.push({ ingredient_id: ingId, qty_usada: ingQty, flavor_id: null, stock_disponible: stockDisp });
    }
  }

  // Collect flavor cards
  var flavorCards = document.querySelectorAll('#batch-flavors-container .prod-flavor-card');
  var outputRows = [];

  for (var j = 0; j < flavorCards.length; j++) {
    var flavorId = flavorCards[j].dataset.flavorId;
    var qtyInput = flavorCards[j].querySelector('[data-role="qty-producida"]');
    var qtyVal = qtyInput ? parseFloat(qtyInput.value) : 0;
    outputRows.push({ flavor_id: flavorId, qty_producida: qtyVal || 0 });

    var specificRows = flavorCards[j].querySelectorAll('.flavor-specific-rows .ingredient-row');
    for (var m = 0; m < specificRows.length; m++) {
      var sSel = specificRows[m].querySelector('select');
      var sQty = specificRows[m].querySelector('input[type=number]');
      var sIngId = sSel ? sSel.value : '';
      var sIngQty = sQty ? parseFloat(sQty.value) : 0;
      if (sIngId || sIngQty > 0) {
        var sStockDisp = null;
        for (var si = 0; si < prodIngredients.length; si++) {
          if (String(prodIngredients[si].id) === String(sIngId)) {
            sStockDisp = Number(prodIngredients[si].qty_stock) || 0;
            break;
          }
        }
        allIngRows.push({ ingredient_id: sIngId, qty_usada: sIngQty, flavor_id: flavorId, stock_disponible: sStockDisp });
      }
    }
  }

  var total_bolis = outputRows.reduce(function(sum, r) { return sum + (Number(r.qty_producida) || 0); }, 0);

  var batchData = { fecha: fecha, notas: notas, total_bolis: total_bolis };

  var validation = logic_validateBatchForm(batchData, allIngRows, outputRows);
  if (!validation.valid) {
    showToast(validation.errors[0], 'error');
    return;
  }

  var batchPayload = { fecha: fecha, total_bolis: total_bolis, notas: notas || null };

  try {
    await db_saveBatch(batchPayload, allIngRows, outputRows);
    showToast('Tanda registrada', 'success');
    closeNewBatchModal();
    loadAndRenderBatches();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// ---- HISTORIAL DE TANDAS ----

async function loadAndRenderBatches() {
  try {
    prodBatches = await db_getBatches();
    renderBatchHistoryList(prodBatches);
  } catch (error) {
    showToast(error.message, 'error');
    var container = document.getElementById('prod-batches-list');
    if (container) container.innerHTML = '<p style="text-align:center;color:#E53E3E;padding:2rem">' + error.message + '</p>';
  }
}

function renderBatchHistoryList(batches) {
  var container = document.getElementById('prod-batches-list');
  if (!container) return;

  if (!batches || batches.length === 0) {
    container.innerHTML = '<p style="text-align:center;padding:2rem;color:#718096;font-weight:700">No hay tandas registradas.</p>';
    return;
  }

  container.innerHTML = '';

  for (var i = 0; i < batches.length; i++) {
    var batch = batches[i];
    var card = document.createElement('div');
    card.className = 'batch-card';

    var outputs = batch.batch_outputs || [];

    var flavorsHtml = '';
    for (var j = 0; j < outputs.length; j++) {
      var out = outputs[j];
      var flavorName = (out.flavors && (out.flavors.nombre || out.flavors.name)) || ('Sabor ' + (j + 1));
      flavorsHtml += '<div class="batch-cost-preview-row">' +
        '<span style="font-weight:700">' + flavorName + '</span>' +
        '<span>' + (out.qty_producida || 0) + ' bolis</span>' +
        '<span style="color:#718096">' + formatMoney(out.costo_unitario_calculado || 0) + '/u</span>' +
      '</div>';
    }

    var headerHtml = '<div class="batch-card-header">' +
      '<div>' +
        '<span style="font-family:\'Pacifico\',cursive;color:#FF6B6B;font-size:1.1rem">' + (batch.fecha || '') + '</span>' +
        '<span style="margin-left:0.75rem;font-size:0.85rem;color:#718096;font-weight:700">' + (batch.total_bolis || 0) + ' bolis totales</span>' +
      '</div>' +
      '<button class="btn-secondary" style="padding:0.35rem 0.85rem;font-size:0.82rem;background:#4D96FF;color:#fff" onclick="openBatchDetailModal(\'' + batch.id + '\')">Ver detalle</button>' +
    '</div>';

    var bodyHtml = '<div class="batch-card-body">' +
      (batch.notas ? '<p style="font-size:0.82rem;color:#718096;margin:0 0 0.5rem">' + batch.notas + '</p>' : '') +
      (flavorsHtml ? '<div class="batch-cost-preview">' + flavorsHtml + '</div>' : '') +
    '</div>';

    card.innerHTML = headerHtml + bodyHtml;
    container.appendChild(card);
  }
}

// ---- MODAL DETALLE DE TANDA ----

async function openBatchDetailModal(batchId) {
  var overlay = document.getElementById('modal-batch-detail-overlay');
  if (!overlay) return;

  var detailEl = document.getElementById('batch-detail-content');
  if (detailEl) detailEl.innerHTML = '<p style="text-align:center;color:#718096;padding:1rem">Cargando...</p>';

  overlay.classList.add('open');

  try {
    var detail = await db_getBatchDetail(batchId);
    if (!detailEl) return;

    var batch = detail.batch;
    var ingredients = detail.ingredients || [];
    var outputs = detail.outputs || [];

    // Build costMap for display
    var costMap = {};
    for (var k = 0; k < prodIngredients.length; k++) {
      costMap[prodIngredients[k].id] = Number(prodIngredients[k].costo_unitario_avg) || 0;
    }

    var html = '<div style="margin-bottom:1rem">' +
      '<p style="margin:0;font-weight:800;font-size:1rem">Fecha: <span style="font-weight:600">' + (batch.fecha || '—') + '</span></p>' +
      '<p style="margin:0.25rem 0 0;font-size:0.9rem;color:#718096">' + (batch.notas || 'Sin notas') + '</p>' +
      '<p style="margin:0.25rem 0 0;font-weight:700">Total bolis producidos: ' + (batch.total_bolis || 0) + '</p>' +
    '</div>';

    // General ingredients
    var generalIngs = ingredients.filter(function(r) { return !r.flavor_id; });
    if (generalIngs.length > 0) {
      html += '<div class="prod-section-divider">Ingredientes Generales</div>' +
        '<table class="admin-table" style="font-size:0.85rem;margin-bottom:1rem"><thead><tr>' +
        '<th>Ingrediente</th><th>Cantidad</th>' +
        '</tr></thead><tbody>';
      for (var gi = 0; gi < generalIngs.length; gi++) {
        var gIng = generalIngs[gi];
        var ingName = (gIng.ingredients && gIng.ingredients.nombre) || gIng.ingredient_id;
        var ingUnit = (gIng.ingredients && gIng.ingredients.unidad) || '';
        html += '<tr><td>' + ingName + '</td><td>' + (gIng.qty_usada || 0) + ' ' + ingUnit + '</td></tr>';
      }
      html += '</tbody></table>';
    }

    // Outputs with specific ingredients
    html += '<div class="prod-section-divider">Sabores Producidos</div>';
    for (var oi = 0; oi < outputs.length; oi++) {
      var out = outputs[oi];
      var outFlavorName = (out.flavors && (out.flavors.nombre || out.flavors.name)) || out.flavor_id;
      html += '<div class="prod-flavor-card" style="margin-bottom:0.75rem">' +
        '<div class="prod-flavor-card-header">' +
          '<span style="font-weight:800">' + outFlavorName + '</span>' +
          '<span style="font-size:0.85rem;color:#718096">' + (out.qty_producida || 0) + ' bolis · Costo unit: ' + formatMoney(out.costo_unitario_calculado || 0) + '</span>' +
        '</div>';

      var specificIngs = ingredients.filter(function(r) { return String(r.flavor_id) === String(out.flavor_id); });
      if (specificIngs.length > 0) {
        html += '<div style="padding:0.5rem 0 0">' +
          '<p style="font-size:0.78rem;font-weight:700;color:#718096;margin:0 0 0.3rem">Ingredientes específicos:</p>' +
          '<table class="admin-table" style="font-size:0.82rem"><thead><tr><th>Ingrediente</th><th>Cantidad</th></tr></thead><tbody>';
        for (var si = 0; si < specificIngs.length; si++) {
          var sIng = specificIngs[si];
          var sIngName = (sIng.ingredients && sIng.ingredients.nombre) || sIng.ingredient_id;
          var sIngUnit = (sIng.ingredients && sIng.ingredients.unidad) || '';
          html += '<tr><td>' + sIngName + '</td><td>' + (sIng.qty_usada || 0) + ' ' + sIngUnit + '</td></tr>';
        }
        html += '</tbody></table></div>';
      }

      html += '</div>';
    }

    detailEl.innerHTML = html;
  } catch (error) {
    showToast(error.message, 'error');
    if (detailEl) detailEl.innerHTML = '<p style="text-align:center;color:#E53E3E;padding:1rem">' + error.message + '</p>';
  }
}

function closeBatchDetailModal() {
  var overlay = document.getElementById('modal-batch-detail-overlay');
  if (overlay) overlay.classList.remove('open');
}
