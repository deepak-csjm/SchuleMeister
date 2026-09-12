'use server';

import { AuthError } from 'next-auth';
import { headers } from 'next/headers';
import { z } from 'zod';
import { signIn, signOut } from '@/auth';
import { normaliseEmail } from '@/lib/email-domains';
import { rateLimit } from '@/lib/rate-limit';

export interface SignInState {
  status: 'idle' | 'error';
  /** Message key inside the `auth` namespace. */
  error?: 'invalidEmail' | 'errorAccessDenied' | 'rateLimited' | 'errorGeneric';
}

const emailSchema = z.string().trim().min(3).max(200).email();

/** Requests per window, per client IP and per address. */
const MAX_REQUESTS = 5;
const WINDOW_MS = 10 * 60 * 1000;

async function clientIp(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return headerList.get('x-real-ip') ?? 'unknown';
}

/**
 * Sends a magic link to a school address.
 *
 * On success Auth.js redirects to the "check your inbox" page. The same screen
 * is shown for addresses that are not provisioned (the email is simply not
 * sent), so this endpoint cannot be used to enumerate staff accounts.
 */
export async function requestMagicLink(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = emailSchema.safeParse(formData.get('email'));
  if (!parsed.success) return { status: 'error', error: 'invalidEmail' };

  const email = normaliseEmail(parsed.data);
  const ip = await clientIp();

  const byIp = rateLimit(`signin:ip:${ip}`, MAX_REQUESTS, WINDOW_MS);
  const byEmail = rateLimit(`signin:email:${email}`, MAX_REQUESTS, WINDOW_MS);
  if (!byIp.success || !byEmail.success) {
    return { status: 'error', error: 'rateLimited' };
  }

  try {
    await signIn('nodemailer', { email, redirectTo: '/admin' });
  } catch (error) {
    // Next.js signals redirects by throwing; those must bubble up.
    if (error instanceof AuthError) {
      return {
        status: 'error',
        error: error.type === 'AccessDenied' ? 'errorAccessDenied' : 'errorGeneric',
      };
    }
    throw error;
  }

  return { status: 'idle' };
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: '/' });
}
