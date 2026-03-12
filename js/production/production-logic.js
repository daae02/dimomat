// ================================================
// PRODUCTION LOGIC — funciones puras de cálculo
// Sin dependencias externas (no Supabase, no DOM)
// ================================================

/**
 * Calcula el nuevo costo unitario promedio ponderado al recibir una compra.
 * @param {number} currentAvg    Costo unitario promedio actual
 * @param {number} currentStock  Cantidad en stock actual
 * @param {number} newQty        Cantidad de la nueva compra
 * @param {number} newUnitCost   Costo unitario de la nueva compra
 * @returns {number} Nuevo costo unitario promedio
 */
function logic_weightedAvgCost(currentAvg, currentStock, newQty, newUnitCost) {
  var total = currentStock + newQty;
  if (total === 0) return 0;
  var result = (currentAvg * currentStock + newUnitCost * newQty) / total;
  return Math.round(result * 10000) / 10000;
}

/**
 * Calcula el costo unitario de cada sabor en una tanda de producción.
 *
 * La base general se divide equitativamente entre todos los bolis.
 * Los ingredientes específicos de cada sabor solo se dividen entre los bolis de ese sabor.
 *
 * @param {Array}  batchIngredients  [{ ingredient_id, qty_usada, flavor_id }]
 *                                   flavor_id === null → general
 * @param {Object} ingredientCosts   { [ingredient_id]: costo_unitario_avg }
 * @param {Array}  outputRows        [{ flavor_id, qty_producida }]
 * @returns {Object} { [flavor_id]: costo_unitario_calculado }
 */
function logic_calculateBatchCosts(batchIngredients, ingredientCosts, outputRows) {
  var resultado = {};

  var total_bolis = outputRows.reduce(function(sum, r) { return sum + (Number(r.qty_producida) || 0); }, 0);
  if (total_bolis === 0) return resultado;

  // Costo total de ingredientes generales (flavor_id null)
  var costo_general_total = batchIngredients
    .filter(function(r) { return r.flavor_id === null || r.flavor_id === undefined; })
    .reduce(function(sum, r) {
      var costo = (ingredientCosts[r.ingredient_id] || 0) * (Number(r.qty_usada) || 0);
      return sum + costo;
    }, 0);

  var costo_por_boli_general = costo_general_total / total_bolis;

  // Costo específico por sabor
  outputRows.forEach(function(outputRow) {
    var costo_especifico = batchIngredients
      .filter(function(r) { return r.flavor_id === outputRow.flavor_id; })
      .reduce(function(sum, r) {
        var costo = (ingredientCosts[r.ingredient_id] || 0) * (Number(r.qty_usada) || 0);
        return sum + costo;
      }, 0);

    var qty = Number(outputRow.qty_producida) || 0;
    var costo_unitario = costo_por_boli_general + (qty > 0 ? costo_especifico / qty : 0);
    resultado[outputRow.flavor_id] = Math.round(costo_unitario * 10000) / 10000;
  });

  return resultado;
}

/**
 * Calcula el nuevo costo promedio ponderado de un sabor al producir más unidades.
 * Idéntico a logic_weightedAvgCost pero con semántica de producción.
 * @param {number} currentAvg    Costo unitario promedio actual del sabor
 * @param {number} currentStock  Unidades en stock actuales del sabor
 * @param {number} newBatchCost  Costo unitario calculado de la nueva tanda
 * @param {number} newBatchQty   Cantidad producida en la nueva tanda
 * @returns {number} Nuevo costo unitario promedio
 */
function logic_newFlavorAvgCost(currentAvg, currentStock, newBatchCost, newBatchQty) {
  return logic_weightedAvgCost(currentAvg, currentStock, newBatchQty, newBatchCost);
}

/**
 * Valida el formulario de nueva tanda antes de guardar.
 * @param {Object} batchData      { fecha, notas, total_bolis }
 * @param {Array}  ingredientRows [{ ingredient_id, qty_usada, flavor_id, stock_disponible }]
 * @param {Array}  outputRows     [{ flavor_id, qty_producida }]
 * @returns {{ valid: boolean, errors: string[] }}
 */
function logic_validateBatchForm(batchData, ingredientRows, outputRows) {
  var errors = [];

  // Fecha requerida
  if (!batchData.fecha) {
    errors.push('La fecha de la tanda es requerida.');
  }

  // Al menos un sabor con cantidad > 0
  var totalBolisCalculado = outputRows.reduce(function(sum, r) { return sum + (Number(r.qty_producida) || 0); }, 0);
  if (outputRows.length === 0 || totalBolisCalculado === 0) {
    errors.push('Debe haber al menos un sabor con cantidad producida mayor a 0.');
  }

  // total_bolis debe coincidir con la suma de qty_producida
  if (batchData.total_bolis !== undefined && Number(batchData.total_bolis) !== totalBolisCalculado) {
    errors.push('El total de bolis (' + batchData.total_bolis + ') no coincide con la suma de los sabores (' + totalBolisCalculado + ').');
  }

  // Cada ingredientRow con qty_usada > 0 debe tener ingredient_id asignado
  ingredientRows.forEach(function(r, idx) {
    if (Number(r.qty_usada) > 0 && !r.ingredient_id) {
      errors.push('La fila de ingrediente #' + (idx + 1) + ' tiene cantidad pero no tiene ingrediente seleccionado.');
    }
  });

  // No puede haber ingredientes duplicados en la misma sección (mismo ingredient_id + flavor_id)
  var seen = {};
  ingredientRows.forEach(function(r) {
    if (!r.ingredient_id) return;
    var key = r.ingredient_id + '|' + (r.flavor_id || 'general');
    if (seen[key]) {
      errors.push('El ingrediente está duplicado en la misma sección.');
    }
    seen[key] = true;
  });

  // Stock insuficiente
  ingredientRows.forEach(function(r) {
    if (r.stock_disponible !== undefined && Number(r.qty_usada) > Number(r.stock_disponible)) {
      errors.push('No hay suficiente stock del ingrediente seleccionado (disponible: ' + r.stock_disponible + ', requerido: ' + r.qty_usada + ').');
    }
  });

  return { valid: errors.length === 0, errors: errors };
}
