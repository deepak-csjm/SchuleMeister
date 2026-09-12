import NextAuth, { type DefaultSession } from 'next-auth';
import Nodemailer from 'next-auth/providers/nodemailer';
import { inviteOnlyPrismaAdapter } from '@/lib/auth-adapter';
import { getEnv } from '@/lib/env';
import { isAllowedAdminEmail, normaliseEmail, parseAllowedDomains } from '@/lib/email-domains';
import { sendMagicLinkMail } from '@/lib/mailer';
import { prisma } from '@/lib/prisma';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'SUPER_ADMIN' | 'SECRETARY';
      schoolId: string;
    } & DefaultSession['user'];
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    role?: 'SUPER_ADMIN' | 'SECRETARY';
    schoolId?: string;
  }
}

/** Magic links are short-lived on purpose. */
const MAGIC_LINK_MAX_AGE_SECONDS = 15 * 60;
/** Staff sessions expire after a working day. */
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

async function findProvisionedUser(email: string) {
  return prisma.user.findUnique({
    where: { email: normaliseEmail(email) },
    select: { id: true, email: true, role: true, schoolId: true, isActive: true },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const env = getEnv();
  const allowedDomains = parseAllowedDomains(env.ALLOWED_ADMIN_EMAIL_DOMAINS);

  return {
    adapter: inviteOnlyPrismaAdapter(prisma),
    // No Session table, and therefore no database round-trip per request. The
    // authoritative check happens in `requireStaffUser()` for every admin page
    // and mutation, so deactivating a user takes effect immediately.
    session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE_SECONDS },
    secret: env.AUTH_SECRET,
    trustHost: true,
    pages: {
      signIn: '/signin',
      verifyRequest: '/signin/check-email',
      error: '/signin/error',
      signOut: '/signin',
    },
    cookies: {
      sessionToken: {
        name: env.NODE_ENV === 'production'
          ? '__Secure-schulkompass.session'
          : 'schulkompass.session',
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: env.NODE_ENV === 'production',
        },
      },
    },
    providers: [
      Nodemailer({
        id: 'nodemailer',
        from: env.EMAIL_FROM,
        maxAge: MAGIC_LINK_MAX_AGE_SECONDS,
        // `server` is unused because sendVerificationRequest is overridden, but
        // the provider requires the option to be present.
        server: {
          host: env.EMAIL_SERVER_HOST ?? 'localhost',
          port: env.EMAIL_SERVER_PORT ?? 587,
        },
        async sendVerificationRequest({ identifier, url }) {
          const host = new URL(url).host;
          const user = await findProvisionedUser(identifier);

          // Silently skip delivery for addresses that are not provisioned. The
          // UI shows the same "check your inbox" screen either way, so the
          // endpoint cannot be used to enumerate staff accounts.
          if (!user || !user.isActive) {
            console.warn('[auth] magic link requested for unknown address', { host });
            return;
          }

          await sendMagicLinkMail({ to: user.email, url, host });
        },
      }),
    ],
    callbacks: {
      async signIn({ user, email }) {
        const address = user?.email;
        if (!address) return false;

        // Phase 1: the link was requested. Reject non-school domains outright
        // (that is not account enumeration, the domain list is public policy)
        // and let unknown addresses through to the no-op sender above.
        if (email?.verificationRequest) {
          return isAllowedAdminEmail(address, allowedDomains);
        }

        // Phase 2: the link was clicked. Require an allow-listed domain *and* a
        // provisioned, active account.
        if (!isAllowedAdminEmail(address, allowedDomains)) return false;
        const provisioned = await findProvisionedUser(address);
        if (!provisioned || !provisioned.isActive) return false;

        await prisma.user.update({
          where: { id: provisioned.id },
          data: { lastLoginAt: new Date(), emailVerified: new Date() },
        });
        await prisma.auditLog.create({
          data: {
            action: 'auth.signin',
            entity: 'User',
            entityId: provisioned.id,
            actorEmail: provisioned.email,
            userId: provisioned.id,
            schoolId: provisioned.schoolId,
          },
        });

        return true;
      },

      async jwt({ token, user }) {
        // Only present on sign-in; afterwards the claims are already in the JWT.
        if (user?.email) {
          const provisioned = await findProvisionedUser(user.email);
          if (provisioned) {
            token.sub = provisioned.id;
            token.email = provisioned.email;
            token.role = provisioned.role;
            token.schoolId = provisioned.schoolId;
          }
        }
        return token;
      },

      async session({ session, token }) {
        if (token.sub) session.user.id = token.sub;
        if (token.role) session.user.role = token.role;
        if (token.schoolId) session.user.schoolId = token.schoolId;
        return session;
      },
    },
  };
});
