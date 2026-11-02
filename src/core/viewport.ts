export interface ViewportInput {
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio: number;
  baseWidth: number;
  baseHeight: number;
  /** ขยายเพิ่มจากขนาดที่พอดีจอกี่เท่า เป็นจำนวนเต็มเพื่อให้ภาพยังคม */
  zoomStep?: number;
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
  const { cssWidth, cssHeight, devicePixelRatio, baseWidth, baseHeight, zoomStep = 0 } = input;
  const canvasWidth = Math.max(1, Math.floor(cssWidth * devicePixelRatio));
  const canvasHeight = Math.max(1, Math.floor(cssHeight * devicePixelRatio));
  const zoom = Math.max(1, Math.floor(Math.min(canvasWidth / baseWidth, canvasHeight / baseHeight))) + zoomStep;

  return {
    canvasWidth,
    canvasHeight,
    styleWidth: canvasWidth / devicePixelRatio,
    styleHeight: canvasHeight / devicePixelRatio,
    zoom,
  };
}

export interface UiDesign {
  width: number;
  height: number;
}

/** UI ใช้จำนวนเต็มเดียวกับโลกเกม ยกเว้นซูมแล้วโทรศัพท์จะล้นจอ จึงลดลงเท่าที่ใส่ได้ */
/** iPhone เก็บ screen เป็นแนวตั้งเสมอ เปิดจากไอคอนแล้วความสูงที่หน้าเว็บเห็นขาดไปเท่าแถบสถานะ จึงคิดจากขนาดจอจริง */
export function homeScreenAppSize(screenWidth: number, screenHeight: number, landscape: boolean): { width: number; height: number } {
  const long = Math.max(screenWidth, screenHeight);
  const short = Math.min(screenWidth, screenHeight);
  return landscape ? { width: long, height: short } : { width: short, height: long };
}

export function isHomeScreenApp(): boolean {
  return (
    window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function uiZoomFor(viewport: Viewport, design: UiDesign): number {
  const fits = Math.floor(Math.min(viewport.canvasWidth / design.width, viewport.canvasHeight / design.height));
  return Math.max(1, Math.min(viewport.zoom, fits));
}

/** บังคับแนวนอนเฉพาะจอสัมผัส บนคอมย่อหน้าต่างแคบได้โดยเกมไม่หยุด */
export function needsRotation(width: number, height: number, isTouchScreen: boolean): boolean {
  return isTouchScreen && height > width;
}
