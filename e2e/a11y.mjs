import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const EXEC = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const AXE = readFileSync(
  process.env.AXE_PATH ?? 'node_modules/axe-core/axe.min.js',
  'utf8',
);
const SCHOOL = process.argv[2];
const SESSION = process.argv[3];

// WCAG 2.1 A + AA, which is what BITV 2.0 / the EU directive require.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const LOCALES = [
  { code: 'de', prefix: '', browser: 'de-DE' },
  { code: 'en', prefix: '/en', browser: 'en-US' },
  { code: 'tr', prefix: '/tr', browser: 'tr-TR' },
  { code: 'uk', prefix: '/uk', browser: 'uk-UA' },
  { code: 'ar', prefix: '/ar', browser: 'ar-EG' },
];

const PUBLIC_PAGES = [
  { name: 'home', path: '/' },
  { name: 'search-results', path: '/?q=40213&radius=5&ogs=true' },
  { name: 'school-detail', path: `/schools/${SCHOOL}` },
  { name: 'privacy', path: '/privacy' },
  { name: 'imprint', path: '/imprint' },
  { name: 'accessibility', path: '/accessibility' },
  { name: 'signin', path: '/signin' },
];

const ADMIN_PAGES = [
  { name: 'admin-dashboard', path: '/admin' },
  { name: 'admin-profile', path: '/admin/profile' },
  { name: 'admin-events', path: '/admin/events' },
];

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
const findings = [];
let checks = 0;

async function audit(page, label) {
  checks += 1;
  const result = await page.evaluate(
    async (tags) => await window.axe.run(document, { runOnly: { type: 'tag', values: tags } }),
    TAGS,
  );
  for (const violation of result.violations) {
    findings.push({
      label,
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.slice(0, 3).map((n) => n.target.join(' ')),
      summary: violation.nodes[0]?.failureSummary?.split('\n').slice(0, 2).join(' ') ?? '',
    });
  }
  return result.violations.length;
}

async function openPage(context, path) {
  const page = await context.newPage();
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.addScriptTag({ content: AXE });
  return page;
}

// --- public pages, every locale ---
for (const locale of LOCALES) {
  const context = await browser.newContext({ locale: locale.browser });
  for (const target of PUBLIC_PAGES) {
    const path = locale.prefix + (target.path === '/' ? '/' : target.path);
    const page = await openPage(context, path);
    const count = await audit(page, `${locale.code}:${target.name}`);
    if (count) console.log(`  ${locale.code}:${target.name} -> ${count} violation(s)`);
    await page.close();
  }
  await context.close();
}

// --- interactive states (German only; the DOM is identical across locales) ---
{
  const context = await browser.newContext({ locale: 'de-DE' });

  // Map activated: Leaflet builds a large DOM of its own.
  const mapPage = await openPage(context, '/?q=40213&radius=5');
  await mapPage.getByRole('button', { name: 'Karte laden' }).click();
  await mapPage.waitForSelector('.leaflet-container');
  await mapPage.waitForTimeout(2500);
  await mapPage.addScriptTag({ content: AXE });
  const mapCount = await audit(mapPage, 'de:map-activated');
  if (mapCount) console.log(`  de:map-activated -> ${mapCount} violation(s)`);
  await mapPage.close();

  // Server-side validation errors rendered on the sign-in form.
  const signinPage = await openPage(context, '/signin');
  await signinPage.fill('#email', 'not-an-email');
  await signinPage.locator('form button[type=submit]').click();
  await signinPage.waitForSelector('[role=alert]', { timeout: 15000 });
  await signinPage.addScriptTag({ content: AXE });
  const errCount = await audit(signinPage, 'de:signin-error-state');
  if (errCount) console.log(`  de:signin-error-state -> ${errCount} violation(s)`);
  await signinPage.close();

  await context.close();
}

// --- admin pages, if a session was supplied ---
if (SESSION) {
  const context = await browser.newContext({ locale: 'de-DE' });
  await context.addCookies([
    { name: 'schulkompass.session', value: SESSION, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax' },
  ]);
  for (const target of ADMIN_PAGES) {
    const page = await openPage(context, target.path);
    const count = await audit(page, `de:${target.name}`);
    if (count) console.log(`  de:${target.name} -> ${count} violation(s)`);
    await page.close();
  }

  // Admin form with validation errors showing.
  const profile = await openPage(context, '/admin/profile');
  await profile.fill('#postalCode', '4');
  await profile.locator('form:has(#name) button[type=submit]').click();
  await profile.waitForSelector('#postalCode-error', { timeout: 15000 });
  await profile.addScriptTag({ content: AXE });
  const c = await audit(profile, 'de:admin-profile-error-state');
  if (c) console.log(`  de:admin-profile-error-state -> ${c} violation(s)`);
  await profile.close();
  await context.close();
}

await browser.close();

console.log(`\n=== ${checks} page states audited against ${TAGS.join(', ')} ===`);
if (findings.length === 0) {
  console.log('No WCAG 2.1 A/AA violations found.');
} else {
  const byRule = new Map();
  for (const f of findings) {
    const key = `${f.id} (${f.impact})`;
    if (!byRule.has(key)) byRule.set(key, { help: f.help, where: [], nodes: f.nodes, summary: f.summary });
    byRule.get(key).where.push(f.label);
  }
  console.log(`${findings.length} violation instance(s), ${byRule.size} distinct rule(s):\n`);
  for (const [rule, info] of byRule) {
    console.log(`### ${rule}`);
    console.log(`  ${info.help}`);
    console.log(`  where: ${info.where.slice(0, 6).join(', ')}${info.where.length > 6 ? ` (+${info.where.length - 6} more)` : ''}`);
    console.log(`  nodes: ${info.nodes.join(' | ')}`);
    if (info.summary) console.log(`  why: ${info.summary}`);
    console.log();
  }
}
