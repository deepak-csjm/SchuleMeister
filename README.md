# SchulKompass NRW

Mobile-first school finder for parents in North Rhine-Westphalia: search schools by
postal code, city or current location, see open house days (*Tag der offenen Tür*),
information evenings and registration periods, and add any of them to a calendar.

School offices maintain their own profile and dates through a passwordless admin
panel. Parents need no account, and the public side of the app sets no cookies and
makes no third-party requests.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, React 19, TypeScript strict) |
| Database | PostgreSQL + Prisma 6 |
| Auth | Auth.js (NextAuth v5) magic links, invite-only |
| Styling | Tailwind CSS v4 + shadcn-style components, Lucide icons |
| i18n | next-intl - German (default), English, Turkish, Ukrainian, Arabic (RTL) |
| Maps | Leaflet + OpenStreetMap tiles, loaded only after explicit consent |
| Tests | Vitest (201 unit tests) + CI smoke test + axe-core audit |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the reasoning behind these
choices, including where the current implementation would need to change to scale
beyond a single city.

## Quick start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
#    Set DATABASE_URL and generate a secret:
npx auth secret          # writes AUTH_SECRET
#    For local development without SMTP, set AUTH_DEV_LOG_MAGIC_LINK="true"
#    and add example.org to ALLOWED_ADMIN_EMAIL_DOMAINS.

# 3. Create the schema and load data
npm run db:migrate
npm run db:seed          # synthetic demo data; see docs/OPEN_DATA.md for the real import

# 4. Run
npm run dev              # http://localhost:3000
```

The seed creates two demo staff accounts, `sekretariat@example.org` (SECRETARY) and
`admin@example.org` (SUPER_ADMIN). With `AUTH_DEV_LOG_MAGIC_LINK="true"` the sign-in
link is printed to the server console instead of being emailed.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:migrate` | Create/apply a migration in development |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:seed` | Seed demo data, or import open data (see below) |
| `npm run db:studio` | Prisma Studio |
| `npm run check:legal` | Fails while the Impressum/privacy details are still placeholders |

## Loading real school data

`prisma/seed.ts` doubles as the open-data importer:

```bash
SEED_SCHOOLS_URL="https://.../schulverzeichnis.csv" npm run db:seed
# or from a local download
SEED_SCHOOLS_FILE="./downloads/schulverzeichnis.csv" npm run db:seed
```

Column names in the published NRW dataset have changed between releases, so the
mapping lives in [`prisma/data/nrw-column-mapping.json`](prisma/data/nrw-column-mapping.json)
and **must be verified against the file you import**. Read
[docs/OPEN_DATA.md](docs/OPEN_DATA.md) before the first production import.

Without `SEED_SCHOOLS_URL`/`SEED_SCHOOLS_FILE` the seed writes clearly labelled
synthetic demo records (`DEMO-*` school numbers, `example.org` addresses). They are
**not real schools** and must not be published.

## Routes

| Route | Description |
| --- | --- |
| `/` (and `/en`, `/tr`, `/uk`, `/ar`) | Search with radius, school type, OGS, language and open-house filters |
| `/schools/[id]` | School profile, dates, contact details, opt-in map |
| `/privacy` | Data-protection information (statically rendered) |
| `/signin` | Magic-link sign-in for school staff |
| `/admin` | Dashboard with recent changes (audit trail) |
| `/admin/profile` | School profile editor |
| `/admin/events` | Event CRUD |
| `GET /api/schools` | Public JSON search API |
| `GET /api/events/[eventId]/ics` | RFC 5545 calendar file for one event |
| `GET /api/health` | Liveness probe including a database check |
| `/imprint` | Impressum (§ 5 DDG), rendered from `src/config/operator.ts` |
| `/accessibility` | Accessibility statement (BITV 2.0 / EU Directive 2016/2102) |
| `GET /robots.txt` | Indexing rules; the staff area and API are excluded |
| `GET /sitemap.xml` | All public pages with `hreflang` alternates for the five locales |

## Discoverability

Parents reach a service like this through search, so this is treated as a feature:
`robots.txt`, a per-request `sitemap.xml` with `hreflang` alternates for all five
locales, canonical and Open Graph tags, and Schema.org `School`/`Event` structured
data on every school page so open house dates can appear as rich results. Set
`SITE_URL` to the public origin - the app warns in production if it is missing.

## Accessibility

Audited against WCAG 2.1 AA: **41 page states, 0 axe-core violations**, across
every public page in all five locales, the activated map, form error states and
the admin pages. Reflow at 320 px, 200 % text enlargement, keyboard-only
operation, focus visibility and heading structure were checked manually. The
audit found and fixed four real defects, including a success badge at 3.91:1 and
a `body { font-size: 16px }` rule that overrode the reader's own font-size
setting.

Contrast is guarded by `tests/contrast.test.ts`, which parses the oklch tokens
out of `globals.css` and asserts 4.5:1 for all 17 text/surface pairs in both
themes - no browser needed. Method, findings and the remaining gaps (no
screen-reader pass yet) are in [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md).

## Legal pages

`/imprint`, `/privacy` and `/accessibility` are implemented and translated, but
every operator-specific detail - legal name, address, data protection officer,
accessibility contact - lives in **one** file, `src/config/operator.ts`, so a
lawyer reviews one place instead of legal text in five languages.

Those values ship as `TODO:` placeholders. While any remain, `/imprint` renders a
visible notice listing the missing fields instead of pretending to be complete,
and `npm run check:legal` exits non-zero. **An Impressum is legally required in
Germany (§ 5 DDG) and must not be published with invented details** - fill the
config in and have both the imprint and the privacy policy reviewed before
launch.

## Privacy and compliance

Implemented, and verified end to end in a browser:

- The public pages set **no cookies** and issue **no third-party requests**. The only
  cookie in the app is the staff session cookie (`httpOnly`, `sameSite=lax`,
  `secure` in production).
- Map tiles from OpenStreetMap load only after the visitor clicks "load map"; the
  consent is not persisted anywhere.
- Device location is rounded to three decimals (~100 m) before it is sent to the
  server, and is never stored.
- Postal codes are resolved from a local table, so a search triggers no geocoding
  request to a third party.
- Every content edit is recorded in `AuditLog` with actor, timestamp and a field
  level diff.
- `style-src` carries no `'unsafe-inline'`; the remaining `script-src` exception is
  explained, with measurements, in [docs/PRIVACY.md](docs/PRIVACY.md#why-unsafe-inline-is-still-in-script-src).

Details and the deployment requirements (EU region, retention) are in
[docs/PRIVACY.md](docs/PRIVACY.md) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Known limitations

Documented rather than hidden - see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#known-limitations):

- Radius search filters a bounding box in SQL and refines distances in the
  application. Correct and index-friendly for city-scale data; a state-wide dataset
  should move to PostGIS `ST_DWithin`.
- Rate limiting is in-process, so the effective limit multiplies behind several
  instances. Back it with Redis before scaling out.
- Passkeys are not implemented. Magic links are complete; the WebAuthn provider
  additionally needs database sessions and an `Authenticator` model.
- CI covers typecheck, lint, unit tests, Prisma schema/migration drift, the build and
  an HTTP smoke test. The full browser flows are scripted in [`e2e/`](e2e/README.md)
  but run manually, as they need a seeded database and a magic link from the log.
- `script-src` still permits `'unsafe-inline'`; see the linked reasoning above.
- No screen-reader testing has been done - the largest remaining accessibility
  gap, and declared as such on `/accessibility`.
- The operator details in `src/config/operator.ts` are placeholders; the legal
  pages are structurally complete but not yet legally reviewed.
