// ================================================
// PEDIDO POR WHATSAPP - Bolis Dimomat
// ================================================
// Guarda la orden en Supabase (via Edge Function) y abre WhatsApp
// con el numero de pedido incluido en el mensaje.


function formatColones(amount) {
  var value = normalizeAmount(amount);
  return value.toLocaleString('es-CR', { style: 'currency', currency: 'CRC', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeAmount(amount) {
  if (typeof amount === 'number') return Number.isFinite(amount) ? amount : 0;
  if (typeof amount !== 'string') return Number(amount) || 0;

  var raw = amount.trim();
  if (!raw) return 0;
  var cleaned = raw.replace(/[^\d,.-]/g, '');
  if (cleaned.indexOf(',') !== -1 && cleaned.indexOf('.') === -1) {
    cleaned = cleaned.replace(',', '.');
  } else {
    cleaned = cleaned.replace(/,/g, '');
  }
  var parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatWhatsAppMessage(orderNumber, customerName) {
  var cart = getCart();
  if (cart.length === 0) return '';

  var bizName = typeof BUSINESS_NAME !== 'undefined' ? BUSINESS_NAME : 'Bolis Dimomat';

  var lines = [
    'Hola, me gustaria hacer el siguiente pedido de *' + bizName + '*:',
    '',
    'Nombre: ' + customerName,
    '',
    '*Mi Pedido:*'
  ];

  for (var i = 0; i < cart.length; i++) {
    var item = cart[i];
    lines.push('- ' + item.name + ' x' + item.quantity + ' - ' + formatColones(normalizeAmount(item.price) * item.quantity));
  }

  lines.push('');
  lines.push('*Total: ' + formatColones(getTotal()) + '*');

  if (orderNumber) {
    lines.push('');
    lines.push('*Numero de pedido: ' + orderNumber + '*');
  }

  lines.push('');
  lines.push('Por favor confirmar disponibilidad. Muchas gracias.');

  return lines.join('\n');
}

function getCustomerNameFromUI() {
  var input = document.getElementById('customer-name-input');
  if (!input) return '';
  return (input.value || '').trim();
}

function updateWhatsAppOrderButtonState() {
  var btn = document.getElementById('whatsapp-order-btn');
  if (!btn) return;
  var cart = typeof getCart === 'function' ? getCart() : [];
  var hasName = getCustomerNameFromUI().length > 0;
  btn.disabled = cart.length === 0 || !hasName;
}

// Guarda la orden en Supabase y abre WhatsApp
async function sendWhatsAppOrder() {
  var cart = getCart();
  if (cart.length === 0) {
    alert('Tu carrito esta vacio. Agrega algunos bolis primero.');
    return;
  }

  var number = typeof WHATSAPP_NUMBER !== 'undefined' ? WHATSAPP_NUMBER : '';
  if (!number || number === '5219XXXXXXXXXX') {
    alert('El numero de WhatsApp no esta configurado.\nContacta al administrador.');
    return;
  }

  var customerName = getCustomerNameFromUI();
  if (!customerName) {
    alert('Ingresa tu nombre en el campo del carrito para enviar el pedido.');
    var nameInput = document.getElementById('customer-name-input');
    if (nameInput) nameInput.focus();
    updateWhatsAppOrderButtonState();
    return;
  }

  var btn = document.getElementById('whatsapp-order-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Generando pedido...';
  }

  var orderNumber = null;

  // Intentar guardar la orden en Supabase
  try {
    orderNumber = await saveOrderToSupabase(cart, customerName);
  } catch (e) {
    console.warn('No se pudo guardar la orden en Supabase:', e.message);
    // Continuar de todas formas: el pedido sigue yendo por WhatsApp
  }

  // Abrir WhatsApp con el mensaje (con o sin numero de pedido)
  var message = formatWhatsAppMessage(orderNumber, customerName);
  var url = 'https://wa.me/' + number + '?text=' + encodeURIComponent(message);
  window.open(url, '_blank');

  // Al iniciar el envio por WhatsApp, vaciar carrito local.
  clearCart();
  if (typeof closeCart === 'function') closeCart();

  // Si se genero numero de pedido, mostrar confirmacion
  if (orderNumber) {
    showOrderConfirmation(orderNumber);
  }

  // Restaurar boton
  if (btn) {
    btn.disabled = false;
    btn.textContent = 'Hacer Pedido por WhatsApp';
  }
  updateWhatsAppOrderButtonState();
}

// Llama a la Edge Function create-order y retorna el numero de pedido
async function saveOrderToSupabase(cart, customerName) {
  var functionsUrl = typeof FUNCTIONS_URL !== 'undefined' ? FUNCTIONS_URL : null;
  var anonKey = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : null;

  if (!functionsUrl || !anonKey || anonKey === 'YOUR_SUPABASE_ANON_KEY_HERE') {
    throw new Error('Supabase no configurado');
  }

  var items = cart.map(function (item) {
    return {
      flavor_id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity
    };
  });

  var response = await fetch(functionsUrl + '/create-order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: 'Bearer ' + anonKey
    },
    body: JSON.stringify({
      items: items,
      total: getTotal(),
      customer_name: customerName
    })
  });

  if (!response.ok) {
    var err = await response.json().catch(function () { return {}; });
    throw new Error(err.error || 'Error ' + response.status);
  }

  var data = await response.json();
  return data.order_number;
}

// Muestra un mensaje de confirmacion con el numero de pedido
function showOrderConfirmation(orderNumber) {
  var existing = document.getElementById('order-confirm-toast');
  if (existing) existing.remove();

  var toast = document.createElement('div');
  toast.id = 'order-confirm-toast';
  toast.style.cssText = [
    'position:fixed', 'bottom:1.5rem', 'left:50%',
    'transform:translateX(-50%)', 'background:#2D3748',
    'color:white', 'padding:1rem 1.5rem', 'border-radius:12px',
    'z-index:500', 'text-align:center', 'box-shadow:0 4px 20px rgba(0,0,0,0.3)',
    'font-family:Nunito,sans-serif', 'max-width:320px', 'width:90%'
  ].join(';');

  toast.innerHTML = '<p style="font-weight:800;font-size:1.05rem;margin:0 0 0.25rem">Pedido registrado</p>' +
    '<p style="font-size:0.9rem;margin:0 0 0.5rem;opacity:0.8">Tu numero de pedido es:</p>' +
    '<p style="font-family:\'Pacifico\',cursive;font-size:1.4rem;color:#FFD93D;margin:0">' + orderNumber + '</p>' +
    '<p style="font-size:0.8rem;margin:0.5rem 0 0;opacity:0.7">Guardalo para seguimiento</p>';

  document.body.appendChild(toast);
  setTimeout(function () { if (toast.parentNode) toast.remove(); }, 8000);
}

document.addEventListener('DOMContentLoaded', function () {
  var nameInput = document.getElementById('customer-name-input');
  if (!nameInput) return;
  nameInput.addEventListener('input', updateWhatsAppOrderButtonState);
  updateWhatsAppOrderButtonState();
});
