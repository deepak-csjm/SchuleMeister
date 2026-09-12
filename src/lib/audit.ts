import { Prisma } from '@prisma/client';
import type { AuditAction } from './audit-actions';
import { prisma } from './prisma';

export type { AuditAction };

export interface AuditContext {
  action: AuditAction;
  entity: 'School' | 'Event' | 'User';
  entityId: string;
  actorEmail: string;
  userId?: string | null;
  schoolId?: string | null;
  changes?: Prisma.InputJsonValue;
}

/**
 * Writes an audit record. Never throws: a failed audit write must not roll back
 * or hide the user-visible outcome, but it is logged loudly so the gap is
 * detectable in monitoring.
 */
export async function writeAuditLog(context: AuditContext): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: context.action,
        entity: context.entity,
        entityId: context.entityId,
        actorEmail: context.actorEmail,
        userId: context.userId ?? null,
        schoolId: context.schoolId ?? null,
        changes: context.changes ?? Prisma.DbNull,
      },
    });
  } catch (error) {
    console.error('[audit] failed to persist audit log entry', {
      action: context.action,
      entity: context.entity,
      entityId: context.entityId,
      error,
    });
  }
}

/**
 * Field-level diff of the submitted values against the stored record.
 * Only changed fields are recorded, which keeps the log small and readable.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Prisma.InputJsonObject {
  const diff: Record<string, Prisma.InputJsonValue> = {};

  for (const [key, nextValue] of Object.entries(after)) {
    const previousValue = before[key];
    const equal = Array.isArray(previousValue) && Array.isArray(nextValue)
      ? previousValue.length === nextValue.length &&
        previousValue.every((item, index) => item === nextValue[index])
      : previousValue instanceof Date && nextValue instanceof Date
        ? previousValue.getTime() === nextValue.getTime()
        : previousValue === nextValue;

    if (!equal) diff[key] = { from: serialise(previousValue), to: serialise(nextValue) };
  }

  return diff;
}

function serialise(value: unknown): Prisma.InputJsonValue | null {
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return null;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => serialise(item));
  // Anything else is recorded as its string form: the audit log is a human
  // readable trail, not a rehydratable snapshot.
  return String(value);
}
