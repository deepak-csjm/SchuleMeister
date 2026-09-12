import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { canEditSchool, type StaffUser } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

export { canEditSchool };
export type { StaffUser };

/**
 * The authoritative authorisation check for every admin page and mutation.
 *
 * The JWT session cookie only carries claims; this helper re-reads the user
 * from the database so that deactivating an account takes effect on the next
 * request instead of when the session expires.
 */
export async function getStaffUser(): Promise<StaffUser | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, schoolId: true, isActive: true },
  });
  if (!user || !user.isActive) return null;

  return { id: user.id, email: user.email, role: user.role, schoolId: user.schoolId };
}

/** Redirects to the sign-in page when no valid staff session exists. */
export async function requireStaffUser(): Promise<StaffUser> {
  const user = await getStaffUser();
  if (!user) redirect('/signin');
  return user;
}

/**
 * Page-level guard for a school-scoped resource.
 *
 * Answers with 404 rather than 403 on purpose: a secretary of another school
 * must not be able to learn whether a given event id exists.
 */
export function assertCanEditSchool(user: StaffUser, schoolId: string): void {
  if (!canEditSchool(user, schoolId)) notFound();
}
