/**
 * Pure authorisation rules.
 *
 * Deliberately free of framework imports (no next-auth, no Prisma, no
 * next/navigation) so the rules can be unit tested in isolation and reused from
 * any runtime. Request-scoped helpers live in `src/lib/auth-guard.ts`.
 */

export type StaffRole = 'SUPER_ADMIN' | 'SECRETARY';

export interface StaffUser {
  id: string;
  email: string;
  role: StaffRole;
  schoolId: string;
}

/**
 * May this user modify content of the given school?
 * SECRETARY accounts are scoped to their own school; SUPER_ADMIN is not.
 */
export function canEditSchool(user: StaffUser, schoolId: string): boolean {
  if (schoolId.length === 0) return false;
  if (user.role === 'SUPER_ADMIN') return true;
  return user.schoolId === schoolId;
}
