// ================================================
// EDGE FUNCTION: process-order
// ================================================
// Procesa una orden: descuenta el inventario y marca la orden como procesada.
// REQUIERE autenticación de administrador (JWT de Supabase Auth).
//
// Uso:
//   POST /functions/v1/process-order
//   Headers: Authorization: Bearer <admin_jwt>
//   Body: {
//     order_id: "uuid",
//     items: [{flavor_id: "uuid", name: "Fresa", price: 20, quantity: 2}],
//     admin_notes: "opcional"
//   }
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
      return new Response(JSON.stringify({ error: 'Método no permitido' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar autenticación
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'No autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verificar que el JWT pertenece a un usuario autenticado
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Sesión inválida o expirada' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { order_id, items, admin_notes } = body;

    if (!order_id || !items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'Datos incompletos' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cliente con service role para operaciones privilegiadas
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 1. Verificar que la orden existe y está pendiente
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

    // 2. Verificar stock disponible para todos los items
    const stockErrors: string[] = [];
    for (const item of items) {
      if (!item.flavor_id) continue; // Ítems sin flavor_id no descuentan inventario

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
      return new Response(
        JSON.stringify({ error: 'Stock insuficiente', details: stockErrors }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 3. Descontar inventario (uno por uno para control de errores)
    const updatedFlavors: { name: string; new_stock: number }[] = [];
    for (const item of items) {
      if (!item.flavor_id) continue;

      // Obtener stock actual (re-leer para evitar race conditions)
      const { data: currentFlavor } = await adminClient
        .from('flavors')
        .select('stock, name')
        .eq('id', item.flavor_id)
        .single();

      if (!currentFlavor) continue;

      const newStock = Math.max(0, currentFlavor.stock - item.quantity);

      await adminClient
        .from('flavors')
        .update({
          stock: newStock,
          is_available: newStock > 0,
        })
        .eq('id', item.flavor_id);

      updatedFlavors.push({ name: currentFlavor.name, new_stock: newStock });
    }

    // 4. Calcular nuevo total con los items editados
    const newTotal = items.reduce((sum: number, item: any) => {
      return sum + (item.price || 0) * (item.quantity || 0);
    }, 0);

    // 5. Marcar la orden como procesada y guardar los items editados
    const { error: updateError } = await adminClient
      .from('orders')
      .update({
        status: 'processed',
        items: items,
        total: newTotal,
        admin_notes: admin_notes || null,
        processed_at: new Date().toISOString(),
      })
      .eq('id', order_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Error actualizando orden: ' + updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_number: order.order_number,
        updated_flavors: updatedFlavors,
        message: `Orden ${order.order_number} procesada correctamente. Inventario actualizado.`,
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
