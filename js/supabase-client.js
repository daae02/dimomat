// ================================================
// CLIENTE SUPABASE
// ================================================
// Requiere: config.js cargado antes que este archivo

let supabaseClient = null;

function initSupabase() {
  if (typeof SUPABASE_URL === 'undefined' || SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE') {
    console.warn('⚠️ Supabase no configurado. Actualiza js/config.js con tus credenciales.');
    return null;
  }

  try {
    const { createClient } = supabase; // supabase-js CDN expone window.supabase
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase conectado correctamente');
    return supabaseClient;
  } catch (error) {
    console.error('❌ Error al conectar con Supabase:', error);
    return null;
  }
}

// Inicializar al cargar
supabaseClient = initSupabase();
window.supabaseClient = supabaseClient;
