export interface ViewportInput {
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio: number;
  baseWidth: number;
  baseHeight: number;
}

export interface Viewport {
  /** ขนาดจริงของ canvas เป็นพิกเซลของจอ */
  canvasWidth: number;
  canvasHeight: number;
  /** ขนาดที่แสดงบนหน้าเว็บ ให้ 1 พิกเซล canvas ตรงกับ 1 พิกเซลจอพอดี */
  styleWidth: number;
  styleHeight: number;
  /** พิกเซลเกม 1 จุด กว้างกี่พิกเซลจอ เป็นจำนวนเต็มเสมอ */
  zoom: number;
}

export function computeViewport(input: ViewportInput): Viewport {
  const { cssWidth, cssHeight, devicePixelRatio, baseWidth, baseHeight } = input;
  const canvasWidth = Math.max(1, Math.floor(cssWidth * devicePixelRatio));
  const canvasHeight = Math.max(1, Math.floor(cssHeight * devicePixelRatio));
  const zoom = Math.max(1, Math.floor(Math.min(canvasWidth / baseWidth, canvasHeight / baseHeight)));

  return {
    canvasWidth,
    canvasHeight,
    styleWidth: canvasWidth / devicePixelRatio,
    styleHeight: canvasHeight / devicePixelRatio,
    zoom,
  };
}

/** บังคับแนวนอนเฉพาะจอสัมผัส บนคอมย่อหน้าต่างแคบได้โดยเกมไม่หยุด */
export function needsRotation(width: number, height: number, isTouchScreen: boolean): boolean {
  return isTouchScreen && height > width;
}
