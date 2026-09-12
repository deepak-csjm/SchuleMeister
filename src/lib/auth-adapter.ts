import type { PrismaClient } from '@prisma/client';
import type { Adapter, AdapterUser, VerificationToken } from 'next-auth/adapters';
import { normaliseEmail } from './email-domains';

/**
 * Invite-only Auth.js adapter.
 *
 * The standard `@auth/prisma-adapter` cannot be used here: it creates a `User`
 * row for any address that completes the magic-link flow, but our `User` model
 * requires a `schoolId` and access is deliberately restricted to accounts a
 * school authority provisioned beforehand. This adapter therefore implements
 * exactly what the email (magic link) flow with JWT sessions needs:
 *
 *   - verification-token storage (`createVerificationToken` / `useVerificationToken`)
 *   - read-only user lookup (`getUser*`)
 *
 * Every user-creating or session-persisting method fails loudly so a future
 * change of provider or session strategy cannot silently auto-provision
 * accounts.
 */
export function inviteOnlyPrismaAdapter(prisma: PrismaClient): Adapter {
  const toAdapterUser = (user: {
    id: string;
    email: string;
    emailVerified: Date | null;
  }): AdapterUser => ({
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
  });

  const denied = (method: string) => () => {
    throw new Error(
      `[auth] ${method} is disabled: accounts for SchulKompass NRW are provisioned by the school authority.`,
    );
  };

  return {
    async createVerificationToken(token: VerificationToken) {
      return prisma.verificationToken.create({
        data: {
          identifier: normaliseEmail(token.identifier),
          token: token.token,
          expires: token.expires,
        },
      });
    },

    /**
     * Consumes a token exactly once. Returns null when the token is unknown,
     * which Auth.js turns into a "verification" error.
     */
    async useVerificationToken({ identifier, token }) {
      try {
        return await prisma.verificationToken.delete({
          where: { identifier_token: { identifier: normaliseEmail(identifier), token } },
        });
      } catch {
        return null;
      }
    },

    async getUserByEmail(email) {
      const user = await prisma.user.findUnique({
        where: { email: normaliseEmail(email) },
        select: { id: true, email: true, emailVerified: true, isActive: true },
      });
      // An inactive account behaves exactly like a non-existent one.
      if (!user || !user.isActive) return null;
      return toAdapterUser(user);
    },

    async getUser(id) {
      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, email: true, emailVerified: true, isActive: true },
      });
      if (!user || !user.isActive) return null;
      return toAdapterUser(user);
    },

    /** No OAuth accounts exist in this product. */
    async getUserByAccount() {
      return null;
    },

    async updateUser(user) {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerified: user.emailVerified ?? undefined,
        },
        select: { id: true, email: true, emailVerified: true },
      });
      return toAdapterUser(updated);
    },

    /** Email accounts are not persisted; nothing to link. */
    async linkAccount() {
      return undefined;
    },

    createUser: denied('createUser') as never,
    deleteUser: denied('deleteUser') as never,
    unlinkAccount: denied('unlinkAccount') as never,
    createSession: denied('createSession') as never,
    getSessionAndUser: denied('getSessionAndUser') as never,
    updateSession: denied('updateSession') as never,
    deleteSession: denied('deleteSession') as never,
  };
}
