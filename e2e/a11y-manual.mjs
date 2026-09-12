import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:3100';
const EXEC = process.env.CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SCHOOL = process.argv[2];
const problems = [];

const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });

// --- WCAG 1.4.10 Reflow: no horizontal scrolling at 320 CSS px ---
console.log('=== reflow at 320px (WCAG 1.4.10) ===');
for (const [label, path] of [
  ['home', '/'],
  ['results', '/?q=40213&radius=5'],
  ['school', `/schools/${SCHOOL}`],
  ['privacy', '/privacy'],
  ['signin', '/signin'],
  ['ar-results', '/ar/?q=40213&radius=5'],
]) {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, locale: 'de-DE' });
  const page = await ctx.newPage();
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  const overflow = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    widest: (() => {
      let worst = { tag: '', w: 0 };
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.right > worst.w) worst = { tag: el.tagName + '.' + (el.className || '').toString().slice(0, 30), w: Math.round(r.right) };
      }
      return worst;
    })(),
  }));
  const scrolls = overflow.doc > overflow.client + 1;
  console.log(`  ${label.padEnd(12)} scrollWidth=${overflow.doc} client=${overflow.client} ${scrolls ? 'HORIZONTAL SCROLL: ' + JSON.stringify(overflow.widest) : 'ok'}`);
  if (scrolls) problems.push(`reflow: ${label} scrolls horizontally at 320px`);
  await ctx.close();
}

// --- WCAG 1.4.4 Resize text: 200% zoom must not clip content ---
console.log('\n=== 200% zoom (WCAG 1.4.4) ===');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, locale: 'de-DE' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?q=40213&radius=5`, { waitUntil: 'networkidle' });
  // Emulate 200% text zoom by halving the layout viewport.
  await page.setViewportSize({ width: 640, height: 400 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
  await page.waitForTimeout(400);
  const clipped = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scrolls: doc.scrollWidth > doc.clientWidth + 1, scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
  console.log(`  results at 32px root font: ${clipped.scrolls ? `HORIZONTAL SCROLL (${clipped.scrollWidth} > ${clipped.clientWidth})` : 'ok'}`);
  if (clipped.scrolls) problems.push('resize text: horizontal scroll at 200% text size');
  await ctx.close();
}

// --- Keyboard-only operation + skip link + visible focus ---
console.log('\n=== keyboard operation (WCAG 2.1.1, 2.4.1, 2.4.7) ===');
{
  const ctx = await browser.newContext({ locale: 'de-DE' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });

  // First Tab should reach the skip link.
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => {
    const el = document.activeElement;
    return { tag: el?.tagName, text: el?.textContent?.trim().slice(0, 40), href: el?.getAttribute('href') };
  });
  console.log(`  first Tab stop: ${first.tag} "${first.text}" href=${first.href}`);
  if (first.href !== '#main') problems.push('skip link is not the first tab stop');

  // Activating it must move focus into the main region.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const hash = new URL(page.url()).hash;
  console.log(`  skip link target: ${hash}`);
  if (hash !== '#main') problems.push('skip link does not navigate to #main');

  // Every focusable control must show a visible focus indicator.
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const focusCheck = await page.evaluate(() => {
    const focusables = [...document.querySelectorAll('a[href], button, input, select, textarea')].filter(
      (el) => el.offsetParent !== null,
    );
    const noIndicator = [];
    for (const el of focusables) {
      el.focus();
      const s = getComputedStyle(el);
      const hasOutline = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
      const hasRing = s.boxShadow !== 'none';
      if (!hasOutline && !hasRing) noIndicator.push(el.tagName + '#' + (el.id || '(no id)'));
    }
    return { total: focusables.length, noIndicator };
  });
  console.log(`  focusable controls: ${focusCheck.total}, without a focus indicator: ${focusCheck.noIndicator.length}`);
  if (focusCheck.noIndicator.length) {
    console.log(`    ${focusCheck.noIndicator.join(', ')}`);
    problems.push(`no visible focus indicator on: ${focusCheck.noIndicator.join(', ')}`);
  }

  // The search form must be fully operable and submittable by keyboard alone.
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.click('#q');   // place caret; subsequent interaction is keyboard only
  await page.keyboard.type('40213');
  await page.keyboard.press('Enter');
  await page.waitForURL(/q=40213/, { timeout: 20000 });
  console.log(`  Enter in the location field submits: ${new URL(page.url()).search}`);

  // The map consent button must be reachable and activatable by keyboard.
  const mapButton = page.getByRole('button', { name: 'Karte laden' });
  await mapButton.focus();
  await page.keyboard.press('Enter');
  await page.waitForSelector('.leaflet-container', { timeout: 20000 });
  console.log('  map activates via keyboard: yes');
  await ctx.close();
}

// --- Heading hierarchy and landmarks ---
console.log('\n=== document structure ===');
{
  const ctx = await browser.newContext({ locale: 'de-DE' });
  const page = await ctx.newPage();
  for (const [label, path] of [['home', '/'], ['school', `/schools/${SCHOOL}`], ['privacy', '/privacy']]) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    const structure = await page.evaluate(() => {
      const levels = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => Number(h.tagName[1]));
      let skips = 0;
      for (let i = 1; i < levels.length; i += 1) if (levels[i] - levels[i - 1] > 1) skips += 1;
      return {
        h1: document.querySelectorAll('h1').length,
        levels: levels.join(''),
        skips,
        landmarks: {
          header: document.querySelectorAll('header').length,
          main: document.querySelectorAll('main').length,
          nav: document.querySelectorAll('nav').length,
          footer: document.querySelectorAll('footer').length,
        },
        lang: document.documentElement.lang,
      };
    });
    console.log(`  ${label.padEnd(8)} h1=${structure.h1} levels=${structure.levels} skipped=${structure.skips} main=${structure.landmarks.main} lang=${structure.lang}`);
    if (structure.h1 !== 1) problems.push(`${label}: expected exactly one h1, found ${structure.h1}`);
    if (structure.skips > 0) problems.push(`${label}: ${structure.skips} skipped heading level(s)`);
    if (structure.landmarks.main !== 1) problems.push(`${label}: expected one <main>`);
  }
  await ctx.close();
}

await browser.close();
console.log(`\n=== ${problems.length ? problems.length + ' problem(s)' : 'no problems found'} ===`);
for (const p of problems) console.log(`  - ${p}`);
