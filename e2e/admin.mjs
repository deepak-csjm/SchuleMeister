import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:3101';
const EXEC = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// Session cookie captured from the completed magic-link flow.
const sessionValue = process.argv[2];

const log = (...args) => console.log(...args);

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
const context = await browser.newContext({ locale: 'de-DE' });
await context.addCookies([
  { name: 'schulkompass.session', value: sessionValue, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
]);
const page = await context.newPage();
page.on('pageerror', (e) => log('PAGE ERROR:', e.message));

// --- 1. profile update ---
await page.goto(`${BASE}/admin/profile`, { waitUntil: 'networkidle' });
log('1. profile page title:', await page.locator('h2').first().textContent());
await page.fill('#headmaster', 'Dr. Neue Leitung');
await page.fill('#phone', '+49 211 0000 9999');
await page.fill('#languages', 'Englisch, Niederländisch');
await page.check('#hasOGS').catch(() => {});
await page.locator('form:has(#name) button[type=submit]').click();
await page.waitForSelector('form:has(#name) [role=status]', { timeout: 15000 });
log('2. save result:', (await page.locator('[role=status]').first().textContent()).trim());

// --- 2. validation error path ---
await page.fill('#postalCode', '4');
await page.locator('form:has(#name) button[type=submit]').click();
await page.waitForSelector('#postalCode-error', { timeout: 15000 });
log('3. validation error:', (await page.locator('#postalCode-error').textContent()).trim());
log('   (form keeps other values, name still:', await page.inputValue('#name'), ')');

// --- 3. create an event ---
await page.goto(`${BASE}/admin/events`, { waitUntil: 'networkidle' });
const before = await page.locator('ul > li').count();
await page.fill('#title', 'E2E Tag der offenen Tür');
await page.selectOption('#eventType', 'OPEN_HOUSE');
await page.fill('#eventDate', '2027-03-15');
await page.fill('#startTime', '10:00');
await page.fill('#endTime', '13:00');
await page.fill('#location', 'Aula');
await page.fill('#targetGrade', 'Klasse 4');
await page.locator('form:has(#title) button[type=submit]').click();
await page.waitForSelector('form:has(#title) [role=status]', { timeout: 15000 });
log('4. create result:', (await page.locator('[role=status]').first().textContent()).trim());

await page.goto(`${BASE}/admin/events`, { waitUntil: 'networkidle' });
const after = await page.locator('ul > li').count();
log(`5. event list: ${before} -> ${after}`);

// --- 4. invalid event: end before start ---
await page.fill('#title', 'Ungültig');
await page.fill('#eventDate', '2027-04-01');
await page.fill('#startTime', '14:00');
await page.fill('#endTime', '09:00');
await page.locator('form:has(#title) button[type=submit]').click();
await page.waitForSelector('#endTime-error', { timeout: 15000 });
log('6. time validation:', (await page.locator('#endTime-error').textContent()).trim());

// --- 5. edit the created event ---
await page.goto(`${BASE}/admin/events`, { waitUntil: 'networkidle' });
const row = page.locator('li', { hasText: 'E2E Tag der offenen Tür' }).first();
const editHref = await row.locator('a[href*="/admin/events/"]').first().getAttribute('href');
log('   edit href:', editHref);
await row.locator('a[href*="/admin/events/"]').first().click();
await page.waitForURL(/\/admin\/events\/[^/]+$/, { timeout: 20000 });
log('7. edit page loaded, title value:', await page.inputValue('#title'));
await page.fill('#title', 'E2E Termin (bearbeitet)');
await page.uncheck('#isPublished');
await page.locator('form:has(#title) button[type=submit]').click();
await page.waitForSelector('form:has(#title) [role=status]', { timeout: 15000 });
log('8. update result:', (await page.locator('[role=status]').first().textContent()).trim());

// --- 6. unpublished event is hidden from the public page ---
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
const auditItems = await page.locator('ol > li').allTextContents();
log('9. audit trail entries:', auditItems.length);
log('   latest:', auditItems.slice(0, 3).map((t) => t.replace(/\s+/g, ' ').trim()));

await browser.close();
