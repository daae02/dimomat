// ================================================
// CONFIGURACION BOLIS GOURMET
// ================================================
// IMPORTANTE: Copia este archivo como js/config.js
// y actualiza los valores con tus datos reales.

// Supabase - Obten estos valores en: Settings > API en tu proyecto Supabase
const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...TU_ANON_KEY...';

// URL de las Edge Functions (misma URL base de Supabase + /functions/v1)
// Se construye automaticamente desde SUPABASE_URL
const FUNCTIONS_URL = SUPABASE_URL !== 'https://TU_PROYECTO.supabase.co'
  ? SUPABASE_URL + '/functions/v1'
  : null;

// WhatsApp - Numero con codigo de pais, sin espacios ni guiones
// Ejemplo Mexico: '5219XXXXXXXXXX'
const WHATSAPP_NUMBER = '5219XXXXXXXXXX';

// Nombre del negocio (aparece en mensajes y titulos)
const BUSINESS_NAME = 'Bolis Gourmet';

// Moneda (simbolo)
const CURRENCY_SYMBOL = '$';
