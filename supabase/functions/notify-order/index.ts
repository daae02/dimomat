// supabase/functions/notify-order/index.ts
// Called fire-and-forget from create-order after a successful order insert.
// Sends a new-order notification email via Resend REST API.

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const recipientsRaw = Deno.env.get('NOTIFICATION_RECIPIENTS');
    const emailFrom = Deno.env.get('EMAIL_FROM') ?? 'onboarding@resend.dev';
    const currency = Deno.env.get('CURRENCY_SYMBOL') ?? '₡';

    if (!resendApiKey) {
      console.error('[notify-order] Missing RESEND_API_KEY');
      return new Response(JSON.stringify({ error: 'Missing RESEND_API_KEY' }), { status: 500 });
    }
    if (!recipientsRaw) {
      console.error('[notify-order] Missing NOTIFICATION_RECIPIENTS');
      return new Response(JSON.stringify({ error: 'Missing NOTIFICATION_RECIPIENTS' }), { status: 500 });
    }

    const recipients = recipientsRaw.split(',').map((s: string) => s.trim()).filter(Boolean);
    if (recipients.length === 0) {
      console.error('[notify-order] NOTIFICATION_RECIPIENTS is empty after parsing');
      return new Response(JSON.stringify({ error: 'No recipients' }), { status: 500 });
    }

    const body = await req.json();
    const { order_number, customer_name, items, total, created_at } = body ?? {};

    if (!order_number || !customer_name || !Array.isArray(items) || typeof total !== 'number') {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
    }

    const ts = created_at
      ? new Date(created_at).toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' })
      : new Date().toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' });

    const itemRows = items.map((item: { name: string; price: number; quantity: number }) => `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #f0e8ff;">${item.name}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f0e8ff;text-align:center;">${item.quantity}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f0e8ff;text-align:right;">${currency}${Number(item.price).toFixed(2)}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #f0e8ff;text-align:right;">${currency}${(Number(item.price) * Number(item.quantity)).toFixed(2)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Nuevo Pedido ${order_number}</title></head>
<body style="margin:0;padding:0;background:#f7f3ff;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:22px;">Nuevo Pedido Recibido</h1>
      <p style="margin:4px 0 0;color:#e9d5ff;font-size:14px;">${ts} (hora Costa Rica)</p>
    </div>
    <div style="padding:24px 32px;">
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <tr>
          <td style="padding:4px 0;color:#6b7280;font-size:13px;">Numero de orden</td>
          <td style="padding:4px 0;font-weight:700;color:#7c3aed;font-size:18px;">${order_number}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;color:#6b7280;font-size:13px;">Cliente</td>
          <td style="padding:4px 0;font-weight:600;">${customer_name}</td>
        </tr>
      </table>
      <h2 style="font-size:15px;color:#374151;margin:16px 0 8px;">Detalle del pedido</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f5f0ff;">
            <th style="padding:8px 12px;text-align:left;color:#6b7280;font-weight:600;">Sabor</th>
            <th style="padding:8px 12px;text-align:center;color:#6b7280;font-weight:600;">Cant.</th>
            <th style="padding:8px 12px;text-align:right;color:#6b7280;font-weight:600;">Precio</th>
            <th style="padding:8px 12px;text-align:right;color:#6b7280;font-weight:600;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div style="text-align:right;margin-top:12px;padding-top:12px;border-top:2px solid #7c3aed;">
        <span style="font-size:18px;font-weight:700;color:#7c3aed;">Total: ${currency}${Number(total).toFixed(2)}</span>
      </div>
    </div>
    <div style="background:#f5f0ff;padding:16px 32px;text-align:center;font-size:12px;color:#9ca3af;">
      Dimomat &bull; Sistema de pedidos automatico
    </div>
  </div>
</body>
</html>`;

    const resendPayload = {
      from: emailFrom,
      to: recipients,
      subject: `Nuevo pedido ${order_number} — ${customer_name}`,
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
      console.error('[notify-order] Resend error:', resendRes.status, errText);
      return new Response(JSON.stringify({ error: 'Resend API error', detail: errText }), { status: 502 });
    }

    const resendData = await resendRes.json();
    console.log('[notify-order] Email sent, id=', resendData.id);
    return new Response(JSON.stringify({ success: true, email_id: resendData.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[notify-order] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
});
