import { z } from 'zod';

/**
 * Server-side environment validation.
 *
 * Kept out of client bundles and out of the middleware/edge runtime on purpose:
 * only imported from Node.js server code (route handlers, server actions,
 * server components, scripts).
 */
const serverSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET must be at least 16 characters'),
  AUTH_URL: z.string().url().optional(),
  ALLOWED_ADMIN_EMAIL_DOMAINS: z.string().default(''),
  EMAIL_FROM: z.string().min(1).default('SchulKompass NRW <noreply@localhost>'),
  EMAIL_SERVER_HOST: z.string().optional(),
  EMAIL_SERVER_PORT: z.coerce.number().int().positive().optional(),
  EMAIL_SERVER_USER: z.string().optional(),
  EMAIL_SERVER_PASSWORD: z.string().optional(),
  AUTH_DEV_LOG_MAGIC_LINK: z
    .string()
    .optional()
    .transform((value) => value === 'true'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function getEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  if (parsed.data.NODE_ENV === 'production' && parsed.data.AUTH_DEV_LOG_MAGIC_LINK) {
    throw new Error(
      'AUTH_DEV_LOG_MAGIC_LINK must not be enabled in production - magic links would be written to the server log.',
    );
  }

  cached = parsed.data;
  return cached;
}
