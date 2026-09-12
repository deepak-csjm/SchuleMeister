# Architecture

## Shape of the application

```
src/
  app/
    [locale]/                 public pages + admin panel (locale-prefixed)
    api/                      auth handler, search API, .ics route, health probe
  components/                 UI (server components by default)
    admin/                    forms that call server actions
    ui/                       shadcn-style primitives
  server/
    schools.ts                read model for search and detail views
    actions/                  server actions (the only write path from the UI)
  lib/                        framework-light building blocks, unit tested
  i18n/                       next-intl routing, request config, navigation
  proxy.ts                    locale negotiation + cheap admin redirect
prisma/
  schema.prisma               data model
  seed.ts                     demo seed *and* open-data importer
  data/                       column mapping + labelled demo fixtures
```

Two rules keep the layering honest:

1. **Writes go through server actions.** There is no mutating API route, so every
   write passes the same guard (`requireStaffUser`) and the same validation schema.
2. **Business rules live in `src/lib` without framework imports.** Distance maths,
   ICU-free date handling, the ICS writer, validation, the email allow list and the
   permission predicate are all plain modules, which is why 143 unit tests can cover
   them without a database or a running server.

## Deliberate decisions

### Search results are rendered on the server, state lives in the URL

`/?q=40213&radius=2&ogs=true` is the complete search state. There is no client-side
data fetching, no loading spinner cascade and no duplicated filter logic: the page is
a server component that calls `searchSchools()`. Results are shareable and the back
button behaves correctly. `GET /api/schools` exposes the same read model for
programmatic consumers.

### Radius search: bounding box in SQL, exact distance in the application

`searchSchools()` narrows candidates with an indexed `latitude`/`longitude` bounding
box, then computes the exact haversine distance in TypeScript and filters and sorts on
it. The alternative - a raw SQL `HAVING` on a hand-written haversine expression -
would push the maths into a string that cannot be type-checked or unit tested, for no
measurable gain at city scale (a 50 km box over Düsseldorf holds a few hundred rows).

The trade-off is explicit: it is `O(rows in box)` transferred per query. See
[Known limitations](#known-limitations).

### Postal codes are resolved locally

A `PostalCode` table maps PLZ to a centroid. Calling a geocoding API would send the
parent's search term (and IP) to a third party on every query, which would break the
zero-tracking property that the product is built around. When no authoritative PLZ
dataset is configured, the seed derives centroids from the coordinates of the schools
in each postal code - self-consistent, and it makes no geographic claim of its own.

### A custom Auth.js adapter instead of `@auth/prisma-adapter`

The specified `User` model requires a `schoolId`, and access is invite-only. The
standard Prisma adapter creates a user row for any address that completes the
magic-link flow, which cannot satisfy either constraint. `src/lib/auth-adapter.ts`
therefore implements only what the email flow with JWT sessions needs - verification
token storage and read-only user lookup - and makes every user-creating or
session-persisting method throw, so a future change of provider or session strategy
cannot silently start auto-provisioning accounts.

### No account enumeration on the sign-in endpoint

Requesting a link for an address that is not provisioned returns exactly the same
"check your inbox" screen as a successful request; the mail is simply not sent. A
non-school email *domain* is rejected visibly, because the allow list is public
policy rather than information about a person. Verified in
[`e2e/`](../e2e/README.md).

### JWT sessions, with the database as the authority

Session cookies carry claims, so an ordinary request needs no session lookup. Every
admin page and every server action nevertheless calls `requireStaffUser()`, which
re-reads the account and its `isActive` flag. Deactivating a user therefore takes
effect on the next request rather than when the session expires. `src/proxy.ts` only
checks for the *presence* of a cookie - a UX optimisation, explicitly not the
security boundary.

### 404 instead of 403 for another school's resources

`canEditSchool()` is a pure predicate; pages answer a failed check with `notFound()`
and server actions with a generic "not found" form error. A secretary of another
school gets a response indistinguishable from a non-existent id, so event ids cannot
be probed. (`forbidden()` was rejected: in Next 16 it still requires the experimental
`authInterrupts` flag, which is not something to depend on for an authorisation path.)

### The public header does not read the session

An `auth()` call in the shared header would touch the session cookie and hit the
database on every public page view, making every page dynamic and uncacheable. The
header is session-free, which is what lets `/privacy` and `/signin/check-email`
prerender statically for all five locales.

### Times are stored as a date plus `"HH:mm"` text

Schools publish wall-clock times ("open house 09:00-13:00"), and registration windows
have no time at all. Storing a UTC timestamp would force a timezone decision at write
time and would silently shift published times across a DST boundary.
`src/lib/datetime.ts` converts Berlin wall-clock time to the correct UTC instant only
where an absolute instant is genuinely required - when writing `.ics` files - using
`Intl` rather than a date library. The DST behaviour is pinned by unit tests on both
sides of both 2027 transitions.

### Native selects and link-based downloads

The filter controls are native `<select>` elements and "add to calendar" is a plain
`<a download>` pointing at the `.ics` route. Both work without JavaScript, give the
platform picker on mobile and keep the client bundle small - which matters more for a
parent on a phone than a custom dropdown does.

## Schema additions beyond the specification

The specified schema could not express several required features, so four models and
some fields were added. Everything is additive; nothing specified was changed.

| Addition | Why it is required |
| --- | --- |
| `AuditLog` | "Record timestamp and user ID for all content edits" - there was nowhere to record them |
| `VerificationToken` | Auth.js magic links need single-use token storage |
| `PostalCode` | PLZ radius search without third-party geocoding |
| `School.headmaster`, `.description`, `.languages`, `.facilities`, `.registrationNotes` | Named in the parent detail view and in the profile manager |
| `School.createdAt`, indexes on `postalCode`/`city`/`type`/coordinates | Search performance |
| `User.emailVerified`, `.isActive`, `.lastLoginAt`, `.updatedAt` | Magic-link state and revoking access without deleting the audit trail |
| `Event.eventType`, `.targetGrade`, `.isPublished` | Distinguishing open house / info evening / registration, "Target Grade", and drafts |

`Event.eventType` uses an enum rather than free text so the public filter
("only schools with an upcoming open house") can be an indexed query.

## Known limitations

These are real and deliberate, not oversights:

1. **Radius search does not scale to a state-wide dataset.** The bounding-box +
   application-side refinement is correct but transfers every row inside the box. With
   ~5,500 NRW schools this is still fine; beyond that, add PostGIS and replace the
   filter with `ST_DWithin`. The read model is isolated in `src/server/schools.ts`, so
   the change is local.
2. **Rate limiting is per process.** `src/lib/rate-limit.ts` is an in-memory fixed
   window. Behind N instances the effective limit is N times the configured one. Move
   it to Redis/Upstash before horizontal scaling.
3. **Passkeys are not implemented.** The brief allowed "magic links / passkeys" and
   magic links are complete. The Auth.js WebAuthn provider additionally requires
   database sessions and an `Authenticator` model, which conflicts with the current
   JWT strategy - a deliberate scope decision, not a stub.
4. **No CI end-to-end suite.** Unit tests cover the pure logic; the auth, CRUD and
   privacy flows were verified manually in Chromium and the scripts are checked in
   under `e2e/`, but they are not wired into `npm test` because they need a running
   server and a seeded database.
5. **Audit diffs store values, not a signed chain.** Good enough to answer "who
   changed this and when"; it is not tamper-evident.
6. **`SUPER_ADMIN` has no UI for picking a school.** The role bypasses the
   school-scope check in `canEditSchool()`, but the admin pages still operate on the
   school attached to the account.
