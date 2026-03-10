// ================================================
// EDGE FUNCTION: create-order
// ================================================
// Recibe el carrito del cliente, guarda la orden en Supabase
// y retorna el numero de orden.
// No requiere autenticacion (cliente anonimo).
//
// Uso:
//   POST /functions/v1/create-order
//   Body: { items: [{ flavor_id, name, price, quantity }], total: 85.00, customer_name: "Nombre" }
// ================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail } from '../_shared/email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};


async function sendOrderNotificationEmail(order: {
  order_number: string;
  customer_name: string;
  total: number;
  items: Array<{ name: string; quantity: number; price: number }>;
  created_at: string;
}) {
  const recipient = Deno.env.get('ORDER_ALERT_EMAIL');
  if (!recipient) {
    console.warn('[create-order] ORDER_ALERT_EMAIL no configurado, se omite notificacion');
    return;
  }

  const itemsHtml = order.items
    .map((item) => `<li>${item.quantity} x ${item.name} — ₡${item.price.toFixed(2)}</li>`)
    .join('');

  const subject = `🧊 Nueva orden ${order.order_number}`;
  const text = [
    `Nueva orden: ${order.order_number}`,
    `Cliente: ${order.customer_name}`,
    `Total: ₡${order.total.toFixed(2)}`,
    `Fecha: ${order.created_at}`,
    '',
    'Items:',
    ...order.items.map((item) => `- ${item.quantity} x ${item.name} (₡${item.price.toFixed(2)})`),
  ].join('\n');

  const html = `
    <h2>Nueva orden recibida: ${order.order_number}</h2>
    <p><strong>Cliente:</strong> ${order.customer_name}</p>
    <p><strong>Total:</strong> ₡${order.total.toFixed(2)}</p>
    <p><strong>Fecha:</strong> ${new Date(order.created_at).toLocaleString('es-CR')}</p>
    <h3>Detalle</h3>
    <ul>${itemsHtml}</ul>
  `;

  await sendEmail({
    to: recipient,
    subject,
    text,
    html,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Metodo no permitido' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { items, total, customer_name } = body ?? {};

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'El carrito esta vacio' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (typeof total !== 'number' || total <= 0) {
      return new Response(JSON.stringify({ error: 'Total invalido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!customer_name || typeof customer_name !== 'string' || customer_name.trim().length < 2) {
      return new Response(JSON.stringify({ error: 'Nombre del cliente invalido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    for (const item of items) {
      if (!item.name || typeof item.price !== 'number' || typeof item.quantity !== 'number') {
        return new Response(JSON.stringify({ error: 'Formato de items invalido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from('orders')
      .insert([{
        items: items,
        total: total,
        status: 'pending',
        customer_name: customer_name.trim(),
      }])
      .select('id, order_number, created_at')
      .single();

    if (error) {
      console.error('Error creando orden:', error);
      return new Response(JSON.stringify({ error: 'Error al crear la orden: ' + error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      await sendOrderNotificationEmail({
        order_number: data.order_number,
        customer_name: customer_name.trim(),
        total,
        items: items,
        created_at: data.created_at,
      });
    } catch (emailError) {
      console.error('[create-order] Error enviando email de nueva orden:', emailError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_number: data.order_number,
        order_id: data.id,
        created_at: data.created_at,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('Error inesperado:', err);
    return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
