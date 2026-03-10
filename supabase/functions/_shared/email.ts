export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const emailFrom = Deno.env.get('EMAIL_FROM') || 'Bolis Dimomat <onboarding@resend.dev>';

  if (!resendApiKey) {
    console.warn('[email] RESEND_API_KEY no configurada, se omite envio de correo');
    return { skipped: true };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error enviando email (${response.status}): ${errText}`);
  }

  return { skipped: false };
}
