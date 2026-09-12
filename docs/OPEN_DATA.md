# Importing the NRW school directory

`prisma/seed.ts` is both the demo seed and the open-data importer. The parsing and
mapping logic lives in `src/lib/open-data.ts` and is covered by unit tests
(`tests/open-data.test.ts`).

## Running an import

```bash
# from a URL
SEED_SCHOOLS_URL="https://.../schulverzeichnis.csv" npm run db:seed

# from a local download (recommended for the first run, so you can inspect the file)
SEED_SCHOOLS_FILE="./downloads/schulverzeichnis.csv" npm run db:seed
```

The importer:

1. reads the column mapping from `prisma/data/nrw-column-mapping.json`;
2. parses the file (RFC 4180 quoting, `;` or `,` delimiter, UTF-8 BOM tolerated);
3. validates each row with Zod and normalises the school form
   (`Grundschule`, `GS`, `GY`, `Förderschule`, ... -> our `SchoolType` enum);
4. upserts by `officialCode` (the NRW *Schulnummer*);
5. derives `PostalCode` centroids from the imported coordinates;
6. prints every rejected row with the reason, and continues.

It is idempotent: running it twice leaves the database in the same state.

## Before the first production import: verify the column mapping

**The column names in the published dataset have changed between releases.** The
mapping file lists the names this importer accepts:

```json
"officialCode": ["Schulnummer", "schulnummer", "SNR", "schul_nr"],
"type":         ["Schulform", "Schulform_Kurz", "SF", "schulform_bezeichnung"],
```

Matching is case-insensitive and the first name found wins. If a required column
(`officialCode`, `name`, `type`, `address`, `postalCode`, `city`) cannot be matched,
the import aborts with the list of column names it actually found - add the correct
name to the mapping and re-run. Optional columns that are missing simply stay `null`.

The mapping shipped here was written against the documented field names of the
*Schulverzeichnis* and has **not** been validated against a live download, because
the build environment had no outbound access to the dataset. Treat the first import
as a verification step: check the printed counts and a handful of rows before making
the data public.

## Rejection policy

Individual rows are rejected rather than aborting the import:

| Situation | Behaviour |
| --- | --- |
| Unknown school form | Row rejected (these are usually non-school entries) |
| Postal code not five digits | Row rejected |
| Invalid email address | Row rejected - publishing a wrong contact address is worse than publishing none |
| Website without a scheme | `https://` prepended; unparseable values become `null` |
| Missing coordinates | Imported with `null`; the school is then excluded from radius results but still findable by PLZ or city |
| Duplicate `Schulnummer` | First occurrence kept, later ones rejected |

## Interaction with school-edited content

The importer writes only the fields the dataset provides. Profile text that a school
maintains itself - `description`, `registrationNotes`, `languages`, `facilities`,
`headmaster` - is left untouched by an import, so a nightly refresh cannot overwrite
a secretary's work.

If you re-run the importer after schools have started editing, the name, address and
contact fields **will** be reset to the official values. That is usually what you
want; if not, move those fields behind the same "do not overwrite" rule in
`upsertSchools()`.

## Demo data

Without `SEED_SCHOOLS_URL`/`SEED_SCHOOLS_FILE` the seed loads
`prisma/data/demo-schools.json`: twelve **synthetic** records with `DEMO-` school
numbers, placeholder street names, non-existent phone numbers and `example.org` email
addresses. They exist so the app can be developed and demonstrated without the real
dataset. The seed refuses to write them once any non-`DEMO-` school is present, so
demo rows cannot be mixed into an imported dataset. They must never be published as
real school information.
