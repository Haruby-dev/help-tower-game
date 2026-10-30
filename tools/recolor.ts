const GREEN_HUE_MIN = 70;
const GREEN_HUE_MAX = 170;
const GREEN_HUE_SHIFT = -24;
const GREEN_SATURATION = 0.62;
const OTHER_SATURATION = 0.72;

function toHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;
  if (delta === 0) return [0, 0, lightness];
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (max === r) hue = ((g - b) / delta + 6) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return [hue * 60, saturation, lightness];
}

function toRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness - chroma / 2;
  const sector = Math.floor(((hue % 360) + 360) % 360 / 60);
  const [r, g, b] = ([
    [chroma, x, 0],
    [x, chroma, 0],
    [0, chroma, x],
    [0, x, chroma],
    [x, 0, chroma],
    [chroma, 0, x],
  ] as const)[sector] ?? [0, 0, 0];
  return [r + m, g + m, b + m];
}

/** ทำให้พื้นโทนนุ่มตาตามที่ผู้ใช้เลือก (ตัวอย่าง B): ลดความสดและยกความสว่าง หญ้าเอียงไปทางเหลืองอุ่น */
export function softenTiles(pixels: Uint8Array): void {
  for (let i = 0; i < pixels.length; i += 4) {
    const [hue, saturation, lightness] = toHsl(
      (pixels[i] ?? 0) / 255,
      (pixels[i + 1] ?? 0) / 255,
      (pixels[i + 2] ?? 0) / 255,
    );
    const isGreen = hue > GREEN_HUE_MIN && hue < GREEN_HUE_MAX;
    const [r, g, b] = isGreen
      ? toRgb(hue + GREEN_HUE_SHIFT, saturation * GREEN_SATURATION, Math.min(1, lightness * 1.06 + 0.03))
      : toRgb(hue, saturation * OTHER_SATURATION, Math.min(1, lightness * 1.12 + 0.04));
    pixels[i] = Math.round(r * 255);
    pixels[i + 1] = Math.round(g * 255);
    pixels[i + 2] = Math.round(b * 255);
  }
}
