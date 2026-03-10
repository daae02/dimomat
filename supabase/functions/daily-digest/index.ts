// supabase/functions/daily-digest/index.ts
// Triggered daily by pg_cron via pg_net HTTP POST.
// Queries today's orders and sends a digest email via Resend REST API.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Validate cron secret to prevent unauthorized invocations
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret) {
    const incomingSecret = req.headers.get('x-cron-secret');
    if (incomingSecret !== cronSecret) {
      console.warn('[daily-digest] Unauthorized: bad or missing x-cron-secret');
      return new Response('Unauthorized', { status: 401 });
    }
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const recipientsRaw = Deno.env.get('NOTIFICATION_RECIPIENTS');
    const emailFrom = Deno.env.get('EMAIL_FROM') ?? 'onboarding@resend.dev';
    const currency = Deno.env.get('CURRENCY_SYMBOL') ?? '₡';

    if (!resendApiKey) {
      console.error('[daily-digest] Missing RESEND_API_KEY');
      return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY' }), { status: 500 });
    }
    if (!recipientsRaw) {
      console.error('[daily-digest] Missing NOTIFICATION_RECIPIENTS');
      return new Response(JSON.stringify({ error: 'Missing NOTIFICATION_RECIPIENTS' }), { status: 500 });
    }

    const recipients = recipientsRaw.split(',').map((s: string) => s.trim()).filter(Boolean);

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Compute "today" in Costa Rica time (UTC-6, no DST)
    const now = new Date();
    const crOffsetMs = -6 * 60 * 60 * 1000;
    const crNow = new Date(now.getTime() + crOffsetMs + now.getTimezoneOffset() * 60000);
    const todayStr = crNow.toISOString().slice(0, 10); // YYYY-MM-DD
    const dayStart = new Date(todayStr + 'T00:00:00-06:00').toISOString();
    const dayEnd   = new Date(todayStr + 'T23:59:59-06:00').toISOString();

    // Fetch today's orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, status, total, items, customer_name, created_at')
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd)
      .order('created_at');

    if (ordersError) {
      console.error('[daily-digest] DB error:', ordersError);
      return new Response(JSON.stringify({ error: ordersError.message }), { status: 500 });
    }

    const allOrders = orders ?? [];

    // Fetch total pending backlog (all-time, not just today)
    const { data: pendingAll } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, created_at')
      .in('status', ['pending', 'confirmed'])
      .order('created_at');

    const processed    = allOrders.filter((o: any) => o.status === 'processed');
    const cancelled    = allOrders.filter((o: any) => o.status === 'cancelled');
    const expired      = allOrders.filter((o: any) => o.status === 'expired');
    const pendingToday = allOrders.filter((o: any) => o.status === 'pending' || o.status === 'confirmed');
    const totalOrders  = allOrders.length;

    const revenue = processed.reduce((s: number, o: any) => s + parseFloat(String(o.total ?? 0)), 0);
    const completionRate = totalOrders > 0 ? Math.round((processed.length / totalOrders) * 100) : 0;

    // Top flavor by quantity sold (processed orders only)
    const flavorQty: Record<string, number> = {};
    processed.forEach((o: any) => {
      (o.items as Array<{ name: string; quantity: number }> ?? []).forEach((item: any) => {
        flavorQty[item.name] = (flavorQty[item.name] ?? 0) + Number(item.quantity || 0);
      });
    });
    const topFlavor = Object.entries(flavorQty).sort((a, b) => b[1] - a[1])[0] ?? null;

    const pendingBacklog = (pendingAll ?? []).length;
    const formattedDate = crNow.toLocaleDateString('es-CR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const backlogNote = pendingBacklog > 0
      ? `<div style="background:#fff7ed;border-left:4px solid #f97316;padding:12px 16px;margin:16px 0;border-radius:4px;">
           <strong style="color:#c2410c;">Atencion:</strong> Hay <strong>${pendingBacklog}</strong> pedido(s) pendiente(s) en total (incluyendo dias anteriores). Procesalos antes de que expiren.
         </div>`
      : '';

    const recentRows = allOrders.slice(0, 10).map((o: any) => {
      const statusColors: Record<string, string> = {
        processed: '#16a34a', cancelled: '#dc2626', expired: '#d97706',
        pending: '#7c3aed', confirmed: '#2563eb',
      };
      const col = statusColors[o.status] ?? '#6b7280';
      const ts = new Date(o.created_at).toLocaleTimeString('es-CR', {
        timeZone: 'America/Costa_Rica', hour: '2-digit', minute: '2-digit',
      });
      return `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #f0e8ff;font-weight:600;color:#7c3aed;">${o.order_number}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f0e8ff;">${o.customer_name ?? '—'}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f0e8ff;text-align:right;">${currency}${parseFloat(String(o.total)).toFixed(2)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f0e8ff;text-align:center;color:${col};font-weight:600;">${o.status}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #f0e8ff;text-align:right;color:#9ca3af;">${ts}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Resumen diario ${todayStr}</title></head>
<body style="margin:0;padding:0;background:#f7f3ff;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:22px;">Resumen del dia</h1>
      <p style="margin:4px 0 0;color:#e9d5ff;font-size:14px;">${formattedDate}</p>
    </div>
    <div style="padding:24px 32px;">
      ${totalOrders === 0 ? '<p style="color:#6b7280;font-style:italic;">No se recibieron pedidos hoy.</p>' : ''}
      <table style="width:100%;border-collapse:separate;border-spacing:8px;margin-bottom:8px;">
        <tr>
          <td style="background:#f5f0ff;border-radius:8px;padding:16px;text-align:center;width:25%;">
            <div style="font-size:26px;font-weight:700;color:#7c3aed;">${totalOrders}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">Pedidos recibidos</div>
          </td>
          <td style="background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;width:25%;">
            <div style="font-size:26px;font-weight:700;color:#16a34a;">${currency}${revenue.toFixed(2)}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">Ingresos procesados</div>
          </td>
          <td style="background:#fff7ed;border-radius:8px;padding:16px;text-align:center;width:25%;">
            <div style="font-size:26px;font-weight:700;color:#ea580c;">${completionRate}%</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">Tasa de completacion</div>
          </td>
          <td style="background:#f0f9ff;border-radius:8px;padding:16px;text-align:center;width:25%;">
            <div style="font-size:26px;font-weight:700;color:#0284c7;">${pendingToday.length}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">Pendientes hoy</div>
          </td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:12px 0;">
        <tr><td style="color:#16a34a;padding:3px 0;">Procesados</td><td style="font-weight:600;text-align:right;">${processed.length}</td></tr>
        <tr><td style="color:#dc2626;padding:3px 0;">Cancelados</td><td style="font-weight:600;text-align:right;">${cancelled.length}</td></tr>
        <tr><td style="color:#d97706;padding:3px 0;">Vencidos</td><td style="font-weight:600;text-align:right;">${expired.length}</td></tr>
      </table>
      ${topFlavor ? `<div style="background:#f5f0ff;border-radius:8px;padding:12px 16px;margin:12px 0;">Sabor estrella del dia: <strong>${topFlavor[0]}</strong> &bull; ${topFlavor[1]} unidad(es) vendida(s)</div>` : ''}
      ${backlogNote}
      ${totalOrders > 0 ? `
      <h2 style="font-size:15px;color:#374151;margin:20px 0 8px;">Pedidos de hoy${allOrders.length > 10 ? ' (primeros 10)' : ''}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f5f0ff;">
            <th style="padding:7px 10px;text-align:left;color:#6b7280;">#</th>
            <th style="padding:7px 10px;text-align:left;color:#6b7280;">Cliente</th>
            <th style="padding:7px 10px;text-align:right;color:#6b7280;">Total</th>
            <th style="padding:7px 10px;text-align:center;color:#6b7280;">Estado</th>
            <th style="padding:7px 10px;text-align:right;color:#6b7280;">Hora</th>
          </tr>
        </thead>
        <tbody>${recentRows}</tbody>
      </table>` : ''}
    </div>
    <div style="background:#f5f0ff;padding:16px 32px;text-align:center;font-size:12px;color:#9ca3af;">
      Dimomat &bull; Resumen automatico diario &bull; ${todayStr}
    </div>
  </div>
</body>
</html>`;

    const resendPayload = {
      from: emailFrom,
      to: recipients,
      subject: `Resumen diario Dimomat — ${todayStr} · ${totalOrders} pedidos · ${currency}${revenue.toFixed(2)}`,
      html,
    };

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('[daily-digest] Resend error:', resendRes.status, errText);
      return new Response(JSON.stringify({ error: 'Resend API error', detail: errText }), { status: 502 });
    }

    const resendData = await resendRes.json();
    console.log('[daily-digest] Digest sent, id=', resendData.id, 'date=', todayStr);
    return new Response(JSON.stringify({ success: true, email_id: resendData.id, date: todayStr, total_orders: totalOrders }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[daily-digest] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
});
