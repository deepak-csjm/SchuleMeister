import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUDIT_ACTIONS } from '@/lib/audit-actions';
import { routing } from '@/i18n/routing';

type Messages = { [key: string]: string | Messages };

function load(locale: string): Messages {
  const file = path.join(process.cwd(), 'messages', `${locale}.json`);
  return JSON.parse(readFileSync(file, 'utf8')) as Messages;
}

function flatten(messages: Messages, prefix = ''): Record<string, string> {
  return Object.entries(messages).reduce<Record<string, string>>((accumulator, [key, value]) => {
    if (typeof value === 'string') {
      accumulator[`${prefix}${key}`] = value;
    } else {
      Object.assign(accumulator, flatten(value, `${prefix}${key}.`));
    }
    return accumulator;
  }, {});
}

/**
 * Resolves a dotted key the way next-intl does: by descending one segment at a
 * time. This is deliberately NOT `flatten()[key]` - flattening a nested group
 * and flattening a flat key that merely *contains* dots produce the same string,
 * which is exactly how an unreachable `"event.update"` key can look correct.
 */
function resolvePath(messages: Messages, path: string): string | undefined {
  let current: string | Messages | undefined = messages;
  for (const segment of path.split('.')) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = current[segment];
  }
  return typeof current === 'string' ? current : undefined;
}

/** Simple ICU argument names, ignoring the inner parts of plural blocks. */
function placeholders(message: string): Set<string> {
  const names = new Set<string>();
  for (const match of message.matchAll(/\{\s*(\w+)\s*(?:,|\})/g)) {
    const name = match[1]!;
    // Plural category keywords are not arguments.
    if (!['zero', 'one', 'two', 'few', 'many', 'other'].includes(name)) names.add(name);
  }
  return names;
}

const reference = flatten(load(routing.defaultLocale));
const referenceKeys = Object.keys(reference).sort();
const otherLocales = routing.locales.filter((locale) => locale !== routing.defaultLocale);

describe('message catalogues', () => {
  it('the default locale is German', () => {
    expect(routing.defaultLocale).toBe('de');
  });

  it('covers all five required languages', () => {
    expect([...routing.locales].sort()).toEqual(['ar', 'de', 'en', 'tr', 'uk']);
  });

  it.each(otherLocales)('%s has exactly the same keys as de', (locale) => {
    const keys = Object.keys(flatten(load(locale))).sort();
    expect(keys).toEqual(referenceKeys);
  });

  it.each(otherLocales)('%s uses the same ICU arguments as de', (locale) => {
    const messages = flatten(load(locale));
    const mismatches: string[] = [];

    for (const key of referenceKeys) {
      const expected = placeholders(reference[key]!);
      const actual = placeholders(messages[key]!);
      if ([...expected].some((name) => !actual.has(name))) {
        mismatches.push(`${key}: expected {${[...expected]}} got {${[...actual]}}`);
      }
    }

    expect(mismatches).toEqual([]);
  });

  it.each(routing.locales)('%s has no empty strings', (locale) => {
    const empty = Object.entries(flatten(load(locale)))
      .filter(([, value]) => value.trim().length === 0)
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it.each(routing.locales)(
    '%s has a readable label for every audit action',
    (locale) => {
      const messages = load(locale);
      // The dots in an action are message paths, not part of a flat key:
      // next-intl resolves `event.update` as admin.actions.event.update. A flat
      // "event.update" key is unreachable and silently falls back to the raw
      // identifier in the admin audit panel.
      const missing = AUDIT_ACTIONS.filter(
        (action) => resolvePath(messages, `admin.actions.${action}`) === undefined,
      );
      expect(missing).toEqual([]);
    },
  );

  it('keeps a plural form for the result count in every locale', () => {
    for (const locale of routing.locales) {
      expect(flatten(load(locale))['search.resultCount']).toContain('plural');
    }
  });
});
