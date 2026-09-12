/**
 * Prints a valid staff session cookie value, for the scripts that audit or
 * exercise the admin area.
 *
 * Auth.js stores `sha256(token + AUTH_SECRET)` rather than the token itself, so
 * the value in the database cannot be replayed. Instead this seeds a
 * verification row whose preimage it generates, then redeems it exactly like a
 * real magic link. No production code, dev flag or SMTP server is involved.
 *
 *   node e2e/get-session.mjs sekretariat@example.org
 *
 * Requires AUTH_SECRET and DATABASE_URL in the environment (or .env) and a dev
 * server, because the production cookie is Secure and will not survive http://.
 */
import { createHash, randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const email = (process.argv[2] ?? 'sekretariat@example.org').toLowerCase();
const secret = process.env.AUTH_SECRET;

if (!secret) {
  console.error('AUTH_SECRET must be set (it is mixed into the stored token hash).');
  process.exit(1);
}

const prisma = new PrismaClient();
const token = randomBytes(32).toString('hex');
const hashed = createHash('sha256').update(`${token}${secret}`).digest('hex');

await prisma.verificationToken.create({
  data: { identifier: email, token: hashed, expires: new Date(Date.now() + 15 * 60 * 1000) },
});

const url = new URL(`${BASE}/api/auth/callback/nodemailer`);
url.searchParams.set('callbackUrl', `${BASE}/admin`);
url.searchParams.set('token', token);
url.searchParams.set('email', email);

const response = await fetch(url, { redirect: 'manual' });
const cookies = response.headers.getSetCookie?.() ?? [];
const session = cookies
  .map((cookie) => /(?:^|;\s*)(?:__Secure-)?schulkompass\.session=([^;]+)/.exec(cookie)?.[1])
  .find(Boolean);

await prisma.$disconnect();

if (!session) {
  console.error(
    `No session cookie returned (HTTP ${response.status}). Is ${email} provisioned and active, ` +
      'and is the server running in development mode?',
  );
  process.exit(1);
}

process.stdout.write(session);
