/**
 * The staff journey, asserted end to end: profile editing, event CRUD,
 * server-side validation, the audit trail, and tenant isolation.
 *
 *   SESSION=$(node e2e/get-session.mjs sekretariat@example.org)
 *   node e2e/admin.mjs "$SESSION"
 */
import { BASE, check, checkEqual, finish, launchBrowser, section } from './_harness.mjs';

const session = process.argv[2];
if (!session) {
  console.error('usage: node e2e/admin.mjs "<session-cookie-value>" (see e2e/get-session.mjs)');
  process.exit(1);
}

const browser = await launchBrowser();
const context = await browser.newContext({ locale: 'de-DE' });
await context.addCookies([
  {
    name: 'schulkompass.session',
    value: session,
    domain: new URL(BASE).hostname,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  },
]);
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

/** Submits the form that contains the given field, scoped so the layout's
 *  sign-out form cannot be hit by accident. */
async function submitFormWith(fieldSelector) {
  await page.locator(`form:has(${fieldSelector}) button[type=submit]`).click();
}

section('school profile');
await page.goto(`${BASE}/admin/profile`, { waitUntil: 'networkidle' });
checkEqual('the profile editor loads', await page.locator('h2').first().textContent(), 'Schulprofil bearbeiten');

const headmaster = `E2E Leitung ${Date.now()}`;
await page.fill('#headmaster', headmaster);
await page.fill('#languages', 'Englisch, Niederländisch');
await submitFormWith('#name');
await page.waitForSelector('form:has(#name) [role=status]', { timeout: 20000 });
check('saving reports success', ((await page.locator('form:has(#name) [role=status]').textContent()) ?? '').includes('gespeichert'));

await page.reload({ waitUntil: 'networkidle' });
checkEqual('the change persisted', await page.inputValue('#headmaster'), headmaster);

section('server-side validation');
await page.fill('#postalCode', '4');
await submitFormWith('#name');
await page.waitForSelector('#postalCode-error', { timeout: 20000 });
check('an invalid postal code is rejected', ((await page.locator('#postalCode-error').textContent()) ?? '').includes('fünfstellige'));
check('the error is announced to assistive tech', (await page.locator('#postalCode-error').getAttribute('role')) === 'alert');
check('the rest of the form is preserved', (await page.inputValue('#headmaster')) === headmaster);

section('event creation');
await page.goto(`${BASE}/admin/events`, { waitUntil: 'networkidle' });
const before = await page.locator('section ul > li').count();
const title = `E2E Tag der offenen Tür ${Date.now()}`;
await page.fill('#title', title);
await page.selectOption('#eventType', 'OPEN_HOUSE');
await page.fill('#eventDate', '2027-03-15');
await page.fill('#startTime', '10:00');
await page.fill('#endTime', '13:00');
await page.fill('#location', 'Aula');
await submitFormWith('#title');
await page.waitForSelector('form:has(#title) [role=status]', { timeout: 20000 });
check('creating an event reports success', ((await page.locator('form:has(#title) [role=status]').textContent()) ?? '').includes('angelegt'));

await page.goto(`${BASE}/admin/events`, { waitUntil: 'networkidle' });
checkEqual('the event appears in the list', await page.locator('section ul > li').count(), before + 1);

section('cross-field validation');
await page.fill('#title', 'E2E ungültig');
await page.fill('#eventDate', '2027-04-01');
await page.fill('#startTime', '14:00');
await page.fill('#endTime', '09:00');
await submitFormWith('#title');
await page.waitForSelector('#endTime-error', { timeout: 20000 });
check('an end time before the start is rejected', ((await page.locator('#endTime-error').textContent()) ?? '').includes('nach dem Beginn'));

section('event editing');
await page.goto(`${BASE}/admin/events`, { waitUntil: 'networkidle' });
const row = page.locator('li', { hasText: title }).first();
const editHref = await row.locator('a[href*="/admin/events/"]').first().getAttribute('href');
check('the list links to the editor', Boolean(editHref), editHref ?? 'missing');
await row.locator('a[href*="/admin/events/"]').first().click();
await page.waitForURL(/\/admin\/events\/[^/]+$/, { timeout: 20000 });
checkEqual('the editor is prefilled', await page.inputValue('#title'), title);

const renamed = `${title} (bearbeitet)`;
await page.fill('#title', renamed);
await page.uncheck('#isPublished');
await submitFormWith('#title');
await page.waitForSelector('form:has(#title) [role=status]', { timeout: 20000 });
check('updating reports success', ((await page.locator('form:has(#title) [role=status]').textContent()) ?? '').includes('aktualisiert'));

section('unpublished events stay private');
const schoolLink = await page.locator('a[href*="/schools/"]').first().getAttribute('href');
const publicPage = await page.request.get(BASE + schoolLink);
check('the public school page still loads', publicPage.status() === 200);
check('the unpublished event is not on it', !(await publicPage.text()).includes(renamed));

section('tenant isolation');
// A seeded event belonging to a different school must be indistinguishable
// from one that does not exist.
const foreign = await page.request.get(`${BASE}/admin/events/seed-demo-info-evening-gym`, { maxRedirects: 0 });
const missing = await page.request.get(`${BASE}/admin/events/does-not-exist-at-all`, { maxRedirects: 0 });
checkEqual("another school's event answers 404", foreign.status(), 404);
checkEqual('a nonexistent event answers the same', missing.status(), foreign.status());

section('audit trail');
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
const entries = await page.locator('ol > li').allTextContents();
check('recent changes are listed', entries.length >= 3, `${entries.length} entries`);
check('actions are shown in readable German, not as identifiers', entries.some((entry) => entry.includes('Termin') || entry.includes('Schulprofil')), entries[0]?.replace(/\s+/g, ' ').trim() ?? '');
check('the acting account is recorded', entries.every((entry) => entry.includes('@')));

section('event deletion');
await page.goto(`${BASE}/admin/events`, { waitUntil: 'networkidle' });
page.once('dialog', (dialog) => dialog.accept());
const countBeforeDelete = await page.locator('section ul > li').count();
await page.locator('li', { hasText: renamed }).first().locator('button[type=submit]').click();
await page.waitForFunction(
  (expected) => document.querySelectorAll('section ul > li').length === expected,
  countBeforeDelete - 1,
  { timeout: 20000 },
);
checkEqual('the event is removed', await page.locator('section ul > li').count(), countBeforeDelete - 1);

checkEqual('no uncaught page errors', pageErrors.join(' | ') || 'none', 'none');

await browser.close();
finish();
