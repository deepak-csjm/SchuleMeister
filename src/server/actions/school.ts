'use server';

import { revalidatePath } from 'next/cache';
import { requireStaffUser } from '@/lib/auth-guard';
import { diffFields, writeAuditLog } from '@/lib/audit';
import { prisma } from '@/lib/prisma';
import { fieldErrors, schoolProfileSchema } from '@/lib/validation';

export interface FormState {
  status: 'idle' | 'success' | 'error';
  /** Field name -> message key inside `admin.validation`. */
  errors?: Record<string, string>;
}

/**
 * Updates the profile of the school the acting user belongs to.
 * The school id comes from the session, never from the submitted form.
 */
export async function updateSchoolProfile(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  // The school id comes from the session, so there is nothing to authorise
  // beyond having a valid staff account.
  const user = await requireStaffUser();

  const parsed = schoolProfileSchema.safeParse({
    name: formData.get('name') ?? '',
    address: formData.get('address') ?? '',
    postalCode: formData.get('postalCode') ?? '',
    city: formData.get('city') ?? '',
    phone: formData.get('phone') ?? '',
    email: formData.get('email') ?? '',
    website: formData.get('website') ?? '',
    headmaster: formData.get('headmaster') ?? '',
    description: formData.get('description') ?? '',
    registrationNotes: formData.get('registrationNotes') ?? '',
    hasOGS: formData.get('hasOGS') === 'on' || formData.get('hasOGS') === 'true',
    languages: String(formData.get('languages') ?? ''),
    facilities: String(formData.get('facilities') ?? ''),
  });

  if (!parsed.success) {
    return { status: 'error', errors: fieldErrors(parsed.error) };
  }

  const before = await prisma.school.findUnique({ where: { id: user.schoolId } });
  if (!before) return { status: 'error', errors: { _form: 'notFound' } };

  const data = parsed.data;
  const updated = await prisma.school.update({
    where: { id: user.schoolId },
    data: {
      name: data.name,
      address: data.address,
      postalCode: data.postalCode,
      city: data.city,
      phone: data.phone ?? null,
      email: data.email ?? null,
      website: data.website ?? null,
      headmaster: data.headmaster ?? null,
      description: data.description ?? null,
      registrationNotes: data.registrationNotes ?? null,
      hasOGS: data.hasOGS,
      languages: data.languages,
      facilities: data.facilities,
    },
  });

  await writeAuditLog({
    action: 'school.update',
    entity: 'School',
    entityId: updated.id,
    actorEmail: user.email,
    userId: user.id,
    schoolId: updated.id,
    changes: diffFields(before as unknown as Record<string, unknown>, {
      name: data.name,
      address: data.address,
      postalCode: data.postalCode,
      city: data.city,
      phone: data.phone ?? null,
      email: data.email ?? null,
      website: data.website ?? null,
      headmaster: data.headmaster ?? null,
      description: data.description ?? null,
      registrationNotes: data.registrationNotes ?? null,
      hasOGS: data.hasOGS,
      languages: data.languages,
      facilities: data.facilities,
    }),
  });

  revalidatePath(`/schools/${updated.id}`);
  revalidatePath('/');

  return { status: 'success' };
}
