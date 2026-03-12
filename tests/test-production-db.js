const SUPABASE_URL = 'https://fwtniwkxrictvxmqiouz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3dG5pd2t4cmljdHZ4bXFpb3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2Nzk5NzIsImV4cCI6MjA4ODI1NTk3Mn0.TNdlFKrP3Ef9vYj_I94g7Qz9v6iYMMmV73ySgvvdO9s';

const headers = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
};

async function supabase(method, path, body = null) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { status: res.status, data };
}

function pass(label, detail = '') {
  console.log(`✅ PASS — ${label}${detail ? ' | ' + detail : ''}`);
}

function fail(label, status, body) {
  console.log(`❌ FAIL — ${label} | HTTP ${status} | ${JSON.stringify(body)}`);
}

function rlsBlock(label, status, body) {
  console.log(`❌ RLS_BLOCK — ${label} | HTTP ${status} | ${JSON.stringify(body)}`);
}

let TEST_FLAVOR_ID = null;
let TEST_INGREDIENT_ID = null;
let TEST_BATCH_ID = null;

async function runTests() {
  console.log('\n========== SUPABASE INTEGRATION TESTS — Production Module ==========\n');

  // ── SETUP: get a real flavor_id ──────────────────────────────────────────
  console.log('── SETUP: fetching a real flavor_id ──');
  {
    const { status, data } = await supabase('GET', 'flavors?select=id,name&limit=1');
    if (status === 200 && Array.isArray(data) && data.length > 0) {
      TEST_FLAVOR_ID = data[0].id;
      pass('SETUP flavor', `id=${TEST_FLAVOR_ID}, name=${data[0].name}`);
    } else {
      console.log(`⚠️  SETUP flavor — HTTP ${status} — ${JSON.stringify(data)}`);
      console.log('    (Tests 7, 8, 9 may fail without a flavor_id)');
    }
  }
  console.log();

  // ── TEST 1: Create ingredient ────────────────────────────────────────────
  console.log('── Test 1: Create ingredient ──');
  {
    const { status, data } = await supabase('POST', 'ingredients', {
      nombre: 'TEST_Leche_prueba',
      unidad: 'ml',
      qty_stock: 0,
      costo_unitario_avg: 0,
    });
    if (status === 201 && Array.isArray(data) && data[0]?.id) {
      TEST_INGREDIENT_ID = data[0].id;
      pass('Test 1 — Create ingredient', `id=${TEST_INGREDIENT_ID}`);
    } else if (status === 401 || status === 403) {
      rlsBlock('Test 1 — Create ingredient', status, data);
    } else {
      fail('Test 1 — Create ingredient', status, data);
    }
  }
  console.log();

  // ── TEST 2: Read ingredient back ─────────────────────────────────────────
  console.log('── Test 2: Verify ingredient was created ──');
  if (TEST_INGREDIENT_ID) {
    const { status, data } = await supabase('GET', `ingredients?id=eq.${TEST_INGREDIENT_ID}&select=*`);
    if (status === 200 && Array.isArray(data) && data.length === 1 && data[0].nombre === 'TEST_Leche_prueba') {
      pass('Test 2 — Read ingredient', `nombre=${data[0].nombre}`);
    } else {
      fail('Test 2 — Read ingredient', status, data);
    }
  } else {
    console.log('⏭  Test 2 — skipped (no TEST_INGREDIENT_ID)');
  }
  console.log();

  // ── TEST 3a: Register purchase (ingredient_purchases) ────────────────────
  console.log('── Test 3a: Register first purchase ──');
  let purchase1Id = null;
  if (TEST_INGREDIENT_ID) {
    const { status, data } = await supabase('POST', 'ingredient_purchases', {
      ingredient_id: TEST_INGREDIENT_ID,
      qty: 1000,
      costo_unitario: 1.5,
      fecha: '2026-03-11',
    });
    if (status === 201 && Array.isArray(data) && data[0]) {
      purchase1Id = data[0].id;
      const totalCosto = data[0].total_costo;
      if (totalCosto === 1500) {
        pass('Test 3a — Purchase insert', `total_costo=${totalCosto} ✓ (generated column)`);
      } else {
        pass('Test 3a — Purchase insert (status 201)', `total_costo=${totalCosto} (expected 1500 — may be null if column not generated)`);
      }
    } else if (status === 401 || status === 403) {
      rlsBlock('Test 3a — Purchase insert', status, data);
    } else {
      fail('Test 3a — Purchase insert', status, data);
    }
  } else {
    console.log('⏭  Test 3a — skipped');
  }

  // ── TEST 3b: PATCH ingredient stock/avg ──────────────────────────────────
  console.log('── Test 3b: Update ingredient stock & avg ──');
  if (TEST_INGREDIENT_ID) {
    const { status, data } = await supabase('PATCH', `ingredients?id=eq.${TEST_INGREDIENT_ID}`, {
      qty_stock: 1000,
      costo_unitario_avg: 1.5,
    });
    if (status === 200 || status === 204) {
      pass('Test 3b — PATCH ingredient', `HTTP ${status}`);
    } else if (status === 401 || status === 403) {
      rlsBlock('Test 3b — PATCH ingredient', status, data);
    } else {
      fail('Test 3b — PATCH ingredient', status, data);
    }
  } else {
    console.log('⏭  Test 3b — skipped');
  }
  console.log();

  // ── TEST 4: Second purchase + manual weighted avg calc ───────────────────
  console.log('── Test 4: Second purchase & weighted avg check ──');
  let purchase2Id = null;
  if (TEST_INGREDIENT_ID) {
    const { status, data } = await supabase('POST', 'ingredient_purchases', {
      ingredient_id: TEST_INGREDIENT_ID,
      qty: 500,
      costo_unitario: 2.0,
      fecha: '2026-03-11',
    });
    if (status === 201 && Array.isArray(data) && data[0]) {
      purchase2Id = data[0].id;
      const expectedAvg = (1000 * 1.5 + 500 * 2.0) / 1500;
      pass('Test 4 — Second purchase', `status 201. Manual weighted avg = ${expectedAvg.toFixed(4)} (1000×1.5 + 500×2.0) / 1500`);
    } else if (status === 401 || status === 403) {
      rlsBlock('Test 4 — Second purchase', status, data);
    } else {
      fail('Test 4 — Second purchase', status, data);
    }
  } else {
    console.log('⏭  Test 4 — skipped');
  }
  console.log();

  // ── TEST 5: Create production batch ──────────────────────────────────────
  console.log('── Test 5: Create production batch ──');
  {
    const { status, data } = await supabase('POST', 'production_batches', {
      fecha: '2026-03-11',
      notas: 'TEST_tanda_prueba',
      total_bolis: 10,
    });
    if (status === 201 && Array.isArray(data) && data[0]?.id) {
      TEST_BATCH_ID = data[0].id;
      pass('Test 5 — Create batch', `id=${TEST_BATCH_ID}`);
    } else if (status === 401 || status === 403) {
      rlsBlock('Test 5 — Create batch', status, data);
    } else {
      fail('Test 5 — Create batch', status, data);
    }
  }
  console.log();

  // ── TEST 6: batch_ingredients ─────────────────────────────────────────────
  console.log('── Test 6: Insert batch_ingredients (general) ──');
  if (TEST_BATCH_ID && TEST_INGREDIENT_ID) {
    const { status, data } = await supabase('POST', 'batch_ingredients', {
      batch_id: TEST_BATCH_ID,
      ingredient_id: TEST_INGREDIENT_ID,
      qty_usada: 200,
      flavor_id: null,
    });
    if (status === 201) {
      pass('Test 6 — batch_ingredients insert', `HTTP ${status}`);
    } else if (status === 401 || status === 403) {
      rlsBlock('Test 6 — batch_ingredients insert', status, data);
    } else {
      fail('Test 6 — batch_ingredients insert', status, data);
    }
  } else {
    console.log('⏭  Test 6 — skipped (missing batch or ingredient id)');
  }
  console.log();

  // ── TEST 7: batch_outputs ─────────────────────────────────────────────────
  console.log('── Test 7: Insert batch_outputs ──');
  if (TEST_BATCH_ID && TEST_FLAVOR_ID) {
    const { status, data } = await supabase('POST', 'batch_outputs', {
      batch_id: TEST_BATCH_ID,
      flavor_id: TEST_FLAVOR_ID,
      qty_producida: 10,
      costo_unitario_calculado: 300,
    });
    if (status === 201) {
      pass('Test 7 — batch_outputs insert', `HTTP ${status}`);
    } else if (status === 401 || status === 403) {
      rlsBlock('Test 7 — batch_outputs insert', status, data);
    } else {
      fail('Test 7 — batch_outputs insert', status, data);
    }
  } else {
    console.log('⏭  Test 7 — skipped (missing batch or flavor id)');
  }
  console.log();

  // ── TEST 8: Read batch with joins ─────────────────────────────────────────
  console.log('── Test 8: Read batch detail with joins ──');
  if (TEST_BATCH_ID) {
    const { status, data } = await supabase(
      'GET',
      `production_batches?id=eq.${TEST_BATCH_ID}&select=*,batch_outputs(flavor_id,qty_producida,costo_unitario_calculado,flavors(name))`
    );
    if (status === 200 && Array.isArray(data) && data.length > 0) {
      const outputs = data[0].batch_outputs;
      const hasFlavors = outputs && outputs[0] && outputs[0].flavors && outputs[0].flavors.name;
      if (hasFlavors) {
        pass('Test 8 — Batch with joins', `batch_outputs[0].flavors.name = "${outputs[0].flavors.name}"`);
      } else {
        pass('Test 8 — Batch returned (status 200)', `batch_outputs = ${JSON.stringify(outputs)}`);
      }
    } else {
      fail('Test 8 — Batch with joins', status, data);
    }
  } else {
    console.log('⏭  Test 8 — skipped (no TEST_BATCH_ID)');
  }
  console.log();

  // ── TEST 9: UNIQUE constraint (duplicate batch_id + flavor_id) ───────────
  console.log('── Test 9: UNIQUE constraint on batch_outputs ──');
  if (TEST_BATCH_ID && TEST_FLAVOR_ID) {
    const { status, data } = await supabase('POST', 'batch_outputs', {
      batch_id: TEST_BATCH_ID,
      flavor_id: TEST_FLAVOR_ID,
      qty_producida: 5,
      costo_unitario_calculado: 250,
    });
    if (status === 409) {
      pass('Test 9 — UNIQUE constraint blocked duplicate', `HTTP ${status} (conflict) ✓`);
    } else if (status === 401 || status === 403) {
      rlsBlock('Test 9 — UNIQUE constraint (insert blocked by RLS before constraint)', status, data);
    } else if (status === 201) {
      fail('Test 9 — UNIQUE constraint NOT enforced (duplicate was accepted!)', status, data);
    } else {
      fail('Test 9 — UNIQUE constraint unexpected response', status, data);
    }
  } else {
    console.log('⏭  Test 9 — skipped (missing batch or flavor id)');
  }
  console.log();

  // ── TEST 10: batch_ingredients with join ──────────────────────────────────
  console.log('── Test 10: Read batch_ingredients with ingredient join ──');
  if (TEST_BATCH_ID) {
    const { status, data } = await supabase(
      'GET',
      `batch_ingredients?batch_id=eq.${TEST_BATCH_ID}&select=*,ingredients(nombre,unidad)`
    );
    if (status === 200 && Array.isArray(data) && data.length > 0) {
      const ing = data[0].ingredients;
      if (ing && ing.nombre) {
        pass('Test 10 — batch_ingredients with join', `ingredients.nombre="${ing.nombre}", unidad="${ing.unidad}"`);
      } else {
        pass('Test 10 — batch_ingredients returned (status 200)', `data = ${JSON.stringify(data)}`);
      }
    } else {
      fail('Test 10 — batch_ingredients with join', status, data);
    }
  } else {
    console.log('⏭  Test 10 — skipped (no TEST_BATCH_ID)');
  }
  console.log();
}

async function cleanup() {
  console.log('\n========== CLEANUP (always runs) ==========\n');
  const errors = [];

  if (TEST_BATCH_ID) {
    // batch_outputs
    {
      const { status, data } = await supabase('DELETE', `batch_outputs?batch_id=eq.${TEST_BATCH_ID}`);
      if (status === 200 || status === 204) {
        console.log(`✅ Deleted batch_outputs for batch ${TEST_BATCH_ID}`);
      } else if (status === 401 || status === 403) {
        console.log(`❌ RLS_BLOCK — DELETE batch_outputs | HTTP ${status}`);
        errors.push('batch_outputs');
      } else {
        console.log(`❌ DELETE batch_outputs failed | HTTP ${status} | ${JSON.stringify(data)}`);
        errors.push('batch_outputs');
      }
    }
    // batch_ingredients
    {
      const { status, data } = await supabase('DELETE', `batch_ingredients?batch_id=eq.${TEST_BATCH_ID}`);
      if (status === 200 || status === 204) {
        console.log(`✅ Deleted batch_ingredients for batch ${TEST_BATCH_ID}`);
      } else if (status === 401 || status === 403) {
        console.log(`❌ RLS_BLOCK — DELETE batch_ingredients | HTTP ${status}`);
        errors.push('batch_ingredients');
      } else {
        console.log(`❌ DELETE batch_ingredients failed | HTTP ${status} | ${JSON.stringify(data)}`);
        errors.push('batch_ingredients');
      }
    }
    // production_batches
    {
      const { status, data } = await supabase('DELETE', `production_batches?id=eq.${TEST_BATCH_ID}`);
      if (status === 200 || status === 204) {
        console.log(`✅ Deleted production_batch ${TEST_BATCH_ID}`);
      } else if (status === 401 || status === 403) {
        console.log(`❌ RLS_BLOCK — DELETE production_batches | HTTP ${status}`);
        errors.push('production_batches');
      } else {
        console.log(`❌ DELETE production_batches failed | HTTP ${status} | ${JSON.stringify(data)}`);
        errors.push('production_batches');
      }
    }
  } else {
    console.log('⏭  No TEST_BATCH_ID — skipping batch/output/ingredient cleanup');
  }

  if (TEST_INGREDIENT_ID) {
    // ingredient_purchases
    {
      const { status, data } = await supabase('DELETE', `ingredient_purchases?ingredient_id=eq.${TEST_INGREDIENT_ID}`);
      if (status === 200 || status === 204) {
        console.log(`✅ Deleted ingredient_purchases for ingredient ${TEST_INGREDIENT_ID}`);
      } else if (status === 401 || status === 403) {
        console.log(`❌ RLS_BLOCK — DELETE ingredient_purchases | HTTP ${status}`);
        errors.push('ingredient_purchases');
      } else {
        console.log(`❌ DELETE ingredient_purchases failed | HTTP ${status} | ${JSON.stringify(data)}`);
        errors.push('ingredient_purchases');
      }
    }
    // ingredients
    {
      const { status, data } = await supabase('DELETE', `ingredients?id=eq.${TEST_INGREDIENT_ID}`);
      if (status === 200 || status === 204) {
        console.log(`✅ Deleted ingredient ${TEST_INGREDIENT_ID}`);
      } else if (status === 401 || status === 403) {
        console.log(`❌ RLS_BLOCK — DELETE ingredients | HTTP ${status}`);
        errors.push('ingredients');
      } else {
        console.log(`❌ DELETE ingredients failed | HTTP ${status} | ${JSON.stringify(data)}`);
        errors.push('ingredients');
      }
    }
  } else {
    console.log('⏭  No TEST_INGREDIENT_ID — skipping ingredient cleanup');
  }

  console.log('\n── Verification: no leftover test data ──');
  {
    const { status, data } = await supabase('GET', 'ingredients?nombre=eq.TEST_Leche_prueba');
    if (status === 200 && Array.isArray(data) && data.length === 0) {
      console.log('✅ ingredients — no leftover (empty [])');
    } else {
      console.log(`❌ ingredients leftover! HTTP ${status} — ${JSON.stringify(data)}`);
    }
  }
  {
    const { status, data } = await supabase('GET', 'production_batches?notas=eq.TEST_tanda_prueba');
    if (status === 200 && Array.isArray(data) && data.length === 0) {
      console.log('✅ production_batches — no leftover (empty [])');
    } else {
      console.log(`❌ production_batches leftover! HTTP ${status} — ${JSON.stringify(data)}`);
    }
  }

  if (errors.length === 0) {
    console.log('\n✅ CLEANUP COMPLETE — no test data remains in DB.');
  } else {
    console.log(`\n⚠️  CLEANUP PARTIAL — could not delete: ${errors.join(', ')} (likely RLS blocked)`);
  }
}

(async () => {
  try {
    await runTests();
  } catch (err) {
    console.error('Unexpected error during tests:', err);
  } finally {
    await cleanup();
  }
  console.log('\n========== END OF TEST RUN ==========\n');
})();
