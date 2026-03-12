-- ================================================
-- MÓDULO DE COSTOS DE PRODUCCIÓN
-- ================================================

-- INGREDIENTES
CREATE TABLE IF NOT EXISTS ingredients (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre             VARCHAR(100) NOT NULL,
  unidad             VARCHAR(20)  NOT NULL,       -- 'g', 'ml', 'unidad', 'kg', 'L'
  qty_stock          DECIMAL(12,3) DEFAULT 0 CHECK (qty_stock >= 0),
  costo_unitario_avg DECIMAL(12,4) DEFAULT 0 CHECK (costo_unitario_avg >= 0),
  notas              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_ingredients_updated_at
  BEFORE UPDATE ON ingredients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read ingredients"  ON ingredients FOR SELECT USING (true);
CREATE POLICY "Auth insert ingredients"  ON ingredients FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth update ingredients"  ON ingredients FOR UPDATE USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth delete ingredients"  ON ingredients FOR DELETE USING (auth.role() = 'authenticated');

-- COMPRAS DE INGREDIENTES (historial de precios)
CREATE TABLE IF NOT EXISTS ingredient_purchases (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ingredient_id  UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
  qty            DECIMAL(12,3) NOT NULL CHECK (qty > 0),
  costo_unitario DECIMAL(12,4) NOT NULL CHECK (costo_unitario >= 0),
  total_costo    DECIMAL(12,4) GENERATED ALWAYS AS (qty * costo_unitario) STORED,
  fecha          DATE NOT NULL DEFAULT CURRENT_DATE,
  notas          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ingredient_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read purchases"   ON ingredient_purchases FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth insert purchases" ON ingredient_purchases FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth update purchases" ON ingredient_purchases FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth delete purchases" ON ingredient_purchases FOR DELETE USING (auth.role() = 'authenticated');

-- TANDAS DE PRODUCCIÓN
CREATE TABLE IF NOT EXISTS production_batches (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  notas       TEXT,
  total_bolis INTEGER NOT NULL DEFAULT 0 CHECK (total_bolis >= 0),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE production_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read batches"   ON production_batches FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth insert batches" ON production_batches FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth update batches" ON production_batches FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth delete batches" ON production_batches FOR DELETE USING (auth.role() = 'authenticated');

-- INGREDIENTES USADOS EN UNA TANDA
-- flavor_id NULL = ingrediente general (compartido por toda la tanda)
-- flavor_id != NULL = ingrediente específico de ese sabor
CREATE TABLE IF NOT EXISTS batch_ingredients (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id      UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  qty_usada     DECIMAL(12,3) NOT NULL CHECK (qty_usada > 0),
  flavor_id     UUID REFERENCES flavors(id) ON DELETE SET NULL
);

ALTER TABLE batch_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read batch_ingredients"   ON batch_ingredients FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth insert batch_ingredients" ON batch_ingredients FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth update batch_ingredients" ON batch_ingredients FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth delete batch_ingredients" ON batch_ingredients FOR DELETE USING (auth.role() = 'authenticated');

-- SALIDAS DE UNA TANDA (bolis producidos por sabor)
CREATE TABLE IF NOT EXISTS batch_outputs (
  id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id                 UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  flavor_id                UUID NOT NULL REFERENCES flavors(id) ON DELETE RESTRICT,
  qty_producida            INTEGER NOT NULL CHECK (qty_producida > 0),
  costo_unitario_calculado DECIMAL(12,4) DEFAULT 0,
  UNIQUE(batch_id, flavor_id)
);

ALTER TABLE batch_outputs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read batch_outputs"   ON batch_outputs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Auth insert batch_outputs" ON batch_outputs FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Auth update batch_outputs" ON batch_outputs FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Auth delete batch_outputs" ON batch_outputs FOR DELETE USING (auth.role() = 'authenticated');
