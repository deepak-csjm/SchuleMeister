import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  compositeOver,
  contrastRatio,
  oklchToSrgb,
  parseOklchTokens,
  type Rgb,
} from '@/lib/color-contrast';

const css = readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8');

/**
 * The stylesheet defines the light palette on `:root` and overrides it inside
 * the `prefers-color-scheme: dark` block, so each theme is parsed from its own
 * section.
 */
function themeCss(theme: 'light' | 'dark'): string {
  const darkStart = css.indexOf('@media (prefers-color-scheme: dark)');
  expect(darkStart).toBeGreaterThan(-1);
  const darkEnd = css.indexOf('@theme inline', darkStart);
  return theme === 'light' ? css.slice(0, darkStart) : css.slice(darkStart, darkEnd);
}

const themes = {
  light: parseOklchTokens(themeCss('light')),
  dark: parseOklchTokens(themeCss('dark')),
};

/** WCAG 1.4.3 minimum for body-size text. */
const MIN_BODY_TEXT = 4.5;

interface Pair {
  label: string;
  fg: string;
  bg: string;
  /** Alpha of the foreground tint used as the background (Tailwind `/12` etc.). */
  tint?: number;
}

const pairs: Pair[] = [
  { label: 'body text on page', fg: 'foreground', bg: 'background' },
  { label: 'card text on card', fg: 'card-foreground', bg: 'card' },
  { label: 'muted text on page', fg: 'muted-foreground', bg: 'background' },
  { label: 'muted text on card', fg: 'muted-foreground', bg: 'card' },
  { label: 'muted text on muted surface', fg: 'muted-foreground', bg: 'muted' },
  { label: 'link on page', fg: 'primary', bg: 'background' },
  { label: 'link on card', fg: 'primary', bg: 'card' },
  { label: 'label on primary button', fg: 'primary-foreground', bg: 'primary' },
  { label: 'label on destructive button', fg: 'destructive-foreground', bg: 'destructive' },
  { label: 'secondary badge', fg: 'secondary-foreground', bg: 'secondary' },
  { label: 'muted badge', fg: 'muted-foreground', bg: 'muted' },
  { label: 'accent notice', fg: 'accent-foreground', bg: 'accent' },
  { label: 'error text on page', fg: 'destructive', bg: 'background' },
  { label: 'error text on card', fg: 'destructive', bg: 'card' },
  { label: 'success text on page', fg: 'success', bg: 'background' },
  // Tinted badges: the background is the foreground colour at low alpha over
  // the card, which is how bg-primary/10 and bg-success/12 actually render.
  { label: 'primary badge (primary/10)', fg: 'primary', bg: 'card', tint: 0.1 },
  { label: 'success badge (success/12)', fg: 'success', bg: 'card', tint: 0.12 },
];

describe.each(['light', 'dark'] as const)('%s theme token contrast', (theme) => {
  const tokens = themes[theme];

  it('parses every token the pairs refer to', () => {
    const missing = [...new Set(pairs.flatMap((p) => [p.fg, p.bg]))].filter((t) => !tokens[t]);
    expect(missing).toEqual([]);
  });

  it.each(pairs)('$label meets 4.5:1', ({ fg, bg, tint }) => {
    const foreground = tokens[fg] as Rgb;
    const surface = tokens[bg] as Rgb;
    const background = tint === undefined ? surface : compositeOver(foreground, surface, tint);
    expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(MIN_BODY_TEXT);
  });
});

describe('contrast maths', () => {
  it('is 21:1 for black on white and 1:1 for identical colours', () => {
    const white = oklchToSrgb(1, 0, 0);
    const black = oklchToSrgb(0, 0, 0);
    expect(contrastRatio(black, white)).toBeCloseTo(21, 1);
    expect(contrastRatio(white, white)).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    const a = oklchToSrgb(0.48, 0.13, 155);
    const b = oklchToSrgb(0.99, 0.004, 250);
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });

  it('converts a known oklch value to the expected sRGB', () => {
    // oklch(0.48 0.13 155) is the success token; browsers render it ~#00723b.
    const [r, g, b] = oklchToSrgb(0.48, 0.13, 155);
    expect(Math.round(r * 255)).toBe(0);
    expect(Math.round(g * 255)).toBeGreaterThan(105);
    expect(Math.round(g * 255)).toBeLessThan(120);
    expect(Math.round(b * 255)).toBeGreaterThan(50);
    expect(Math.round(b * 255)).toBeLessThan(65);
  });

  it('compositing a tint over a surface lands between the two colours', () => {
    const fg = oklchToSrgb(0.48, 0.13, 155);
    const surface = oklchToSrgb(1, 0, 0);
    const tinted = compositeOver(fg, surface, 0.12);
    expect(tinted[1]).toBeGreaterThan(fg[1]);
    expect(tinted[1]).toBeLessThan(surface[1]);
  });
});
