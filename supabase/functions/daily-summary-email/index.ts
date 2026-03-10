import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendEmail } from '../_shared/email.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

function formatMoney(amount: number) {
  return amount.toLocaleString('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

    const expectedSecret = Deno.env.get('CRON_SECRET');
    if (expectedSecret) {
      const providedSecret = req.headers.get('x-cron-secret');
      if (providedSecret !== expectedSecret) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const recipient = Deno.env.get('DAILY_SUMMARY_EMAIL') || Deno.env.get('ORDER_ALERT_EMAIL');
    if (!recipient) {
      return new Response(JSON.stringify({ error: 'Configura DAILY_SUMMARY_EMAIL (o ORDER_ALERT_EMAIL)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;

    const safeOrders = orders || [];
    const processed = safeOrders.filter((o) => o.status === 'processed');
    const cancelled = safeOrders.filter((o) => o.status === 'cancelled');
    const pending = safeOrders.filter((o) => o.status === 'pending' || o.status === 'confirmed');
    const revenue = processed.reduce((sum, o) => sum + Number(o.total || 0), 0);

    const topMap = new Map<string, { name: string; qty: number }>();
    const hourly = new Array(24).fill(0);

    for (const order of processed) {
      const h = new Date(order.created_at).getHours();
      hourly[h] = (hourly[h] || 0) + 1;

      const items = Array.isArray(order.items) ? order.items : [];
      for (const item of items) {
        const name = String(item?.name || 'Sin nombre');
        const qty = Math.max(0, Number(item?.quantity || 0));
        if (!topMap.has(name)) topMap.set(name, { name, qty: 0 });
        topMap.get(name)!.qty += qty;
      }
    }

    const topFlavor = [...topMap.values()].sort((a, b) => b.qty - a.qty)[0] || null;
    const peakHour = hourly.reduce((best, val, idx, arr) => (val > arr[best] ? idx : best), 0);

    const dateLabel = now.toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hourLabel = `${String(peakHour).padStart(2, '0')}:00`;

    const subject = `📊 Resumen diario ${dateLabel} — ${safeOrders.length} pedidos`;

    const text = [
      `Resumen diario (${dateLabel})`,
      `Ingresos: ${formatMoney(revenue)}`,
      `Pedidos totales: ${safeOrders.length}`,
      `Procesados: ${processed.length}`,
      `Pendientes: ${pending.length}`,
      `Cancelados: ${cancelled.length}`,
      topFlavor ? `Sabor top: ${topFlavor.name} (${topFlavor.qty} unidades)` : 'Sabor top: —',
      processed.length > 0 ? `Hora pico: ${hourLabel}` : 'Hora pico: —',
    ].join('\n');

    const html = `
      <h2>📊 Resumen diario (${dateLabel})</h2>
      <ul>
        <li><strong>Ingresos:</strong> ${formatMoney(revenue)}</li>
        <li><strong>Pedidos totales:</strong> ${safeOrders.length}</li>
        <li><strong>Procesados:</strong> ${processed.length}</li>
        <li><strong>Pendientes:</strong> ${pending.length}</li>
        <li><strong>Cancelados:</strong> ${cancelled.length}</li>
        <li><strong>Sabor top:</strong> ${topFlavor ? `${topFlavor.name} (${topFlavor.qty} unidades)` : '—'}</li>
        <li><strong>Hora pico:</strong> ${processed.length > 0 ? hourLabel : '—'}</li>
      </ul>
    `;

    await sendEmail({ to: recipient, subject, text, html });

    return new Response(JSON.stringify({ success: true, sent_to: recipient }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno del servidor';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
