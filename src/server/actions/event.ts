'use server';

import { revalidatePath } from 'next/cache';
import { canEditSchool, requireStaffUser } from '@/lib/auth-guard';
import { diffFields, writeAuditLog } from '@/lib/audit';
import { fromDateInputValue } from '@/lib/datetime';
import { prisma } from '@/lib/prisma';
import { eventSchema, fieldErrors } from '@/lib/validation';
import type { FormState } from './school';

function readEventForm(formData: FormData) {
  return {
    title: formData.get('title') ?? '',
    description: formData.get('description') ?? '',
    eventDate: formData.get('eventDate') ?? '',
    startTime: formData.get('startTime') ?? '',
    endTime: formData.get('endTime') ?? '',
    location: formData.get('location') ?? '',
    eventType: formData.get('eventType') ?? 'OPEN_HOUSE',
    targetGrade: formData.get('targetGrade') ?? '',
    isPublished: formData.get('isPublished') === 'on' || formData.get('isPublished') === 'true',
  };
}

export async function createEvent(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStaffUser();
  const parsed = eventSchema.safeParse(readEventForm(formData));
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error) };

  const eventDate = fromDateInputValue(parsed.data.eventDate);
  if (!eventDate) return { status: 'error', errors: { eventDate: 'invalidDate' } };

  const created = await prisma.event.create({
    data: {
      schoolId: user.schoolId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      eventDate,
      startTime: parsed.data.startTime ?? null,
      endTime: parsed.data.endTime ?? null,
      location: parsed.data.location ?? null,
      eventType: parsed.data.eventType,
      targetGrade: parsed.data.targetGrade ?? null,
      isPublished: parsed.data.isPublished,
    },
  });

  await writeAuditLog({
    action: 'event.create',
    entity: 'Event',
    entityId: created.id,
    actorEmail: user.email,
    userId: user.id,
    schoolId: user.schoolId,
    changes: {
      title: created.title,
      eventDate: created.eventDate.toISOString(),
      eventType: created.eventType,
      isPublished: created.isPublished,
    },
  });

  revalidatePath(`/schools/${user.schoolId}`);
  revalidatePath('/admin/events');

  return { status: 'success' };
}

export async function updateEvent(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStaffUser();
  const eventId = String(formData.get('eventId') ?? '');
  if (!eventId) return { status: 'error', errors: { _form: 'required' } };

  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  // An event of another school is reported exactly like a missing one, so the
  // action cannot be used to probe for foreign event ids.
  if (!existing || !canEditSchool(user, existing.schoolId)) {
    return { status: 'error', errors: { _form: 'notFound' } };
  }

  const parsed = eventSchema.safeParse(readEventForm(formData));
  if (!parsed.success) return { status: 'error', errors: fieldErrors(parsed.error) };

  const eventDate = fromDateInputValue(parsed.data.eventDate);
  if (!eventDate) return { status: 'error', errors: { eventDate: 'invalidDate' } };

  const next = {
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    eventDate,
    startTime: parsed.data.startTime ?? null,
    endTime: parsed.data.endTime ?? null,
    location: parsed.data.location ?? null,
    eventType: parsed.data.eventType,
    targetGrade: parsed.data.targetGrade ?? null,
    isPublished: parsed.data.isPublished,
  };

  await prisma.event.update({ where: { id: eventId }, data: next });

  await writeAuditLog({
    action: 'event.update',
    entity: 'Event',
    entityId: eventId,
    actorEmail: user.email,
    userId: user.id,
    schoolId: existing.schoolId,
    changes: diffFields(existing as unknown as Record<string, unknown>, next),
  });

  revalidatePath(`/schools/${existing.schoolId}`);
  revalidatePath('/admin/events');

  return { status: 'success' };
}

export async function deleteEvent(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStaffUser();
  const eventId = String(formData.get('eventId') ?? '');
  if (!eventId) return { status: 'error', errors: { _form: 'required' } };

  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existing || !canEditSchool(user, existing.schoolId)) {
    return { status: 'error', errors: { _form: 'notFound' } };
  }

  await prisma.event.delete({ where: { id: eventId } });

  await writeAuditLog({
    action: 'event.delete',
    entity: 'Event',
    entityId: eventId,
    actorEmail: user.email,
    userId: user.id,
    schoolId: existing.schoolId,
    changes: {
      title: existing.title,
      eventDate: existing.eventDate.toISOString(),
      eventType: existing.eventType,
    },
  });

  revalidatePath(`/schools/${existing.schoolId}`);
  revalidatePath('/admin/events');

  return { status: 'success' };
}
