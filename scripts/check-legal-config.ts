/**
 * Fails while the Impressum / privacy / accessibility pages still contain
 * placeholder operator details. Intended for a pre-launch gate, not for CI on
 * every commit - see package.json ("check:legal").
 */
import { unconfiguredFields } from '../src/config/operator';

const missing = unconfiguredFields();

if (missing.length === 0) {
  console.log('[check:legal] operator details are complete.');
  process.exit(0);
}

console.error(
  `[check:legal] ${missing.length} operator detail(s) are still placeholders in src/config/operator.ts:`,
);
for (const field of missing) console.error(`  - ${field}`);
console.error(
  '\nThe Impressum is legally required (§ 5 DDG) and must not be published with invented details.',
);
process.exit(1);
