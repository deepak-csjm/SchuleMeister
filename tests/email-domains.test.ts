import { describe, expect, it } from 'vitest';
import {
  emailDomain,
  isAllowedAdminEmail,
  normaliseEmail,
  parseAllowedDomains,
} from '@/lib/email-domains';

describe('parseAllowedDomains', () => {
  it('splits, trims, lowercases and strips a leading @', () => {
    expect(parseAllowedDomains(' Duesseldorf.DE , @nrw.schule ,, schule.nrw.de ')).toEqual([
      'duesseldorf.de',
      'nrw.schule',
      'schule.nrw.de',
    ]);
  });

  it('returns an empty list for missing configuration', () => {
    expect(parseAllowedDomains(undefined)).toEqual([]);
    expect(parseAllowedDomains('')).toEqual([]);
    expect(parseAllowedDomains(null)).toEqual([]);
  });
});

describe('emailDomain', () => {
  it('extracts the domain', () => {
    expect(emailDomain('Sekretariat@Nrw.Schule')).toBe('nrw.schule');
  });

  it.each([
    'no-at-sign',
    'two@at@signs.de',
    '@nodomain.de',
    'local@',
    'local@nodot',
    'spaces in@nrw.schule',
    '',
  ])('rejects the malformed address %s', (value) => {
    expect(emailDomain(value)).toBeNull();
  });
});

describe('isAllowedAdminEmail', () => {
  const allowed = parseAllowedDomains('duesseldorf.de,nrw.schule');

  it('accepts an exact domain match, case-insensitively', () => {
    expect(isAllowedAdminEmail('sekretariat@nrw.schule', allowed)).toBe(true);
    expect(isAllowedAdminEmail('Sekretariat@NRW.Schule', allowed)).toBe(true);
  });

  it('rejects other domains', () => {
    expect(isAllowedAdminEmail('parent@gmail.com', allowed)).toBe(false);
  });

  it('does not treat a subdomain as an exact match', () => {
    expect(isAllowedAdminEmail('a@sub.nrw.schule', allowed)).toBe(false);
  });

  it('does not allow a look-alike suffix domain', () => {
    // The classic bug: endsWith('nrw.schule') would wrongly accept this.
    expect(isAllowedAdminEmail('attacker@evil-nrw.schule', allowed)).toBe(false);
    expect(isAllowedAdminEmail('attacker@nrw.schule.evil.com', allowed)).toBe(false);
  });

  it('supports wildcard entries for subdomains', () => {
    const wildcard = parseAllowedDomains('*.nrw.schule');
    expect(isAllowedAdminEmail('a@sub.nrw.schule', wildcard)).toBe(true);
    expect(isAllowedAdminEmail('a@nrw.schule', wildcard)).toBe(true);
    expect(isAllowedAdminEmail('a@evil-nrw.schule', wildcard)).toBe(false);
  });

  it('denies everything when no domain is configured', () => {
    expect(isAllowedAdminEmail('sekretariat@nrw.schule', [])).toBe(false);
  });

  it('rejects malformed addresses', () => {
    expect(isAllowedAdminEmail('not-an-email', allowed)).toBe(false);
  });
});

describe('normaliseEmail', () => {
  it('trims and lowercases', () => {
    expect(normaliseEmail('  Sekretariat@NRW.Schule ')).toBe('sekretariat@nrw.schule');
  });
});
