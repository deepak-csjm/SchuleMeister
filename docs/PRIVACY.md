# Privacy / DSGVO notes

This file records what the code actually does, so a data-protection review can be
checked against the implementation rather than against intentions.

## Zero parent data collection

- The search, the school detail pages and the `.ics` download require no account and
  accept no personal identifiers.
- `GET /api/schools` and the public pages read no cookies and write no logs about the
  caller.
- The only cookie the application sets is the staff session cookie:
  `httpOnly`, `sameSite=lax`, `path=/`, and `secure` with the `__Secure-` name prefix
  in production (`src/auth.ts`).
- `localeCookie: false` in `src/i18n/routing.ts` disables next-intl's `NEXT_LOCALE`
  cookie; the language is negotiated from `Accept-Language` and from the URL prefix.

Verified in a real browser: a full parent journey (search -> filter -> switch
language -> open a school -> download an `.ics`) ends with an empty cookie jar and no
requests to any host other than the application's own.

## Third-party requests

The only third party in the product is the OpenStreetMap tile service, and it is
opt-in per page view:

- `src/components/school-map.tsx` renders a consent panel first and dynamically
  imports Leaflet only after the visitor activates the map.
- The consent is React state. It is intentionally **not** persisted, so no storage
  consent is needed for it either.
- Tile hosts are the only non-`self` sources in the Content-Security-Policy
  (`next.config.ts`), so an accidental third-party request elsewhere is blocked by
  the browser rather than merely unintended.

For an installation that must avoid the tile request entirely, self-host tiles and
change the `TileLayer` URL plus the CSP entry.

## Location data

- `navigator.geolocation` is only called on an explicit button press.
- Coordinates are rounded to three decimals (~100 m) in
  `src/components/search-form.tsx` before they are put in the URL and sent to the
  server.
- They are used for one query and never written to the database.
- `Permissions-Policy` allows geolocation only for the app's own origin.

## Staff data

Stored per account: email address, role, school, `createdAt`, `updatedAt`,
`emailVerified`, `lastLoginAt`, `isActive`. No names, no password hashes.

- Sign-in is passwordless; magic links expire after 15 minutes and are single-use
  (the token row is deleted when redeemed - verified).
- `isActive = false` revokes access on the next request while keeping the audit trail
  attributable.
- `AuditLog.actorEmail` is denormalised so the log survives deletion of the `User`
  row (`onDelete: SetNull` on the relation). Deleting a staff account therefore keeps
  the record of what was changed without keeping the account itself - note this when
  answering an erasure request: the retained field is the acting email address, which
  is the minimum needed to keep edits attributable.

## Audit logging

`src/lib/audit.ts` records action, entity, entity id, actor email, user id, school id,
a field-level diff and a timestamp for every content edit and every sign-in. The diff
contains school and event content only - never parent data. Audit writes never throw:
a failed write is logged loudly but does not roll back the user's change.

## Server location

`DATABASE_URL` and the deployment region must both be in the EU (Frankfurt /
`eu-central-1`). This is a deployment obligation, not something the code can enforce -
see [DEPLOYMENT.md](DEPLOYMENT.md). The SMTP provider used for magic links processes
staff email addresses and must be EU-hosted and covered by a DPA.

## Response headers

Set for every route in `next.config.ts`:

| Header | Value |
| --- | --- |
| `Content-Security-Policy` | `self` only, plus OSM tile hosts for images and connections; `'unsafe-eval'` in development only (React's dev build needs it) |
| `style-src` | `'self'` - no `'unsafe-inline'`. Verified: the rendered HTML contains no `<style>` element and no `style=""` attribute |
| `Referrer-Policy` | `no-referrer` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` / `frame-ancestors` | `DENY` / `'none'` |
| `Permissions-Policy` | camera, microphone and payment off; geolocation `self` |
| `Strict-Transport-Security` | 2 years, `includeSubDomains`, `preload` |

### Why `'unsafe-inline'` is still in `script-src`

`style-src` was tightened to `'self'` after measuring the rendered HTML: there is no
inline `<style>` element and no `style=""` attribute on any page (the root 404 page
was rewritten to use stylesheet classes for exactly this reason). Leaflet mutates
`element.style` from JavaScript, which CSP does not govern - the map was re-checked in
Chromium with the stricter policy and reports no violations.

`script-src` still needs `'unsafe-inline'`, and this is a deliberate decision rather
than an unfinished task:

- Next.js emits six inline scripts per page (bootstrap plus the streaming payload).
  The only way to allow them without `'unsafe-inline'` is a per-request nonce.
- Next.js can only inject a nonce during server-side rendering, so **every page would
  have to become dynamically rendered** (confirmed in
  `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`). That
  gives up static prerendering of `/privacy` and `/signin/check-email` in all five
  locales, and adds request-time work to a service whose main audience is on mobile.
- The practical XSS surface it would protect is close to zero: the app renders no
  user-supplied HTML. Every piece of school-supplied text goes through JSX as text
  and is escaped by React. The single `dangerouslySetInnerHTML` in the codebase is
  `src/components/json-ld.tsx`, which serialises an object with `JSON.stringify` and
  additionally escapes `<` to `\u003c`, so school text cannot close the script
  element (covered by a unit test).

Revisit this if the app ever renders rich text, embeds third-party scripts, or starts
accepting HTML from schools - at that point the nonce cost is worth paying.
