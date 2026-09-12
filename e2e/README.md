# Browser flows and accessibility audit

These scripts run in CI (`.github/workflows/ci.yml`, job `e2e`) on every push.
They are not part of `npm test`, because they need Chromium, a running server and
a seeded database.

They cover what unit tests cannot reach: the magic-link flow, the admin CRUD
path, tenant isolation, the WCAG 2.1 AA audit, and the claim that the public
pages set no cookies and make no third-party requests until the visitor
activates the map.

Every script asserts through `_harness.mjs` and **exits non-zero on failure**, so
a regression fails the build rather than scrolling past in a log. Fixtures (a
school id, a school with an upcoming event) are discovered through
`/api/schools`, so the scripts need no database credentials of their own.

## Setup

```bash
npm i -D playwright-core axe-core       # axe-core is only needed by a11y.mjs
export CHROME_PATH=/path/to/chrome      # e.g. /opt/pw-browsers/chromium-*/chrome-linux/chrome
export BASE_URL=http://localhost:3101

# Terminal 1 - dev server. A production server will not do for the admin
# scripts: its session cookie is Secure and will not survive plain http://.
PORT=3101 npm run dev

# Terminal 2
npm run db:seed
```

## Getting a staff session

```bash
export AUTH_SECRET=...        # same value the server is running with
SESSION=$(node e2e/get-session.mjs sekretariat@example.org)
```

`get-session.mjs` seeds a verification token whose preimage it knows and then
redeems it like a real magic link. It deliberately does **not** read the token
out of the database: Auth.js stores `sha256(token + AUTH_SECRET)`, so the stored
value cannot be replayed. This needs no dev-only flag, no SMTP server and no
test hook in the production auth code, which is what makes it safe to use from
CI as well.

## `public.mjs` - parent journey, no sign-in

```bash
node e2e/public.mjs
```

Checks: search by PLZ with filters, the resulting shareable URL, the result count and
"near" label, the map consent gate (no tile request before the click, tiles after it),
the locale switch preserving the query string and flipping to RTL, the `.ics`
download, and that the cookie jar stays empty throughout.

## `admin.mjs` - staff journey

```bash
node e2e/admin.mjs "$SESSION"
```

Checks: profile save, server-side validation errors rendered on the right field,
event create, the end-before-start rule, navigation to the edit page, event update,
and the audit trail on the dashboard.

## `a11y.mjs` - WCAG 2.1 A/AA audit

```bash
node e2e/a11y.mjs "<school-id>" "$SESSION"     # the session argument is optional
```

Runs axe-core against every public page in all five locales, the interactive
states automation usually misses (activated map, server-side validation errors)
and - when given a session - the admin pages. Prints one line per rule with the
affected page states. Distinct from `tests/contrast.test.ts`, which guards the
design tokens' contrast ratios without needing a browser.

## `a11y-manual.mjs` - the criteria axe cannot test

```bash
node e2e/a11y-manual.mjs "<school-id>"
```

Checks reflow at 320 px (WCAG 1.4.10), text enlargement to 200 % (1.4.4),
keyboard-only operation including the skip link and focus visibility (2.1.1,
2.4.1, 2.4.7), and heading/landmark structure. Automated rules catch a minority
of accessibility problems; a screen-reader pass with real users is still
outstanding and is declared as such in the accessibility statement.

## What to expect

Each script prints one line per check and a summary, then exits 0 or 1. The
scripts select by id (`#q`, `#title`, `#postalCode`, ...); form submits are scoped
with `form:has(#field)` because the admin layout renders its sign-out form before
the page content.

A development server is required rather than optional: the production session
cookie carries the `__Secure-` prefix and the `Secure` attribute, so it cannot be
set over plain `http://` and the admin scripts would have no session.
