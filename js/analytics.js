// ================================================
// ANALYTICS — Bolis Dimomat
// Registra comportamiento de visitantes sin datos personales ni cookies.
//   · session_id: ID aleatorio en sessionStorage (desaparece al cerrar pestaña)
//   · device: mobile/tablet/desktop derivado de window.innerWidth
//   · No se almacena IP, nombre, ni ningún dato personal
// ================================================

(function () {
  'use strict';

  // ID de sesión efímero: vive solo en esta pestaña
  function getSessionId() {
    var key = 'bolis_sid';
    var sid = sessionStorage.getItem(key);
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(key, sid);
    }
    return sid;
  }

  function getDevice() {
    var w = window.innerWidth;
    if (w <= 640)  return 'mobile';
    if (w <= 1024) return 'tablet';
    return 'desktop';
  }

  var SESSION_ID = getSessionId();
  var PAGE_START = Date.now();

  // track(event, props) — inserción fire-and-forget, nunca bloquea la UI
  window.track = function (event, props) {
    try {
      if (!window.supabaseClient) return;
      window.supabaseClient.from('page_events').insert({
        session_id: SESSION_ID,
        event:      event,
        props:      props || {},
        device:     getDevice(),
        referrer:   document.referrer || null
      }).then(function () {});
    } catch (e) {}
  };

  // Pageview automático al cargar
  document.addEventListener('DOMContentLoaded', function () {
    track('pageview', { path: location.pathname });
  });

  // Tiempo en página al salir o cambiar de pestaña
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      track('page_leave', {
        seconds_on_page: Math.round((Date.now() - PAGE_START) / 1000)
      });
    }
  });

})();
