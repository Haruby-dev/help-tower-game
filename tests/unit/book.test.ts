import { describe, expect, it } from 'vitest';
import { computeViewport, uiZoomFor } from '../../src/core/viewport';
import display from '../../src/data/display.json';

const viewport = (cssWidth: number, cssHeight: number, devicePixelRatio: number, zoomStep = 0) =>
  computeViewport({ cssWidth, cssHeight, devicePixelRatio, baseWidth: display.baseWidth, baseHeight: display.baseHeight, zoomStep });

describe('phone window and books', () => {
  it('draw at 3 screen dots per pixel on an iPhone 15 Pro Max held sideways, like the approved mocks, at every zoom', () => {
    for (const step of display.zoomSteps) {
      const iphone = viewport(932, 430, 3, step);
      expect(uiZoomFor(iphone, display.phoneDesign)).toBe(3);
      expect(uiZoomFor(iphone, display.bookDesign)).toBe(3);
    }
  });

  it('stay a whole number and fit a desktop screen', () => {
    const desktop = viewport(1920, 1080, 1);
    const phone = uiZoomFor(desktop, display.phoneDesign);
    const book = uiZoomFor(desktop, display.bookDesign);
    expect(Number.isInteger(phone) && Number.isInteger(book)).toBe(true);
    // หน้าต่างกลาง 620×299 พิกเซล · สมุดพร้อมปุ่มปิด 650×286 พิกเซล
    expect(620 * phone).toBeLessThanOrEqual(1920);
    expect(299 * phone).toBeLessThanOrEqual(1080);
    expect(650 * book).toBeLessThanOrEqual(1920);
    expect(286 * book).toBeLessThanOrEqual(1080);
  });

  it('a small laptop still gets a 2× phone, not a tiny 1×', () => {
    const laptop = viewport(1366, 768, 1);
    expect(uiZoomFor(laptop, display.phoneDesign)).toBe(2);
    expect(uiZoomFor(laptop, display.bookDesign)).toBe(2);
  });
});
