import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:3101';
const EXEC = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const log = (...a) => console.log(...a);

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
const context = await browser.newContext({ locale: 'de-DE' });
const page = await context.newPage();
page.on('pageerror', (e) => log('PAGE ERROR:', e.message));

// Record every third-party request to prove the map is not loaded unprompted.
const external = [];
page.on('request', (r) => {
  const host = new URL(r.url()).host;
  if (!host.startsWith('localhost')) external.push(host);
});

await page.goto(BASE, { waitUntil: 'networkidle' });
log('1. heading:', await page.locator('h1').textContent());
log('2. results:', (await page.locator('h2[role=status]').textContent()).trim());
log('3. third-party requests before map consent:', [...new Set(external)]);
log('4. cookies before consent:', (await context.cookies()).map((c) => c.name));

// --- search by PLZ with filters ---
await page.fill('#q', '40213');
await page.selectOption('#radius', '2');
await page.check('#ogs');
await page.locator('form button[type=submit]').first().click();
await page.waitForURL(/\?/, { timeout: 20000 });
await page.waitForLoadState('networkidle');
log('5. url after search:', new URL(page.url()).search);
log('6. results:', (await page.locator('h2[role=status]').textContent()).trim());
log('7. near-label:', (await page.locator('h2[role=status] ~ p').textContent()).trim());

// --- map consent gate ---
const loadMapButton = page.getByRole('button', { name: 'Karte laden' });
log('8. map gated behind a button:', await loadMapButton.isVisible());
await loadMapButton.click();
await page.waitForTimeout(2500);
log('9. tile host contacted after consent:', [...new Set(external)]);
log('10. leaflet container rendered:', await page.locator('.leaflet-container').isVisible());

// --- locale switch keeps the query ---
await page.locator('header select').selectOption('ar');
await page.waitForURL(/\/ar/, { timeout: 20000 });
log('11. locale switch ->', new URL(page.url()).pathname + new URL(page.url()).search);
log('12. dir:', await page.locator('html').getAttribute('dir'));
log('13. heading (ar):', await page.locator('h1').textContent());

// --- school detail + ics link ---
// Pick a school that actually has an upcoming date, so the calendar link exists.
await page.goto(`${BASE}/?openHouse=true`, { waitUntil: 'networkidle' });
await page.locator('h2 a').first().click();
await page.waitForURL(/\/schools\//, { timeout: 20000 });
log('14. detail heading:', await page.locator('h1').textContent());

const icsHref = await page.locator('a[href*="/ics"]').first().getAttribute('href');
log('15. ics link:', icsHref);

const response = await page.request.get(BASE + icsHref);
const body = await response.text();
log('16. ics status/type:', response.status(), response.headers()['content-type']);
log('17. ics disposition:', response.headers()['content-disposition']);
log('18. ics head:', body.split('\r\n').slice(0, 3).join(' | '));

log('19. cookies at the end of the whole parent journey:', (await context.cookies()).map((c) => c.name));
await browser.close();
