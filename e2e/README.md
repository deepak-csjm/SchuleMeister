# Manual browser verification

These scripts are **not part of `npm test`**. They need a running dev server and a
seeded database, so they are kept as reproducible manual checks rather than as a CI
suite (see ARCHITECTURE.md, "Known limitations").

They were used to verify the behaviour that unit tests cannot reach: the magic-link
flow, the admin CRUD path, tenant isolation, and the claim that the public pages set
no cookies and make no third-party requests.

## Setup

```bash
npm i -D playwright-core      # or use the browser already on your machine
export CHROME_PATH=/path/to/chrome     # e.g. /opt/pw-browsers/chromium-*/chrome-linux/chrome
export BASE_URL=http://localhost:3101

# Terminal 1 - dev server with magic links printed to the console
AUTH_DEV_LOG_MAGIC_LINK=true PORT=3101 npm run dev

# Terminal 2
npm run db:seed
```

## `public.mjs` - parent journey, no sign-in

```bash
node e2e/public.mjs
```

Checks: search by PLZ with filters, the resulting shareable URL, the result count and
"near" label, the map consent gate (no tile request before the click, tiles after it),
the locale switch preserving the query string and flipping to RTL, the `.ics`
download, and that the cookie jar stays empty throughout.

## `admin.mjs` - staff journey

Obtain a session cookie first: request a link, read the URL from the dev server
console, open it, and take the `schulkompass.session` cookie value.

```bash
node e2e/admin.mjs "<session-cookie-value>"
```

Checks: profile save, server-side validation errors rendered on the right field,
event create, the end-before-start rule, navigation to the edit page, event update,
and the audit trail on the dashboard.

## What to expect

Both scripts print a numbered log. Any thrown timeout means a step regressed - the
step number tells you which. The scripts use IDs (`#q`, `#title`, `#postalCode`, ...);
form submits are scoped with `form:has(#field)` because the admin layout renders its
sign-out form before the page content.
