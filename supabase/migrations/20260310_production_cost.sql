ALTER TABLE flavors ADD COLUMN IF NOT EXISTS production_cost DECIMAL(10,2) DEFAULT 0;
COMMENT ON COLUMN flavors.production_cost IS 'Costo de produccion por unidad en colones';
