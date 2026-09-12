import { describe, expect, it } from 'vitest';
import { canEditSchool, type StaffUser } from '@/lib/permissions';

const secretary: StaffUser = {
  id: 'u1',
  email: 'sekretariat@nrw.schule',
  role: 'SECRETARY',
  schoolId: 'school-a',
};

const superAdmin: StaffUser = {
  id: 'u2',
  email: 'admin@nrw.schule',
  role: 'SUPER_ADMIN',
  schoolId: 'school-b',
};

describe('canEditSchool', () => {
  it('lets a secretary edit their own school', () => {
    expect(canEditSchool(secretary, 'school-a')).toBe(true);
  });

  it('stops a secretary editing another school', () => {
    expect(canEditSchool(secretary, 'school-b')).toBe(false);
  });

  it('lets a super admin edit any school, including one they are not attached to', () => {
    expect(canEditSchool(superAdmin, 'school-a')).toBe(true);
    expect(canEditSchool(superAdmin, 'school-b')).toBe(true);
  });

  it('does not treat a prefix of the school id as a match', () => {
    expect(canEditSchool(secretary, 'school-a2')).toBe(false);
    expect(canEditSchool(secretary, 'school-')).toBe(false);
    expect(canEditSchool(secretary, '')).toBe(false);
  });
});
