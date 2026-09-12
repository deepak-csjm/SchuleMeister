/**
 * Shared plumbing for the browser checks.
 *
 * The scripts started life as things a human reads; to run in CI they have to
 * assert and set an exit code. `check()` records a pass/fail, `finish()` prints
 * a summary and exits non-zero if anything failed or threw.
 */
import { chromium } from 'playwright-core';

export const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

/**
 * Where to find a browser. With the `playwright` package installed its own
 * download is used, so CHROME_PATH is only needed for playwright-core alone.
 */
const executablePath = process.env.CHROME_PATH || undefined;

const results = [];

export async function launchBrowser() {
  return chromium.launch({ executablePath, args: ['--no-sandbox'] });
}

/** Records a check. `detail` is printed either way, so a pass is still readable. */
export function check(name, passed, detail = '') {
  results.push({ name, passed });
  const mark = passed ? 'ok  ' : 'FAIL';
  console.log(`  ${mark} ${name}${detail ? ` - ${detail}` : ''}`);
  return passed;
}

export function checkEqual(name, actual, expected) {
  return check(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

export function section(title) {
  console.log(`\n=== ${title} ===`);
}

/** Prints the summary and exits. Call once at the end of a script. */
export function finish() {
  const failed = results.filter((r) => !r.passed);
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed${failed.length ? `, ${failed.length} FAILED` : ''}`,
  );
  for (const failure of failed) console.log(`  FAILED: ${failure.name}`);
  process.exitCode = failed.length > 0 ? 1 : 0;
}

/** Any uncaught error must fail the run, not exit 0 with a stack trace. */
process.on('unhandledRejection', (error) => {
  console.error('\nunhandled rejection:', error);
  process.exit(1);
});

/**
 * Finds a school id and a school that has an upcoming published event, through
 * the public API rather than the database, so the scripts need no DB access.
 */
export async function discoverFixtures() {
  const all = await fetch(`${BASE}/api/schools?limit=100`).then((r) => r.json());
  if (!all.schools?.length) {
    throw new Error('no schools returned by /api/schools - has the database been seeded?');
  }

  const withEvent = await fetch(`${BASE}/api/schools?openHouse=true&limit=10`).then((r) => r.json());

  return {
    schoolId: all.schools[0].id,
    schoolWithEventId: withEvent.schools?.[0]?.id ?? all.schools[0].id,
    schoolCount: all.count,
  };
}
