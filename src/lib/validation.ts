import { z } from 'zod';

/**
 * Validation schemas shared by server actions and the public search API.
 *
 * Error messages are i18n *keys* (resolved against the `admin.validation`
 * namespace), so the server never has to know the user's language.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, 'tooLong')
    .transform((value) => (value.length === 0 ? null : value))
    .nullable()
    .optional();

const commaSeparatedList = z
  .string()
  .max(500, 'tooLong')
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .slice(0, 30),
  );

export const timeStringSchema = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'invalidTime');

export const schoolProfileSchema = z.object({
  name: z.string().trim().min(1, 'required').max(200, 'tooLong'),
  address: z.string().trim().min(1, 'required').max(200, 'tooLong'),
  postalCode: z.string().trim().regex(/^\d{5}$/, 'invalidPostalCode'),
  city: z.string().trim().min(1, 'required').max(100, 'tooLong'),
  phone: optionalText(50),
  email: z
    .union([z.literal(''), z.string().trim().email('invalidEmail').max(200, 'tooLong')])
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional(),
  website: z
    .union([
      z.literal(''),
      z
        .string()
        .trim()
        .max(300, 'tooLong')
        .refine((value) => /^https?:\/\//i.test(value), 'invalidUrl')
        .refine((value) => {
          try {
            new URL(value);
            return true;
          } catch {
            return false;
          }
        }, 'invalidUrl'),
    ])
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional(),
  headmaster: optionalText(150),
  description: optionalText(4000),
  registrationNotes: optionalText(4000),
  hasOGS: z.coerce.boolean(),
  languages: commaSeparatedList,
  facilities: commaSeparatedList,
});

export type SchoolProfileInput = z.infer<typeof schoolProfileSchema>;

export const eventTypeSchema = z.enum([
  'OPEN_HOUSE',
  'INFO_EVENING',
  'REGISTRATION',
  'OTHER',
]);

export const eventSchema = z
  .object({
    title: z.string().trim().min(1, 'required').max(200, 'tooLong'),
    description: optionalText(4000),
    eventDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalidDate'),
    startTime: z
      .union([z.literal(''), timeStringSchema])
      .transform((value) => (value === '' ? null : value))
      .nullable()
      .optional(),
    endTime: z
      .union([z.literal(''), timeStringSchema])
      .transform((value) => (value === '' ? null : value))
      .nullable()
      .optional(),
    location: optionalText(200),
    eventType: eventTypeSchema,
    targetGrade: optionalText(100),
    isPublished: z.coerce.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.startTime && value.endTime && value.endTime <= value.startTime) {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'endBeforeStart' });
    }
    if (!value.startTime && value.endTime) {
      ctx.addIssue({ code: 'custom', path: ['startTime'], message: 'required' });
    }
  });

export type EventInput = z.infer<typeof eventSchema>;

export const schoolTypeSchema = z.enum([
  'GRUNDSCHULE',
  'HAUPTSCHULE',
  'REALSCHULE',
  'GYMNASIUM',
  'GESAMTSCHULE',
  'FOERDERSCHULE',
  'BERUFSKOLLEG',
]);

/** Query parameters accepted by `GET /api/schools`. */
export const searchQuerySchema = z.object({
  /** PLZ or city name. */
  q: z.string().trim().max(100).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(0.5).max(50).optional(),
  type: schoolTypeSchema.optional(),
  ogs: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  language: z.string().trim().max(60).optional(),
  openHouse: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

/** Flattens Zod issues into a `field -> message key` map for form rendering. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path.join('.') || '_form';
    if (!errors[field]) errors[field] = issue.message;
  }
  return errors;
}
