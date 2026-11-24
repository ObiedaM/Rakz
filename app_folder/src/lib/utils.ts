// ========== 1. IMPORTS ==========
// (none)

// ========== 2. TYPES ==========
/** HSV color parts used by the settings color wheel. */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

// ========== 3. CONSTANTS ==========
/** Curated subject swatches tuned for high contrast in both dark and paper-light themes. */
export const SWATCHES = [
  "#2F9E68",
  "#D97736",
  "#7C6AF5",
  "#D6455D",
  "#2B8CBE",
  "#1E9E89",
  "#C85A8E",
  "#C7922E",
  "#5B82F6",
  "#E07A5F",
  "#64748B",
  "#94A3B8",
];

// ========== 4. STATE ==========
// (none)

// ========== 5. LOGIC ==========

export function mix(pct: number): string {
  return `color-mix(in srgb, var(--accent) ${pct}%, transparent)`;
}

export function mixColor(color: string, pct: number): string {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

export function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0").toUpperCase();
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function hexToHsv(hex: string): Hsv {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return { h: 222, s: 0.63, v: 0.96 };
  const int = parseInt(m[1]!, 16);
  const r = ((int >> 16) & 255) / 255, g = ((int >> 8) & 255) / 255, b = (int & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}
