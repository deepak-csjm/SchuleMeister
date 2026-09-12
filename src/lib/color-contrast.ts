/**
 * WCAG contrast maths for the design tokens.
 *
 * The tokens in `globals.css` are authored in oklch, which no CSS tooling
 * checks for contrast. `tests/contrast.test.ts` parses the stylesheet and runs
 * every text/surface pair through here, so a token can no longer be nudged into
 * failing WCAG 1.4.3 without a test failing.
 */

export type Rgb = readonly [number, number, number];

/** oklch (L 0..1, C, h in degrees) to gamma-encoded sRGB in 0..1. */
export function oklchToSrgb(lightness: number, chroma: number, hueDegrees: number): Rgb {
  const hue = (hueDegrees * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);

  const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = lightness - 0.0894841775 * a - 1.2914855480 * b;

  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;

  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];

  const encode = (value: number): number => {
    const encoded =
      value <= 0.0031308 ? 12.92 * value : 1.055 * Math.pow(Math.max(value, 0), 1 / 2.4) - 0.055;
    return Math.min(1, Math.max(0, encoded));
  };

  return [encode(linear[0]!), encode(linear[1]!), encode(linear[2]!)] as const;
}

const toLinear = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

/** WCAG relative luminance. */
export function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** WCAG contrast ratio, always >= 1. */
export function contrastRatio(foreground: Rgb, background: Rgb): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  );
  return (lighter! + 0.05) / (darker! + 0.05);
}

/**
 * Composites a translucent colour over an opaque surface, which is what
 * Tailwind's `bg-success/12` style utilities produce.
 */
export function compositeOver(foreground: Rgb, surface: Rgb, alpha: number): Rgb {
  return [
    foreground[0] * alpha + surface[0] * (1 - alpha),
    foreground[1] * alpha + surface[1] * (1 - alpha),
    foreground[2] * alpha + surface[2] * (1 - alpha),
  ] as const;
}

/** Parses `--token: oklch(L C H);` declarations out of a CSS block. */
export function parseOklchTokens(css: string): Record<string, Rgb> {
  const tokens: Record<string, Rgb> = {};
  const pattern = /--([a-z-]+):\s*oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/g;

  for (const match of css.matchAll(pattern)) {
    const [, name, lightness, chroma, hue] = match;
    tokens[name!] = oklchToSrgb(Number(lightness), Number(chroma), Number(hue));
  }

  return tokens;
}
