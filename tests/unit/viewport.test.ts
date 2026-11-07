import { describe, expect, it } from 'vitest';
import { computeViewport, needsRotation } from '../../src/core/viewport';

const base = { baseWidth: 480, baseHeight: 270 };

describe('zoom step', () => {
  it('adds whole steps on top of the size that fits the screen', () => {
    const screen = { cssWidth: 932, cssHeight: 430, devicePixelRatio: 3, baseWidth: 640, baseHeight: 360 };
    expect(computeViewport(screen).zoom).toBe(3);
    expect(computeViewport({ ...screen, zoomStep: 1 }).zoom).toBe(4);
    expect(computeViewport({ ...screen, zoomStep: 2 }).zoom).toBe(5);
  });
});

describe('computeViewport', () => {
  it.each([
    { name: 'Full HD', cssWidth: 1920, cssHeight: 1080, devicePixelRatio: 1, zoom: 4 },
    { name: 'laptop 125%', cssWidth: 1536, cssHeight: 864, devicePixelRatio: 1.25, zoom: 4 },
    { name: '4K', cssWidth: 3840, cssHeight: 2160, devicePixelRatio: 1, zoom: 8 },
    { name: 'Android landscape', cssWidth: 915, cssHeight: 412, devicePixelRatio: 2.625, zoom: 4 },
    { name: 'iPhone landscape', cssWidth: 844, cssHeight: 390, devicePixelRatio: 3, zoom: 4 },
  ])('uses the largest whole-number zoom that fits: $name', ({ name: _name, zoom, ...screen }) => {
    expect(computeViewport({ ...screen, ...base }).zoom).toBe(zoom);
  });

  it('uses a kept size (from before fullscreen) instead of growing, but never more than fits', () => {
    const fullHd = { cssWidth: 1920, cssHeight: 1080, devicePixelRatio: 1, baseWidth: 640, baseHeight: 360 };
    expect(computeViewport(fullHd).zoom).toBe(3);
    expect(computeViewport({ ...fullHd, fit: 2 }).zoom).toBe(2);
    expect(computeViewport({ ...fullHd, fit: 2, zoomStep: 1 }).zoom).toBe(3);
    expect(computeViewport({ ...fullHd, cssHeight: 950 }).zoom).toBe(2);
    expect(computeViewport({ ...fullHd, cssWidth: 900, cssHeight: 400, fit: 2 }).zoom).toBe(1);
  });

  it('never drops below 1x on a tiny window', () => {
    expect(computeViewport({ cssWidth: 200, cssHeight: 100, devicePixelRatio: 1, ...base }).zoom).toBe(1);
  });

  it('keeps one canvas pixel on one screen pixel at fractional pixel ratios', () => {
    const viewport = computeViewport({ cssWidth: 915, cssHeight: 412, devicePixelRatio: 2.625, ...base });
    expect(viewport.canvasWidth).toBe(2401);
    expect(viewport.canvasHeight).toBe(1081);
    expect(viewport.styleWidth * 2.625).toBeCloseTo(viewport.canvasWidth);
    expect(viewport.styleHeight * 2.625).toBeCloseTo(viewport.canvasHeight);
  });

  it('shows extra world on wide screens instead of black bars', () => {
    const viewport = computeViewport({ cssWidth: 844, cssHeight: 390, devicePixelRatio: 3, ...base });
    expect(viewport.canvasWidth / viewport.zoom).toBeGreaterThan(base.baseWidth);
    expect(viewport.canvasHeight / viewport.zoom).toBeGreaterThanOrEqual(base.baseHeight);
  });
});

describe('needsRotation', () => {
  it('asks only touch screens held in portrait to rotate', () => {
    expect(needsRotation(390, 844, true)).toBe(true);
    expect(needsRotation(844, 390, true)).toBe(false);
    expect(needsRotation(390, 844, false)).toBe(false);
  });
});
