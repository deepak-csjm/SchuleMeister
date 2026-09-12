/**
 * The parent journey, asserted end to end.
 *
 * The privacy guarantees are the point of this script: a full journey must
 * leave the cookie jar empty and must not contact any third party until the
 * visitor explicitly activates the map.
 */
import { BASE, check, checkEqual, discoverFixtures, finish, launchBrowser, section } from './_harness.mjs';

const { schoolWithEventId, schoolCount } = await discoverFixtures();
const browser = await launchBrowser();
const context = await browser.newContext({ locale: 'de-DE' });
const page = await context.newPage();

const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

// Every request to a host other than the app itself, recorded from the start.
const thirdParty = [];
page.on('request', (request) => {
  const { host } = new URL(request.url());
  if (!BASE.includes(host)) thirdParty.push(host);
});

section('landing page');
await page.goto(BASE, { waitUntil: 'networkidle' });
check('heading is rendered', (await page.locator('h1').textContent())?.includes('Schule') ?? false);
check(
  'all seeded schools are listed',
  (await page.locator('h2[role=status]').textContent())?.includes(String(schoolCount)) ?? false,
  `${schoolCount} schools`,
);
checkEqual('no third-party request before map consent', [...new Set(thirdParty)].join(',') || 'none', 'none');
checkEqual('no cookies set', (await context.cookies()).length, 0);

section('search and filters');
await page.fill('#q', '40213');
await page.selectOption('#radius', '2');
await page.check('#ogs');
await page.locator('form button[type=submit]').first().click();
await page.waitForURL(/q=40213/, { timeout: 20000 });
await page.waitForLoadState('networkidle');
const search = new URL(page.url()).search;
check('filters are reflected in a shareable URL', search.includes('radius=2') && search.includes('ogs=true'), search);
const resultCount = Number(/(\d+)/.exec((await page.locator('h2[role=status]').textContent()) ?? '')?.[1] ?? 0);
check('the radius narrows the result set', resultCount > 0 && resultCount < schoolCount, `${resultCount} of ${schoolCount}`);
check('the resolved location is shown', ((await page.locator('h2[role=status] ~ p').textContent()) ?? '').includes('40213'));

section('map consent gate');
const loadMap = page.getByRole('button', { name: 'Karte laden' });
check('the map is behind an explicit opt-in', await loadMap.isVisible());
checkEqual('still no third-party request', [...new Set(thirdParty)].join(',') || 'none', 'none');
await loadMap.click();
await page.waitForSelector('.leaflet-container', { timeout: 20000 });
await page.waitForTimeout(2500);
check('tiles are requested only after consent', thirdParty.some((host) => host.endsWith('tile.openstreetmap.org')), [...new Set(thirdParty)].join(', '));
check('the map renders', await page.locator('.leaflet-container').isVisible());

section('locale switching');
await page.locator('header select').selectOption('ar');
await page.waitForURL(/\/ar/, { timeout: 20000 });
const arabic = new URL(page.url());
check('the query survives a locale change', arabic.search.includes('q=40213'), arabic.pathname + arabic.search);
checkEqual('Arabic renders right-to-left', await page.locator('html').getAttribute('dir'), 'rtl');

section('school detail and calendar export');
await page.goto(`${BASE}/schools/${schoolWithEventId}`, { waitUntil: 'networkidle' });
check('the school page renders', ((await page.locator('h1').textContent()) ?? '').length > 0);
const icsHref = await page.locator('a[href*="/ics"]').first().getAttribute('href');
check('an "add to calendar" link is present', Boolean(icsHref), icsHref ?? 'missing');

const ics = await page.request.get(BASE + icsHref);
checkEqual('the .ics route answers 200', ics.status(), 200);
check('it is served as a calendar', (ics.headers()['content-type'] ?? '').startsWith('text/calendar'));
check('it is served as a download', (ics.headers()['content-disposition'] ?? '').includes('attachment'));
const body = await ics.text();
check('the payload is a valid VCALENDAR', body.startsWith('BEGIN:VCALENDAR\r\n') && body.trimEnd().endsWith('END:VCALENDAR'));
check('it contains exactly one event', (body.match(/BEGIN:VEVENT/g) ?? []).length === 1);

section('end of journey');
checkEqual('the cookie jar is still empty', (await context.cookies()).map((c) => c.name).join(',') || 'empty', 'empty');
checkEqual(
  'only the app and the tile service were contacted',
  [...new Set(thirdParty)].filter((host) => !host.endsWith('tile.openstreetmap.org')).join(',') || 'none',
  'none',
);
checkEqual('no uncaught page errors', pageErrors.join(' | ') || 'none', 'none');

await browser.close();
finish();
