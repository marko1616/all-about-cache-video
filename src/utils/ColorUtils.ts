/**
 * Converts a hex color (#RGB or #RRGGBB) into HSL components.
 * Returns [h, s, l] where h is in [0, 360), s and l are in [0, 100].
 */
export function hexToHsl(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;

  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let hue = 0;
  if (d !== 0) {
    switch (max) {
      case r:
        hue = ((g - b) / d) % 6;
        break;
      case g:
        hue = (b - r) / d + 2;
        break;
      case b:
        hue = (r - g) / d + 4;
        break;
    }
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  const light = (max + min) / 2;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * light - 1));

  return [hue, sat * 100, light * 100];
}
