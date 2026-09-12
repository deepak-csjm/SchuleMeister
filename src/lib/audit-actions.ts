/**
 * The closed set of auditable actions.
 *
 * A runtime array rather than a bare type union, so tests can assert that every
 * action has a human-readable label in every locale. Kept free of Prisma and
 * framework imports so it can be imported from anywhere.
 *
 * The dots are message *paths*: `event.update` resolves to
 * `admin.actions.event.update` in the message catalogues.
 */
export const AUDIT_ACTIONS = [
  'school.update',
  'event.create',
  'event.update',
  'event.delete',
  'auth.signin',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
