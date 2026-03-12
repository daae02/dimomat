// ================================================
// PRODUCTION DB — capa de acceso a datos
// Depende de: supabaseClient (global), production-logic.js
// ================================================

// ---- INGREDIENTES ----

async function db_getIngredients() {
  var result = await supabaseClient
    .from('ingredients')
    .select('*')
    .order('nombre', { ascending: true });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function db_saveIngredient(payload) {
  var result;
  if (payload.id) {
    result = await supabaseClient
      .from('ingredients')
      .update({ nombre: payload.nombre, unidad: payload.unidad, notas: payload.notas || null })
      .eq('id', payload.id)
      .select()
      .single();
  } else {
    result = await supabaseClient
      .from('ingredients')
      .insert({ nombre: payload.nombre, unidad: payload.unidad, notas: payload.notas || null, qty_stock: 0, costo_unitario_avg: 0 })
      .select()
      .single();
  }
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function db_deleteIngredient(id) {
  var result = await supabaseClient
    .from('ingredients')
    .delete()
    .eq('id', id);
  if (result.error) throw new Error(result.error.message);
}

// ---- COMPRAS ----

async function db_getPurchasesByIngredient(ingredient_id) {
  var result = await supabaseClient
    .from('ingredient_purchases')
    .select('*')
    .eq('ingredient_id', ingredient_id)
    .order('fecha', { ascending: false });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function db_recordPurchase(payload) {
  // 1. Obtener ingrediente actual
  var ingResult = await supabaseClient
    .from('ingredients')
    .select('qty_stock, costo_unitario_avg')
    .eq('id', payload.ingredient_id)
    .single();
  if (ingResult.error) throw new Error(ingResult.error.message);

  var currentStock = Number(ingResult.data.qty_stock) || 0;
  var currentAvg = Number(ingResult.data.costo_unitario_avg) || 0;

  // 2. INSERT compra
  var purchaseResult = await supabaseClient
    .from('ingredient_purchases')
    .insert({
      ingredient_id: payload.ingredient_id,
      qty: payload.qty,
      costo_unitario: payload.costo_unitario,
      fecha: payload.fecha,
      notas: payload.notas || null
    })
    .select()
    .single();
  if (purchaseResult.error) throw new Error(purchaseResult.error.message);

  // 3. Calcular nuevo promedio ponderado
  var newAvg = logic_weightedAvgCost(currentAvg, currentStock, Number(payload.qty), Number(payload.costo_unitario));
  var newStock = currentStock + Number(payload.qty);

  // 4. Actualizar ingrediente
  var updateResult = await supabaseClient
    .from('ingredients')
    .update({ costo_unitario_avg: newAvg, qty_stock: newStock })
    .eq('id', payload.ingredient_id)
    .select()
    .single();
  if (updateResult.error) throw new Error(updateResult.error.message);

  return { purchase: purchaseResult.data, updatedIngredient: updateResult.data };
}

// ---- TANDAS ----

async function db_getBatches(limit) {
  limit = limit || 20;
  var result = await supabaseClient
    .from('production_batches')
    .select('*, batch_outputs(flavor_id, qty_producida, costo_unitario_calculado, flavors(name))')
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function db_getBatchDetail(batch_id) {
  var batchResult = await supabaseClient
    .from('production_batches')
    .select('*')
    .eq('id', batch_id)
    .single();
  if (batchResult.error) throw new Error(batchResult.error.message);

  var ingredientsResult = await supabaseClient
    .from('batch_ingredients')
    .select('*, ingredients(nombre, unidad), flavors(name)')
    .eq('batch_id', batch_id);
  if (ingredientsResult.error) throw new Error(ingredientsResult.error.message);

  var outputsResult = await supabaseClient
    .from('batch_outputs')
    .select('*, flavors(name)')
    .eq('batch_id', batch_id);
  if (outputsResult.error) throw new Error(outputsResult.error.message);

  return {
    batch: batchResult.data,
    ingredients: ingredientsResult.data,
    outputs: outputsResult.data
  };
}

async function db_saveBatch(batchPayload, ingredientRows, outputRows) {
  var batch_id = null;
  try {
    // 1. Obtener costos actuales de ingredientes usados
    var ingredientIds = ingredientRows.map(function(r) { return r.ingredient_id; });
    var ingCostsResult = await supabaseClient
      .from('ingredients')
      .select('id, costo_unitario_avg, qty_stock')
      .in('id', ingredientIds);
    if (ingCostsResult.error) throw new Error(ingCostsResult.error.message);

    var costMap = {};
    ingCostsResult.data.forEach(function(ing) {
      costMap[ing.id] = Number(ing.costo_unitario_avg) || 0;
    });

    // 2. Calcular costos con lógica pura
    var calculatedCosts = logic_calculateBatchCosts(ingredientRows, costMap, outputRows);

    // 3. INSERT production_batches
    var batchResult = await supabaseClient
      .from('production_batches')
      .insert(batchPayload)
      .select()
      .single();
    if (batchResult.error) throw new Error(batchResult.error.message);
    batch_id = batchResult.data.id;

    // 4. INSERT batch_ingredients
    var batchIngRows = ingredientRows.map(function(r) {
      return {
        batch_id: batch_id,
        ingredient_id: r.ingredient_id,
        qty_usada: r.qty_usada,
        flavor_id: r.flavor_id || null
      };
    });
    var batchIngResult = await supabaseClient.from('batch_ingredients').insert(batchIngRows);
    if (batchIngResult.error) throw new Error(batchIngResult.error.message);

    // 5. INSERT batch_outputs con costos calculados
    var batchOutRows = outputRows.map(function(r) {
      return {
        batch_id: batch_id,
        flavor_id: r.flavor_id,
        qty_producida: r.qty_producida,
        costo_unitario_calculado: calculatedCosts[r.flavor_id] || 0
      };
    });
    var batchOutResult = await supabaseClient.from('batch_outputs').insert(batchOutRows);
    if (batchOutResult.error) throw new Error(batchOutResult.error.message);

    // 6. Actualizar stock y production_cost de cada sabor
    for (var i = 0; i < outputRows.length; i++) {
      var row = outputRows[i];
      var flavorResult = await supabaseClient
        .from('flavors')
        .select('stock, production_cost')
        .eq('id', row.flavor_id)
        .single();
      if (flavorResult.error) throw new Error(flavorResult.error.message);

      var currentFlavorStock = Number(flavorResult.data.stock) || 0;
      var currentFlavorCost = Number(flavorResult.data.production_cost) || 0;
      var newCost = logic_newFlavorAvgCost(currentFlavorCost, currentFlavorStock, calculatedCosts[row.flavor_id] || 0, row.qty_producida);
      var newStock = currentFlavorStock + row.qty_producida;

      var flavorUpdateResult = await supabaseClient
        .from('flavors')
        .update({ production_cost: newCost, stock: newStock })
        .eq('id', row.flavor_id);
      if (flavorUpdateResult.error) throw new Error(flavorUpdateResult.error.message);
    }

    // 7. Descontar ingredientes del stock
    for (var j = 0; j < ingredientRows.length; j++) {
      var ingRow = ingredientRows[j];
      var ingResult = await supabaseClient
        .from('ingredients')
        .select('qty_stock')
        .eq('id', ingRow.ingredient_id)
        .single();
      if (ingResult.error) throw new Error(ingResult.error.message);
      var newIngStock = Math.max(0, Number(ingResult.data.qty_stock) - Number(ingRow.qty_usada));
      var ingUpdateResult = await supabaseClient
        .from('ingredients')
        .update({ qty_stock: newIngStock })
        .eq('id', ingRow.ingredient_id);
      if (ingUpdateResult.error) throw new Error(ingUpdateResult.error.message);
    }

    return {
      batch_id: batch_id,
      outputs: batchOutRows
    };

  } catch (err) {
    // Rollback: eliminar la tanda recién creada (CASCADE limpia batch_ingredients y batch_outputs)
    if (batch_id) {
      await supabaseClient.from('production_batches').delete().eq('id', batch_id);
    }
    throw err;
  }
}

async function db_deleteBatch(batch_id) {
  // ON DELETE CASCADE elimina batch_ingredients y batch_outputs automáticamente
  // NOTA: no revierte stock ni production_cost de flavors
  var result = await supabaseClient
    .from('production_batches')
    .delete()
    .eq('id', batch_id);
  if (result.error) throw new Error(result.error.message);
}
