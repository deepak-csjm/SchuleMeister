/**
 * Accessibility-tree checks: what assistive technology is actually handed.
 *
 * Deliberately narrow. It covers only what axe-core cannot evaluate, so it does
 * not duplicate `a11y.mjs` (which runs the WCAG 2.1 A/AA and best-practice rule
 * sets, including heading order, landmark uniqueness and accessible names):
 *
 *   1. links that announce identically but lead somewhere different,
 *   2. whether the result count is both a heading and an announcement, and
 *      whether the announcement actually changes when the filters change,
 *   3. whether a form error is programmatically associated with its field,
 *   4. whether map markers announce which school they are.
 *
 * Accessible names come from Chromium's own computation via CDP - a hand-rolled
 * name algorithm gets this wrong, which is how an earlier version of this audit
 * produced a false report about the language switcher.
 *
 * Note on ordering: `Accessibility.getFullAXTree` does not return nodes in
 * document order, so anything positional is read from the DOM instead. This is
 * also not a substitute for testing with a real screen reader and real users,
 * which remains outstanding and is declared on /accessibility.
 */
import { BASE, check, checkEqual, discoverFixtures, finish, launchBrowser, section } from './_harness.mjs';

const SESSION = process.argv[2];
const browser = await launchBrowser();
const context = await browser.newContext({ locale: 'de-DE' });
const page = await context.newPage();

/**
 * Computed accessible name for every element matching `selector`, paired with
 * an attribute of choice, using CDP for both halves so the two stay correlated.
 */
async function computedNames(cdpSession, selector, attribute) {
  const { root } = await cdpSession.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await cdpSession.send('DOM.querySelectorAll', {
    nodeId: root.nodeId,
    selector,
  });

  const results = [];
  for (const nodeId of nodeIds) {
    const [{ nodes }, { attributes }] = await Promise.all([
      cdpSession.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false }),
      cdpSession.send('DOM.getAttributes', { nodeId }),
    ]);

    const pairs = new Map();
    for (let index = 0; index < attributes.length; index += 2) {
      pairs.set(attributes[index], attributes[index + 1]);
    }

    results.push({
      name: (nodes?.[0]?.name?.value ?? '').replace(/\s+/g, ' ').trim(),
      value: pairs.get(attribute) ?? '',
    });
  }

  return results;
}

const cdp = await context.newCDPSession(page);
await cdp.send('DOM.enable');
await cdp.send('Accessibility.enable');

section('links announce distinguishable names (WCAG 2.4.4)');
await page.goto(`${BASE}/?q=40213&radius=5`, { waitUntil: 'networkidle' });
const links = await computedNames(cdp, 'a[href]', 'href');
check('accessible names were computed for the links', links.some((l) => l.name.length > 0), `${links.length} links`);
check('no link is missing a name', links.every((l) => l.name.length > 0), links.filter((l) => !l.name).map((l) => l.value).join(', ') || 'all named');

const destinations = new Map();
for (const link of links) {
  destinations.set(link.name, new Set([...(destinations.get(link.name) ?? []), link.value]));
}
// Repeating the same words is fine when they lead to the same place (the header
// and footer both link to /signin); it is a problem when they do not.
const collisions = [...destinations.entries()].filter(([name, hrefs]) => name && hrefs.size > 1);
check(
  'identically named links share a destination',
  collisions.length === 0,
  collisions.map(([name, hrefs]) => `"${name}" -> ${[...hrefs].join(' , ')}`).join('; ') || 'none',
);

section('the result count is a heading and an announcement');
const countIsHeading = async () =>
  page.evaluate(() => {
    const headings = [...document.querySelectorAll('h1,h2,h3')];
    const match = headings.find((h) => /gefunden/.test(h.textContent ?? ''));
    return match ? { tag: match.tagName, role: match.getAttribute('role') } : null;
  });

const heading = await countIsHeading();
check('the count is a real heading', heading !== null && !heading.role, heading ? `${heading.tag} role=${heading.role ?? 'none'}` : 'not found');

const liveRegion = await page.evaluate(() => {
  const region = document.querySelector('[aria-live]');
  if (!region) return null;
  return {
    live: region.getAttribute('aria-live'),
    atomic: region.getAttribute('aria-atomic'),
    containsCount: /gefunden/.test(region.textContent ?? ''),
  };
});
check('a polite live region wraps the count', liveRegion?.live === 'polite' && liveRegion.containsCount === true, JSON.stringify(liveRegion));

const announcementBefore = (await page.locator('[aria-live]').first().textContent())?.replace(/\s+/g, ' ').trim();
await page.selectOption('#radius', '20');
await page.locator('form button[type=submit]').first().click();
await page.waitForURL(/radius=20/, { timeout: 20000 });
await page.waitForLoadState('networkidle');
const announcementAfter = (await page.locator('[aria-live]').first().textContent())?.replace(/\s+/g, ' ').trim();
check('changing a filter changes what would be announced', Boolean(announcementBefore) && announcementBefore !== announcementAfter, `"${announcementBefore}" -> "${announcementAfter}"`);
check('the count is still a heading afterwards', (await countIsHeading()) !== null);

section('map markers announce which school they are');
await page.goto(`${BASE}/?q=40213&radius=5`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Karte laden' }).click();
await page.waitForSelector('.leaflet-marker-icon', { timeout: 20000 });
await page.waitForTimeout(1500);
const markerCdp = await context.newCDPSession(page);
await markerCdp.send('DOM.enable');
await markerCdp.send('Accessibility.enable');
const markers = await computedNames(markerCdp, '.leaflet-marker-icon', 'title');
check('markers are present', markers.length > 0, `${markers.length} markers`);
check('every marker has an accessible name', markers.every((m) => m.name.length > 0), markers.filter((m) => !m.name).length ? `${markers.filter((m) => !m.name).length} unnamed` : 'all named');
check('marker names are school names, not generic labels', new Set(markers.map((m) => m.name)).size === markers.length, markers.slice(0, 2).map((m) => `"${m.name}"`).join(', '));

section('form errors are associated with their field');
await page.goto(`${BASE}/signin`, { waitUntil: 'networkidle' });
await page.fill('#email', 'not-an-email');
await page.locator('form button[type=submit]').click();
// Scope the wait to this form's own error node: a bare [role=alert] can match
// framework-injected nodes and pass before the form has re-rendered.
await page.waitForSelector('#signin-error', { timeout: 20000 });

const association = await page.evaluate(() => {
  const field = document.querySelector('#email');
  const describedBy = field?.getAttribute('aria-describedby') ?? '';
  const ids = describedBy.split(/\s+/).filter(Boolean);
  return {
    invalid: field?.getAttribute('aria-invalid'),
    describedBy,
    resolves: ids.length > 0 && ids.every((id) => Boolean(document.getElementById(id))),
    text: ids.map((id) => document.getElementById(id)?.textContent?.trim() ?? '').join(' '),
    role: document.getElementById('signin-error')?.getAttribute('role'),
  };
});
checkEqual('the field is marked invalid', association.invalid, 'true');
check('the field points at its error message', association.resolves, association.describedBy || 'no aria-describedby');
check('the error message carries text', association.text.length > 0, association.text);
checkEqual('the error is announced assertively', association.role, 'alert');

if (SESSION) {
  section('admin form errors are associated too');
  const staff = await browser.newContext({ locale: 'de-DE' });
  await staff.addCookies([
    { name: 'schulkompass.session', value: SESSION, domain: new URL(BASE).hostname, path: '/', httpOnly: true, sameSite: 'Lax' },
  ]);
  const staffPage = await staff.newPage();
  await staffPage.goto(`${BASE}/admin/profile`, { waitUntil: 'networkidle' });
  await staffPage.fill('#postalCode', '4');
  await staffPage.locator('form:has(#name) button[type=submit]').click();
  await staffPage.waitForSelector('#postalCode-error', { timeout: 20000 });

  const adminAssociation = await staffPage.evaluate(() => {
    const field = document.querySelector('#postalCode');
    const ids = (field?.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
    return {
      invalid: field?.getAttribute('aria-invalid'),
      resolves: ids.length > 0 && ids.every((id) => Boolean(document.getElementById(id))),
      role: document.getElementById('postalCode-error')?.getAttribute('role'),
    };
  });
  checkEqual('the field is marked invalid', adminAssociation.invalid, 'true');
  check('the field points at its error message', adminAssociation.resolves);
  checkEqual('the error is announced assertively', adminAssociation.role, 'alert');
  await staff.close();
}

await browser.close();
finish();
