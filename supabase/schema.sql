-- ================================================
-- SCHEMA BOLIS DIMOMAT
-- Ejecutar en Supabase SQL Editor
-- ================================================

-- Tabla principal de sabores
CREATE TABLE IF NOT EXISTS flavors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL CHECK (price > 0),
  stock INTEGER DEFAULT 0 CHECK (stock >= 0),
  image_url TEXT,
  category VARCHAR(50) DEFAULT 'clasico' CHECK (category IN ('clasico', 'frutal', 'cremoso', 'picante', 'especial')),
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger para actualizar updated_at en flavors
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_flavors_updated_at
  BEFORE UPDATE ON flavors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS en flavors
ALTER TABLE flavors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read flavors"
  ON flavors FOR SELECT USING (true);

CREATE POLICY "Authenticated insert flavors"
  ON flavors FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated update flavors"
  ON flavors FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated delete flavors"
  ON flavors FOR DELETE
  USING (auth.role() = 'authenticated');

-- ================================================
-- TABLA DE ORDENES
-- ================================================

-- Secuencia para número de orden auto-incremental
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number VARCHAR(20) UNIQUE NOT NULL DEFAULT ('BG-' || LPAD(nextval('order_number_seq')::TEXT, 4, '0')),
  items JSONB NOT NULL,
  -- items: [{ "flavor_id": "uuid", "name": "Fresa", "price": 20.00, "quantity": 2 }]
  total DECIMAL(10,2) NOT NULL,
  customer_name VARCHAR(100),
  customer_notes TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processed', 'cancelled')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Habilitar RLS en orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Clientes anónimos pueden crear órdenes (necesario para generar el pedido sin login)
CREATE POLICY "Public insert orders"
  ON orders FOR INSERT
  WITH CHECK (true);

-- Solo autenticados pueden leer y gestionar órdenes
CREATE POLICY "Authenticated read orders"
  ON orders FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated update orders"
  ON orders FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated delete orders"
  ON orders FOR DELETE
  USING (auth.role() = 'authenticated');

-- ================================================
-- STORAGE
-- ================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bolis-images',
  'bolis-images',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read bolis images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bolis-images');

CREATE POLICY "Authenticated upload bolis images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'bolis-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated delete bolis images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'bolis-images' AND auth.role() = 'authenticated');

-- ================================================
-- TABLA DE CATEGORIAS
-- ================================================

-- Eliminar el CHECK hardcodeado en flavors.category si existe
ALTER TABLE flavors DROP CONSTRAINT IF EXISTS flavors_category_check;

CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  emoji VARCHAR(10) DEFAULT '🍦',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read categories"
  ON categories FOR SELECT USING (true);

CREATE POLICY "Authenticated insert categories"
  ON categories FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated update categories"
  ON categories FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated delete categories"
  ON categories FOR DELETE
  USING (auth.role() = 'authenticated');

-- Categorías por defecto
INSERT INTO categories (name, slug, emoji, sort_order) VALUES
  ('Clásico',  'clasico',  '🧊',  1),
  ('Frutal',   'frutal',   '🍓',  2),
  ('Cremoso',  'cremoso',  '🍦',  3),
  ('Picante',  'picante',  '🌶️', 4),
  ('Especial', 'especial', '⭐',  5)
ON CONFLICT (slug) DO NOTHING;

-- ================================================
-- MIGRACIÓN: flavors.category (slug) → category_id (FK)
-- ================================================

-- Agregar columna FK (si ya existe, no hace nada)
ALTER TABLE flavors
  ADD COLUMN IF NOT EXISTS category_id UUID
  REFERENCES categories(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- Rellenar category_id desde el slug de category (solo filas donde category_id está vacío)
UPDATE flavors f
SET category_id = c.id
FROM categories c
WHERE c.slug = f.category
  AND f.category_id IS NULL;

-- Eliminar columna antigua de slug (una vez migrados los datos)
ALTER TABLE flavors DROP COLUMN IF EXISTS category;

-- ================================================
-- DATOS DE MUESTRA
-- ================================================

INSERT INTO flavors (name, description, price, stock, category_id, is_available) VALUES
  ('Fresa Natural',       'Deliciosas fresas frescas de temporada con un toque de leche condensada. Sabor auténtico y refrescante.',    20.00, 50, (SELECT id FROM categories WHERE slug = 'frutal'),   true),
  ('Mango Chamoy',        'Mango natural del Valle de México con nuestro chamoy especial y chile piquín. ¡Irresistible!',               25.00, 30, (SELECT id FROM categories WHERE slug = 'picante'),  true),
  ('Tamarindo Enchilado', 'Tamarindo auténtico con mezcla especial de chile, sal y limón. El favorito de los atrevidos.',               20.00, 40, (SELECT id FROM categories WHERE slug = 'picante'),  true),
  ('Nuez y Cajeta',       'Cremoso de cajeta artesanal de cabra con generosos trozos de nuez. Sabor gourmet único.',                    30.00, 20, (SELECT id FROM categories WHERE slug = 'cremoso'),  true),
  ('Limón con Chile',     'Explosión de limón fresco con chile piquín. Refrescante y picosito a la vez.',                               20.00, 35, (SELECT id FROM categories WHERE slug = 'picante'),  true),
  ('Horchata Canela',     'Horchata tradicional con canela molida. Cremoso, dulce y reconfortante.',                                    25.00, 25, (SELECT id FROM categories WHERE slug = 'cremoso'),  true),
  ('Guanábana Cremosa',   'Pulpa natural de guanábana con crema. Exótico, tropical y delicioso.',                                       28.00, 15, (SELECT id FROM categories WHERE slug = 'frutal'),   true),
  ('Oreo y Crema',        'Galletas Oreo trituradas con crema batida. El favorito de niños y adultos.',                                 30.00,  0, (SELECT id FROM categories WHERE slug = 'cremoso'),  false);
