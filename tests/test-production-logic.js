// ================================================
// Tests unitarios — production-logic.js
// Ejecutar con: node tests/test-production-logic.js
// ================================================

var fs = require('fs');
var path = require('path');

// Cargar las funciones via eval (el archivo no usa module.exports)
var src = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'production', 'production-logic.js'),
  'utf8'
);
eval(src);

var passed = 0;
var failed = 0;

function assert(description, actual, expected) {
  var ok;
  if (typeof expected === 'number' && typeof actual === 'number') {
    ok = Math.abs(actual - expected) < 0.0001;
  } else {
    ok = JSON.stringify(actual) === JSON.stringify(expected);
  }
  if (ok) {
    console.log('  ✅ ' + description);
    passed++;
  } else {
    console.log('  ❌ ' + description);
    console.log('     Esperado: ' + JSON.stringify(expected));
    console.log('     Obtenido: ' + JSON.stringify(actual));
    failed++;
  }
}

// ------------------------------------------------
// logic_weightedAvgCost
// ------------------------------------------------
console.log('\n=== logic_weightedAvgCost ===');

// Stock 0, compra nueva → retorna el precio de la compra
assert(
  'Stock 0, compra nueva → precio de la compra',
  logic_weightedAvgCost(0, 0, 1000, 1.20),
  1.20
);

// Stock y compra con mismo precio → retorna ese precio
assert(
  'Stock y compra con mismo precio → ese mismo precio',
  logic_weightedAvgCost(0.75, 500, 300, 0.75),
  0.75
);

// Stock 500ml a ₡0.75, compra 1000ml a ₡1.20 → ₡1.05
// (0.75*500 + 1.20*1000) / 1500 = 1575/1500 = 1.05
assert(
  'Stock 500@₡0.75 + compra 1000@₡1.20 → ₡1.05',
  logic_weightedAvgCost(0.75, 500, 1000, 1.20),
  1.05
);

// Stock 0, newQty 0 → 0 (sin dividir por cero)
assert(
  'Stock 0 y compra 0 → 0 (sin división por cero)',
  logic_weightedAvgCost(0, 0, 0, 99),
  0
);

// Valores con muchos decimales → redondeado a 4 decimales
// (1.123456789 * 1 + 2.987654321 * 1) / 2 = 2.055555555 → 2.0556
assert(
  'Decimales largos → redondeado a 4 decimales',
  logic_weightedAvgCost(1.123456789, 1, 1, 2.987654321),
  2.0556
);

// ------------------------------------------------
// logic_calculateBatchCosts
// ------------------------------------------------
console.log('\n=== logic_calculateBatchCosts ===');

// Solo ingredientes generales, un sabor → costo = total_general / qty
// ingredientCost[1] = 2, qty_usada = 10 → costo_general = 20; 1 sabor 10 bolis → 2 por boli
assert(
  'Solo general, un sabor → costo = total_general / qty',
  logic_calculateBatchCosts(
    [{ ingredient_id: 1, qty_usada: 10, flavor_id: null }],
    { 1: 2 },
    [{ flavor_id: 'fresa', qty_producida: 10 }]
  ),
  { fresa: 2 }
);

// Solo ingredientes generales, dos sabores → costo base igual para ambos
// costo_general = 20 / 20 bolis = 1 por boli; ambos sabores = 1
assert(
  'Solo general, dos sabores → mismo costo base para ambos',
  logic_calculateBatchCosts(
    [{ ingredient_id: 1, qty_usada: 10, flavor_id: null }],
    { 1: 2 },
    [
      { flavor_id: 'fresa', qty_producida: 10 },
      { flavor_id: 'limón', qty_producida: 10 }
    ]
  ),
  { fresa: 1, limón: 1 }
);

// Ingredientes generales + específicos → cada sabor tiene su propio costo
// General: ingrediente 1, qty 10, costo 2 → total_general = 20, por boli = 20/20 = 1
// Específico fresa: ingrediente 2, qty 5, costo 4 → total_especifico = 20, por boli = 20/10 = 2
// Fresa total = 1 + 2 = 3
// Limón: sin específicos → 1
assert(
  'General + específicos → cada sabor con su propio costo',
  logic_calculateBatchCosts(
    [
      { ingredient_id: 1, qty_usada: 10, flavor_id: null },
      { ingredient_id: 2, qty_usada: 5,  flavor_id: 'fresa' }
    ],
    { 1: 2, 2: 4 },
    [
      { flavor_id: 'fresa', qty_producida: 10 },
      { flavor_id: 'limón', qty_producida: 10 }
    ]
  ),
  { fresa: 3, limón: 1 }
);

// Un sabor sin específicos paga solo base; otro con específicos paga base + extra
// General: ingrediente 1, qty 6, costo 5 → total_general = 30, total bolis = 15, base = 2
// Específico limón: ingrediente 2, qty 3, costo 10 → total_esp = 30, por boli = 30/5 = 6
// Fresa = 2, Limón = 2 + 6 = 8
assert(
  'Un sabor sin específicos (solo base), otro con específicos (base + extra)',
  logic_calculateBatchCosts(
    [
      { ingredient_id: 1, qty_usada: 6,  flavor_id: null },
      { ingredient_id: 2, qty_usada: 3,  flavor_id: 'limón' }
    ],
    { 1: 5, 2: 10 },
    [
      { flavor_id: 'fresa', qty_producida: 10 },
      { flavor_id: 'limón', qty_producida: 5  }
    ]
  ),
  { fresa: 2, limón: 8 }
);

// outputRows vacío → retorna {}
assert(
  'outputRows vacío → retorna {}',
  logic_calculateBatchCosts(
    [{ ingredient_id: 1, qty_usada: 10, flavor_id: null }],
    { 1: 2 },
    []
  ),
  {}
);

// total_bolis = 0 (todas qty = 0) → retorna {}
assert(
  'total_bolis = 0 → retorna {}',
  logic_calculateBatchCosts(
    [{ ingredient_id: 1, qty_usada: 10, flavor_id: null }],
    { 1: 2 },
    [{ flavor_id: 'fresa', qty_producida: 0 }]
  ),
  {}
);

// Un ingrediente general + un sabor específico sin ingredientes → costo = solo base
// General: ingrediente 1, qty 5, costo 4 → total_general = 20, total bolis = 10, base = 2
// Fresa: sin ingredientes específicos → costo = 2
assert(
  'Solo ingrediente general, sabor sin específicos → costo = solo base',
  logic_calculateBatchCosts(
    [{ ingredient_id: 1, qty_usada: 5, flavor_id: null }],
    { 1: 4 },
    [{ flavor_id: 'fresa', qty_producida: 10 }]
  ),
  { fresa: 2 }
);

// ------------------------------------------------
// logic_newFlavorAvgCost
// ------------------------------------------------
console.log('\n=== logic_newFlavorAvgCost ===');

// Verifica que delega a weightedAvgCost: mismo resultado para mismos args
assert(
  'Delega a weightedAvgCost: stock 0 + compra nueva → precio de compra',
  logic_newFlavorAvgCost(0, 0, 1.50, 100),
  1.50
);

assert(
  'Delega a weightedAvgCost: stock 0 y compra 0 → 0',
  logic_newFlavorAvgCost(0, 0, 0, 0),
  0
);

// Stock 20 unidades a ₡300, nueva tanda de 10 a ₡350
// (300*20 + 350*10) / 30 = (6000 + 3500) / 30 = 9500/30 = 316.6667
assert(
  'Stock 20@₡300 + tanda 10@₡350 → ₡316.6667',
  logic_newFlavorAvgCost(300, 20, 350, 10),
  316.6667
);

// Mismo precio en ambas fuentes → mismo precio
assert(
  'Stock y tanda con mismo precio → ese precio',
  logic_newFlavorAvgCost(250, 50, 250, 30),
  250
);

// ------------------------------------------------
// logic_validateBatchForm
// ------------------------------------------------
console.log('\n=== logic_validateBatchForm ===');

var validIngredients = [
  { ingredient_id: 1, qty_usada: 5, flavor_id: null, stock_disponible: 100 }
];
var validOutputRows = [{ flavor_id: 'fresa', qty_producida: 10 }];
var validBatch = { fecha: '2026-03-11', total_bolis: 10 };

// Caso válido completo → { valid: true, errors: [] }
assert(
  'Caso válido completo → valid: true, errors: []',
  logic_validateBatchForm(validBatch, validIngredients, validOutputRows),
  { valid: true, errors: [] }
);

// Sin fecha → error de fecha
var result = logic_validateBatchForm(
  { total_bolis: 10 },
  validIngredients,
  validOutputRows
);
assert(
  'Sin fecha → valid: false',
  result.valid,
  false
);
assert(
  'Sin fecha → contiene error de fecha',
  result.errors.some(function(e) { return e.toLowerCase().includes('fecha'); }),
  true
);

// Sin outputRows → error de sabores
result = logic_validateBatchForm(
  { fecha: '2026-03-11', total_bolis: 0 },
  validIngredients,
  []
);
assert(
  'Sin outputRows → valid: false',
  result.valid,
  false
);
assert(
  'Sin outputRows → contiene error de sabor',
  result.errors.some(function(e) { return e.toLowerCase().includes('sabor'); }),
  true
);

// outputRows con qty 0 → mismo error que sin outputRows
result = logic_validateBatchForm(
  { fecha: '2026-03-11', total_bolis: 0 },
  validIngredients,
  [{ flavor_id: 'fresa', qty_producida: 0 }]
);
assert(
  'outputRows todos con qty=0 → valid: false',
  result.valid,
  false
);

// total_bolis != suma de outputRows → error de inconsistencia
result = logic_validateBatchForm(
  { fecha: '2026-03-11', total_bolis: 99 },
  validIngredients,
  [{ flavor_id: 'fresa', qty_producida: 10 }]
);
assert(
  'total_bolis != suma → valid: false',
  result.valid,
  false
);
assert(
  'total_bolis != suma → contiene error de inconsistencia',
  result.errors.some(function(e) { return e.includes('99') && e.includes('10'); }),
  true
);

// Ingrediente con qty_usada pero sin ingredient_id → error
result = logic_validateBatchForm(
  { fecha: '2026-03-11', total_bolis: 10 },
  [{ ingredient_id: null, qty_usada: 5, flavor_id: null, stock_disponible: 100 }],
  [{ flavor_id: 'fresa', qty_producida: 10 }]
);
assert(
  'Ingrediente con qty pero sin ingredient_id → valid: false',
  result.valid,
  false
);
assert(
  'Ingrediente con qty pero sin ingredient_id → error menciona ingrediente',
  result.errors.some(function(e) { return e.toLowerCase().includes('ingrediente'); }),
  true
);

// Ingrediente duplicado (mismo ingredient_id + flavor_id) → error
result = logic_validateBatchForm(
  { fecha: '2026-03-11', total_bolis: 10 },
  [
    { ingredient_id: 1, qty_usada: 3, flavor_id: null, stock_disponible: 100 },
    { ingredient_id: 1, qty_usada: 2, flavor_id: null, stock_disponible: 100 }
  ],
  [{ flavor_id: 'fresa', qty_producida: 10 }]
);
assert(
  'Ingrediente duplicado en misma sección → valid: false',
  result.valid,
  false
);
assert(
  'Ingrediente duplicado → error menciona duplicado',
  result.errors.some(function(e) { return e.toLowerCase().includes('duplicado'); }),
  true
);

// qty_usada > stock_disponible → error de stock
result = logic_validateBatchForm(
  { fecha: '2026-03-11', total_bolis: 10 },
  [{ ingredient_id: 1, qty_usada: 999, flavor_id: null, stock_disponible: 10 }],
  [{ flavor_id: 'fresa', qty_producida: 10 }]
);
assert(
  'qty_usada > stock_disponible → valid: false',
  result.valid,
  false
);
assert(
  'qty_usada > stock_disponible → error menciona stock',
  result.errors.some(function(e) { return e.toLowerCase().includes('stock'); }),
  true
);

// Múltiples errores simultáneos → todos reportados
result = logic_validateBatchForm(
  { total_bolis: 99 },   // sin fecha + total_bolis incorrecto
  [
    { ingredient_id: null, qty_usada: 5, flavor_id: null, stock_disponible: 100 }, // sin ingredient_id
    { ingredient_id: 2,    qty_usada: 500, flavor_id: null, stock_disponible: 1 }  // sin stock
  ],
  [{ flavor_id: 'fresa', qty_producida: 10 }]
);
assert(
  'Múltiples errores → valid: false',
  result.valid,
  false
);
assert(
  'Múltiples errores → al menos 3 errores reportados',
  result.errors.length >= 3,
  true
);

// ------------------------------------------------
// Resultado final
// ------------------------------------------------
console.log('\n📊 Resultado: ' + passed + ' pasaron, ' + failed + ' fallaron');
if (failed > 0) process.exit(1);
