/**
 * Email-domain allow list for the school admin panel.
 *
 * A matching domain is *necessary but not sufficient*: the address must also
 * exist in the `User` table (invite only). See `src/auth.ts`.
 */

/** Parses the `ALLOWED_ADMIN_EMAIL_DOMAINS` value into a normalised list. */
export function parseAllowedDomains(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase().replace(/^@/, ''))
    .filter((entry) => entry.length > 0);
}

/** Extracts the lowercase domain of an email address, or null if malformed. */
export function emailDomain(email: string): string | null {
  const normalised = email.trim().toLowerCase();
  // Exactly one "@", non-empty local part, domain with at least one dot.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) return null;
  const domain = normalised.slice(normalised.lastIndexOf('@') + 1);
  return domain.length > 0 ? domain : null;
}

/**
 * True when the address belongs to an allow-listed domain.
 *
 * Entries may be written as `nrw.schule` (exact match) or `*.nrw.schule` /
 * `.nrw.schule` (any subdomain, and the apex itself).
 */
export function isAllowedAdminEmail(email: string, allowedDomains: string[]): boolean {
  const domain = emailDomain(email);
  if (!domain || allowedDomains.length === 0) return false;

  return allowedDomains.some((entry) => {
    if (entry.startsWith('*.') || entry.startsWith('.')) {
      const apex = entry.replace(/^\*?\./, '');
      return domain === apex || domain.endsWith(`.${apex}`);
    }
    return domain === entry;
  });
}

/** Normalises an address for storage and lookup (lowercase, trimmed). */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}
