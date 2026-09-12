# Deployment

## Requirements

- Node.js 20.11+ (the build is verified on Node 22)
- PostgreSQL 14+ **in an EU region** (Frankfurt / `eu-central-1`)
- An EU-hosted SMTP provider for magic links, covered by a DPA

## Environment variables

Copy `.env.example` and fill in. `src/lib/env.ts` validates the values at first use
and fails the request with an explicit list of problems rather than starting in a
half-configured state.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | EU region. For a pooled connection append `?pgbouncer=true&connection_limit=1` |
| `AUTH_SECRET` | yes | `npx auth secret` or `openssl rand -base64 32` |
| `AUTH_URL` | yes in production | Public origin; magic-link callbacks are built from it |
| `ALLOWED_ADMIN_EMAIL_DOMAINS` | yes | Comma-separated. Supports `*.nrw.schule` for subdomains |
| `EMAIL_FROM`, `EMAIL_SERVER_HOST`, `EMAIL_SERVER_PORT` | yes | Port 465 switches to implicit TLS |
| `EMAIL_SERVER_USER`, `EMAIL_SERVER_PASSWORD` | if the relay needs auth | Omit both for an unauthenticated relay |
| `AUTH_DEV_LOG_MAGIC_LINK` | no | Development only. **The app refuses to start serving with this enabled and `NODE_ENV=production`** |
| `SEED_SCHOOLS_URL` / `SEED_SCHOOLS_FILE` | no | Open-data import source, see [OPEN_DATA.md](OPEN_DATA.md) |

`AUTH_URL` must match the origin users actually reach. A mismatch produces magic links
pointing at the wrong host - the failure mode is a link that 404s or logs the user
into the wrong environment.

## Release steps

```bash
npm ci
npm run db:deploy     # prisma migrate deploy - never `migrate dev` in production
npm run build
npm start
```

`npm run build` runs the TypeScript check as part of the build, so a type error fails
the release. Run `npm test` and `npm run lint` in CI before building.

`postinstall` runs `prisma generate`, so the client is always in sync with the schema
in a fresh install.

## Vercel

- Set every variable above in the project settings; pick **Frankfurt (eu-central-1)**
  as the function region so requests are not served from outside the EU.
- Use a pooled `DATABASE_URL` (Prisma Accelerate, Supabase pooler or PgBouncer);
  serverless functions otherwise exhaust Postgres connections.
- Run `prisma migrate deploy` as a release command, not at request time.

## Hetzner / self-hosted

- `npm run build && npm start` behind a TLS-terminating reverse proxy.
- Forward `X-Forwarded-For` - it is the key the sign-in rate limiter uses.
- `trustHost: true` is set in `src/auth.ts`, which is required behind a proxy; make
  sure the proxy cannot be made to forge the `Host` header from outside.
- Run more than one instance only after replacing the in-process rate limiter
  (see [ARCHITECTURE.md](ARCHITECTURE.md#known-limitations)).

## Health check

`GET /api/health` returns `200 {"status":"ok"}` when the database is reachable and
`503 {"status":"degraded"}` otherwise, with `Cache-Control: no-store`. Use it as the
readiness probe.

## Provisioning school accounts

Access is invite-only: there is no self-registration. An address must both match
`ALLOWED_ADMIN_EMAIL_DOMAINS` and exist in the `User` table.

```sql
INSERT INTO "User" (id, email, role, "schoolId", "createdAt", "updatedAt")
SELECT gen_random_uuid(), 'sekretariat@musterschule.nrw.schule', 'SECRETARY', s.id, now(), now()
FROM "School" s
WHERE s."officialCode" = '123456';
```

To revoke access, set `isActive = false` - it takes effect on the next request and
keeps the audit trail attributable. Deleting the row also works but loses the link
between the log entries and the account.

## Operational notes

- **Backups:** the audit trail is the compliance-relevant table; make sure it is in
  the backup set and that retention matches your data-protection documentation.
- **Log hygiene:** the app logs no parent data and no magic links (outside the
  development flag). Keep it that way when adding logging - a magic link in a log
  file is a credential.
- **Data refresh:** re-running the open-data import is safe and idempotent, but it
  resets official fields (name, address, contact) to the dataset values. See
  [OPEN_DATA.md](OPEN_DATA.md#interaction-with-school-edited-content).
