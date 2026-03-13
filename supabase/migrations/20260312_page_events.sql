-- Tabla de eventos de comportamiento de visitantes (sin datos personales)
-- session_id: ID aleatorio de sessionStorage (efímero, por pestaña)
-- event: tipo de evento (pageview, add_to_cart, cart_open, search, filter, whatsapp_order, page_leave)
-- props: metadatos JSON (flavor_id, query, category, etc.) — nunca datos personales
-- device: mobile | tablet | desktop (derivado de window.innerWidth)

CREATE TABLE IF NOT EXISTS page_events (
  id          bigserial    PRIMARY KEY,
  session_id  text         NOT NULL,
  event       text         NOT NULL,
  props       jsonb        NOT NULL DEFAULT '{}',
  device      text,
  referrer    text,
  created_at  timestamptz  NOT NULL DEFAULT now()
);

-- Índices para consultas del dashboard
CREATE INDEX IF NOT EXISTS idx_page_events_created  ON page_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_events_event    ON page_events (event);
CREATE INDEX IF NOT EXISTS idx_page_events_session  ON page_events (session_id);

-- RLS: cualquiera puede insertar (no se almacena PII), solo admin puede leer
ALTER TABLE page_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "page_events_insert" ON page_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "page_events_read" ON page_events
  FOR SELECT USING (auth.role() = 'authenticated');
