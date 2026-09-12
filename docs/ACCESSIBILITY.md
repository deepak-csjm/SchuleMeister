# Accessibility

The public pages of this application are aimed at parents choosing a school,
including parents looking for a Förderschule. Accessibility is treated as a
requirement, not as polish - and where this application is operated by a public
body, WCAG 2.1 AA plus a published accessibility statement is a legal obligation
(BITV 2.0 / EU Directive 2016/2102).

The statement itself is a page in the app (`/accessibility`), translated into all
five locales, and its contact and enforcement details come from
`src/config/operator.ts`.

## What was tested, and how

Automated, against **WCAG 2.1 A and AA** with axe-core 4.13 (`e2e/a11y.mjs`):

- every public page - home, search results, school detail, privacy, imprint,
  accessibility statement, sign-in - in all five locales (de, en, tr, uk, ar),
- the interactive states automated sweeps usually miss: the activated Leaflet
  map, and forms showing server-side validation errors,
- the admin pages (dashboard, profile, event manager) with a real session.

**41 page states, 0 violations.**

Manually, for the criteria axe cannot evaluate (`e2e/a11y-manual.mjs`):

| Criterion | Result |
| --- | --- |
| 1.4.4 Resize text (200 %) | No horizontal scrolling or clipping |
| 1.4.10 Reflow (320 px) | No horizontal scrolling on any page, RTL included |
| 2.1.1 Keyboard | Search submits with Enter; the map activates from the keyboard |
| 2.4.1 Bypass blocks | The skip link is the first tab stop and moves focus to `#main` |
| 2.4.7 Focus visible | 39/39 focusable controls show a focus indicator |
| 1.3.1 Structure | Exactly one `h1` per page, no skipped heading levels, one `main` |
| 3.1.1 Language of page | `lang` and `dir` are set per locale (`dir="rtl"` for Arabic) |

Re-run both scripts after UI changes - see [`e2e/README.md`](../e2e/README.md).

## What the audit found and fixed

All four were real defects, found by running the audit rather than by reading the
code:

1. **Success badge contrast 3.91:1** (needs 4.5:1). The `--success` token was
   `oklch(0.55 0.13 155)`, which on the `bg-success/12` tint used by the "OGS
   available" badge fell below AA. Now `oklch(0.48 0.13 155)` - 5.07:1 on the
   badge, 5.89:1 on the page. `--destructive` was simultaneously moved from
   `0.58` to `0.56` because its button label sat at exactly 4.50:1, which is too
   close to the line to survive rounding differences between engines.
2. **Map markers had no accessible name.** Leaflet gives interactive markers
   `role="button"`; without a name a screen reader announces an unlabelled
   button (4.1.2). The markers now carry the school name via `title`/`alt`.
3. **Leaflet's attribution link relied on colour alone** (2.55:1 against the
   surrounding text, WCAG 1.4.1). Underlined and darkened. `leaflet.css` ships in
   the lazily imported map chunk and therefore loads *after* `globals.css`, so
   the override is scoped through `.leaflet-container` to win on specificity
   rather than on order.
4. **`body { font-size: 16px }` overrode the reader's own font-size setting**
   (1.4.4) - a fixed pixel size silently discards a browser preference that
   someone may depend on. Now `1rem`, which still resolves to 16px by default and
   still prevents iOS Safari from zooming on focused inputs. Fixing this exposed
   a layout bug at 200 % text: the results grid went two-up at 640 px and the
   cards overflowed, so it now waits for `md`, and the text rows inside a card
   carry `min-w-0 break-words` (flex children default to `min-width: auto` and
   refuse to shrink).

## Guarding against regressions

Contrast is the easiest of these to break again, and a browser audit is the
slowest way to catch it. `tests/contrast.test.ts` therefore parses the oklch
tokens straight out of `globals.css` and asserts WCAG 1.4.3 for all 17
text/surface pairs in **both** themes, including the translucent badge tints -
no browser required, and it runs with `npm test`. The test was verified to fail
on the original `--success` value and pass on the corrected one.

The colour maths lives in `src/lib/color-contrast.ts` (oklch to sRGB, relative
luminance, contrast ratio, alpha compositing) and is unit tested against known
values.

## Known limitations

Declared honestly on `/accessibility` as well, because an accessibility
statement that claims full conformance without a screen-reader pass is not worth
much:

- **No screen-reader testing.** NVDA, JAWS and VoiceOver have not been used, and
  no testing with disabled users has taken place. Automated rules catch a
  minority of real accessibility problems; this is the biggest remaining gap.
- **Map interaction.** Markers are reachable and named, but full keyboard and
  screen-reader semantics of the Leaflet control surface are unverified. Every
  piece of information on the map is also available as a list and as text on the
  school pages, and the map loads only after explicit consent.
- **School-authored text.** Descriptions and admission notes are written by
  school staff; their clarity and structure are outside the operator's control.
- **Not wired into CI.** The browser audit needs Chromium and a seeded database.
  The contrast test is in `npm test`; the axe sweep is a manual pre-release step.
