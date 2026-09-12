/**
 * Operator ("Anbieter" / controller) details for the legally required pages:
 * Impressum (§ 5 DDG, § 18 MStV), Datenschutzerklärung (Art. 13 GDPR) and the
 * accessibility statement (BITV 2.0 / EU Directive 2016/2102).
 *
 * Everything a lawyer needs to review lives in this one file, so the details do
 * not have to be maintained inside five translated message catalogues. While
 * any value is still a PLACEHOLDER the pages render a visible notice instead of
 * pretending to be complete - publishing an Impressum with invented details
 * would be worse than publishing none.
 *
 * Replace every "TODO:" value before going live. `npm run check:legal` fails
 * while placeholders remain.
 */

export const PLACEHOLDER_PREFIX = 'TODO:';

export interface OperatorConfig {
  /** Legal name of the provider, e.g. "Landeshauptstadt Düsseldorf". */
  legalName: string;
  /** Legal form, e.g. "Körperschaft des öffentlichen Rechts" or "GmbH". */
  legalForm: string;
  /** Authorised representative(s), e.g. "Oberbürgermeister …". */
  representedBy: string;
  address: { street: string; postalCode: string; city: string; country: string };
  contact: { email: string; phone: string };
  /** Commercial/association register entry, or null for a public body. */
  register: { court: string; number: string } | null;
  /** VAT identification number, or null if not applicable. */
  vatId: string | null;
  /** Person responsible for editorial content (§ 18 (2) MStV). */
  contentResponsible: { name: string; address: string };
  /** Supervisory authority, where one applies. */
  supervisoryAuthority: string | null;
  /** Data protection officer. */
  dataProtectionOfficer: { name: string; email: string };
  /** Competent data protection supervisory authority for complaints. */
  dataProtectionAuthority: { name: string; url: string };
  /** Accessibility feedback contact and the enforcement/conciliation body. */
  accessibility: {
    contactEmail: string;
    enforcementBody: string;
    enforcementUrl: string;
  };
  /** Date of the most recent accessibility self-assessment (ISO 8601). */
  accessibilityAssessedOn: string;
}

export const operator: OperatorConfig = {
  legalName: 'TODO: Name des Anbieters',
  legalForm: 'TODO: Rechtsform',
  representedBy: 'TODO: Vertretungsberechtigte Person',
  address: {
    street: 'TODO: Straße und Hausnummer',
    postalCode: 'TODO: PLZ',
    city: 'TODO: Ort',
    country: 'Deutschland',
  },
  contact: {
    email: 'TODO: kontakt@example.org',
    phone: 'TODO: +49 …',
  },
  register: null,
  vatId: null,
  contentResponsible: {
    name: 'TODO: Verantwortliche Person',
    address: 'TODO: Anschrift',
  },
  supervisoryAuthority: null,
  dataProtectionOfficer: {
    name: 'TODO: Datenschutzbeauftragte Person',
    email: 'TODO: datenschutz@example.org',
  },
  dataProtectionAuthority: {
    name: 'Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen',
    url: 'https://www.ldi.nrw.de',
  },
  accessibility: {
    contactEmail: 'TODO: barrierefreiheit@example.org',
    enforcementBody:
      'Ombudsstelle für barrierefreie Informationstechnik des Landes Nordrhein-Westfalen',
    enforcementUrl: 'https://www.mags.nrw',
  },
  accessibilityAssessedOn: '2026-09-12',
};

const isPlaceholder = (value: unknown): boolean =>
  typeof value === 'string' && value.startsWith(PLACEHOLDER_PREFIX);

/** Collects the dotted paths of every value still left as a placeholder. */
export function unconfiguredFields(config: OperatorConfig = operator): string[] {
  const missing: string[] = [];

  const walk = (value: unknown, path: string): void => {
    if (value === null || value === undefined) return;
    if (isPlaceholder(value)) {
      missing.push(path);
      return;
    }
    if (typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        walk(child, path ? `${path}.${key}` : key);
      }
    }
  };

  walk(config, '');
  return missing;
}

export function isOperatorConfigured(config: OperatorConfig = operator): boolean {
  return unconfiguredFields(config).length === 0;
}
