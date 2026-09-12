import { createTransport } from 'nodemailer';
import { getEnv } from './env';

export interface MagicLinkMail {
  to: string;
  url: string;
  host: string;
}

/**
 * Plain-text + minimal HTML magic-link email.
 * Kept deliberately simple: no tracking pixels, no remote images, no cookies.
 */
export function renderMagicLinkMail({ to, url, host }: MagicLinkMail) {
  const subject = `Anmeldelink für SchulKompass NRW (${host})`;
  const text = [
    'Anmeldung bei SchulKompass NRW',
    '',
    `Für ${to} wurde ein Anmeldelink angefordert.`,
    'Der Link ist 15 Minuten gültig und kann nur einmal verwendet werden:',
    '',
    url,
    '',
    'Wenn Sie diese Anmeldung nicht angefordert haben, können Sie diese E-Mail ignorieren.',
    '',
    '--',
    'SchulKompass NRW',
  ].join('\n');

  const html = `<!doctype html>
<html lang="de"><body style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a;line-height:1.5">
<h1 style="font-size:18px;margin:0 0 16px">Anmeldung bei SchulKompass NRW</h1>
<p style="margin:0 0 16px">Für <strong>${escapeHtml(to)}</strong> wurde ein Anmeldelink angefordert. Der Link ist 15&nbsp;Minuten gültig und kann nur einmal verwendet werden.</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Jetzt anmelden</a></p>
<p style="margin:0 0 16px;font-size:13px;color:#475569">Falls der Button nicht funktioniert, kopieren Sie diese Adresse in Ihren Browser:<br><span style="word-break:break-all">${escapeHtml(url)}</span></p>
<p style="margin:0;font-size:13px;color:#475569">Wenn Sie diese Anmeldung nicht angefordert haben, können Sie diese E-Mail ignorieren.</p>
</body></html>`;

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Sends the magic-link email, or logs it in development. */
export async function sendMagicLinkMail(mail: MagicLinkMail): Promise<void> {
  const env = getEnv();
  const { subject, text, html } = renderMagicLinkMail(mail);

  if (env.AUTH_DEV_LOG_MAGIC_LINK) {
    console.info(`\n[auth:dev] magic link for ${mail.to}\n${mail.url}\n`);
    return;
  }

  if (!env.EMAIL_SERVER_HOST || !env.EMAIL_SERVER_PORT) {
    throw new Error('SMTP is not configured: set EMAIL_SERVER_HOST and EMAIL_SERVER_PORT.');
  }

  const transport = createTransport({
    host: env.EMAIL_SERVER_HOST,
    port: env.EMAIL_SERVER_PORT,
    secure: env.EMAIL_SERVER_PORT === 465,
    auth:
      env.EMAIL_SERVER_USER && env.EMAIL_SERVER_PASSWORD
        ? { user: env.EMAIL_SERVER_USER, pass: env.EMAIL_SERVER_PASSWORD }
        : undefined,
  });

  const result = await transport.sendMail({
    to: mail.to,
    from: env.EMAIL_FROM,
    subject,
    text,
    html,
  });

  const rejected = [...(result.rejected ?? []), ...(result.pending ?? [])].filter(Boolean);
  if (rejected.length > 0) {
    throw new Error(`Magic-link email could not be delivered to ${rejected.join(', ')}`);
  }
}
