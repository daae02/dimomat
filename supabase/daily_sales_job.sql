-- ================================================
-- DAILY FLAVOR SALES — TIME SERIES
-- ================================================
-- Recopila las ventas del día anterior agrupadas por sabor.
-- Formato listo para Prophet: sale_date = ds, units_sold = y
--
-- REQUISITO: Habilitar la extensión pg_cron en Supabase
--   → Dashboard → Database → Extensions → pg_cron → Enable
-- ================================================


-- ================================================
-- 1. TABLA DE SERIE TEMPORAL
-- ================================================

CREATE TABLE IF NOT EXISTS daily_flavor_sales (
  id          UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_date   DATE          NOT NULL,
  flavor_name TEXT          NOT NULL,
  units_sold  INTEGER       NOT NULL DEFAULT 0,
  revenue     DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (sale_date, flavor_name)
);

-- Índices para consultas por fecha o sabor
CREATE INDEX IF NOT EXISTS idx_dfs_sale_date    ON daily_flavor_sales (sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_dfs_flavor_name  ON daily_flavor_sales (flavor_name);

-- RLS: cualquiera puede leer, solo el sistema puede escribir
ALTER TABLE daily_flavor_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read daily_flavor_sales"
  ON daily_flavor_sales FOR SELECT USING (true);

CREATE POLICY "Service role write daily_flavor_sales"
  ON daily_flavor_sales FOR ALL
  USING (auth.role() = 'service_role');


-- ================================================
-- 2. FUNCIÓN DE AGREGACIÓN
-- ================================================
-- Toma todas las órdenes PROCESADAS de target_date,
-- desglosa sus items (JSONB) y suma unidades + ingresos por sabor.
-- Si se llama dos veces para el mismo día, sobreescribe (upsert).

CREATE OR REPLACE FUNCTION aggregate_daily_flavor_sales(
  target_date DATE DEFAULT (CURRENT_DATE - INTERVAL '1 day')::DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- corre como owner, bypasa RLS para poder insertar
AS $$
BEGIN
  INSERT INTO daily_flavor_sales (sale_date, flavor_name, units_sold, revenue)
  SELECT
    target_date                                                         AS sale_date,
    item ->> 'name'                                                     AS flavor_name,
    SUM((item ->> 'quantity')::INTEGER)                                 AS units_sold,
    SUM((item ->> 'price')::DECIMAL * (item ->> 'quantity')::INTEGER)   AS revenue
  FROM
    orders,
    LATERAL jsonb_array_elements(items) AS item
  WHERE
    status      = 'processed'
    AND DATE(COALESCE(processed_at, created_at)) = target_date
    AND item ->> 'name' IS NOT NULL
  GROUP BY
    item ->> 'name'
  ON CONFLICT (sale_date, flavor_name)
    DO UPDATE SET
      units_sold = EXCLUDED.units_sold,
      revenue    = EXCLUDED.revenue;
END;
$$;


-- ================================================
-- 3. JOB DIARIO CON pg_cron
-- ================================================
-- Corre a las 2:00 AM todos los días y agrega el día anterior.
-- Si el job ya existe con ese nombre, lo elimina y lo recrea.

SELECT cron.unschedule('aggregate-daily-flavor-sales')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'aggregate-daily-flavor-sales'
  );

SELECT cron.schedule(
  'aggregate-daily-flavor-sales',       -- nombre del job
  '0 2 * * *',                          -- cron: 2:00 AM cada día
  $job$SELECT aggregate_daily_flavor_sales()$job$
);


-- ================================================
-- 4. BACKFILL HISTÓRICO (ejecutar manualmente)
-- ================================================
-- Si ya tienes órdenes procesadas anteriores, puedes rellenar
-- los días que faltan ejecutando esto en el SQL Editor:
--
--   SELECT aggregate_daily_flavor_sales(d::DATE)
--   FROM generate_series(
--     '2026-01-01'::DATE,
--     CURRENT_DATE - 1,
--     '1 day'::INTERVAL
--   ) AS d;
--
-- Esto rellena desde el 1 de enero hasta ayer en un solo comando.


-- ================================================
-- 5. CONSULTA BASE PARA PROPHET (referencia)
-- ================================================
-- Para exportar los datos de un sabor en formato ds/y:
--
--   SELECT
--     sale_date  AS ds,
--     units_sold AS y
--   FROM daily_flavor_sales
--   WHERE flavor_name = 'Fresa Natural'
--   ORDER BY sale_date;
--
-- Para ver todos los sabores ordenados:
--
--   SELECT sale_date, flavor_name, units_sold, revenue
--   FROM daily_flavor_sales
--   ORDER BY sale_date DESC, units_sold DESC;
