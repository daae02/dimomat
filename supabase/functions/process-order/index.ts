// ================================================
// EDGE FUNCTION: process-order
// ================================================
// Procesa una orden: descuenta inventario y marca la orden como procesada.
// Requiere autenticacion de administrador (JWT de Supabase Auth).
// ================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const authHeader = req.headers.get('Authorization');
    console.log('[process-order][debug] hasAuthHeader=', !!authHeader, 'authHeaderLen=', authHeader ? authHeader.length : 0);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Faltan variables de entorno de Supabase en la Function' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cliente con service role para auth y operaciones privilegiadas.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.slice('Bearer '.length).trim();
    console.log('[process-order][debug] tokenLen=', token.length, 'tokenPrefix=', token.slice(0, 20));
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Sesion invalida o expirada' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { order_id, items, admin_notes } = body ?? {};

    if (!order_id || !items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'Datos incompletos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizedItems = items
      .map((item: any) => ({
        flavor_id: item?.flavor_id ?? item?.id ?? null,
        name: String(item?.name ?? ''),
        price: Number(item?.price ?? 0),
        quantity: Math.max(0, Number(item?.quantity ?? 0)),
      }))
      .filter((item: any) => item.quantity > 0);

    if (normalizedItems.length === 0) {
      return new Response(JSON.stringify({ error: 'No hay items validos para procesar' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1) Verificar que la orden existe y sigue pendiente.
    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, order_number, status')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Orden no encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (order.status === 'processed') {
      return new Response(JSON.stringify({ error: 'Esta orden ya fue procesada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (order.status === 'cancelled') {
      return new Response(JSON.stringify({ error: 'Esta orden fue cancelada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2) Validar stock para todos los items con flavor_id.
    const stockErrors: string[] = [];
    for (const item of normalizedItems) {
      if (!item.flavor_id) continue;

      const { data: flavor, error: flavorError } = await adminClient
        .from('flavors')
        .select('id, name, stock')
        .eq('id', item.flavor_id)
        .single();

      if (flavorError || !flavor) {
        stockErrors.push(`Sabor "${item.name}" no encontrado`);
        continue;
      }

      if (flavor.stock < item.quantity) {
        stockErrors.push(`"${flavor.name}": solo hay ${flavor.stock} disponibles, se piden ${item.quantity}`);
      }
    }

    if (stockErrors.length > 0) {
      return new Response(JSON.stringify({ error: 'Stock insuficiente', details: stockErrors }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3) Descontar inventario.
    const updatedFlavors: { name: string; new_stock: number }[] = [];
    for (const item of normalizedItems) {
      if (!item.flavor_id) continue;

      const { data: currentFlavor, error: currentFlavorError } = await adminClient
        .from('flavors')
        .select('stock, name')
        .eq('id', item.flavor_id)
        .single();

      if (currentFlavorError || !currentFlavor) {
        return new Response(JSON.stringify({ error: `No se pudo leer inventario para ${item.name}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const newStock = Math.max(0, currentFlavor.stock - item.quantity);
      const { error: updateFlavorError } = await adminClient
        .from('flavors')
        .update({ stock: newStock, is_available: newStock > 0 })
        .eq('id', item.flavor_id);

      if (updateFlavorError) {
        return new Response(JSON.stringify({ error: `Error actualizando stock de ${currentFlavor.name}: ${updateFlavorError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      updatedFlavors.push({ name: currentFlavor.name, new_stock: newStock });
    }

    // 4) Recalcular total y cerrar orden.
    const newTotal = normalizedItems.reduce((sum: number, item: any) => {
      return sum + (item.price || 0) * (item.quantity || 0);
    }, 0);

    const { error: updateOrderError } = await adminClient
      .from('orders')
      .update({
        status: 'processed',
        items: normalizedItems,
        total: newTotal,
        admin_notes: admin_notes || null,
        processed_at: new Date().toISOString(),
      })
      .eq('id', order_id);

    if (updateOrderError) {
      return new Response(JSON.stringify({ error: 'Error actualizando orden: ' + updateOrderError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      order_number: order.order_number,
      updated_flavors: updatedFlavors,
      message: `Orden ${order.order_number} procesada correctamente. Inventario actualizado.`,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno del servidor';
    console.error('Error inesperado:', err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
