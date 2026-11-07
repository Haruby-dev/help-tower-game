export interface ViewportInput {
  cssWidth: number;
  cssHeight: number;
  devicePixelRatio: number;
  baseWidth: number;
  baseHeight: number;
  /** ขยายเพิ่มจากขนาดที่พอดีจอกี่เท่า เป็นจำนวนเต็มเพื่อให้ภาพยังคม */
  zoomStep?: number;
  /**
   * ใช้ขนาดพอดีจอนี้แทนค่าที่คิดจากจอตอนนี้ (ไม่เกินที่ใส่จอได้)
   * ตอนกดเต็มจอใช้ขนาดก่อนกด ตัวละครจึงไม่ใหญ่ขึ้น เห็นฉากกว้างขึ้นแทน (ผู้ใช้เลือก 7 พ.ย. 2026)
   */
  fit?: number;
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

/** ขยายเต็มที่กี่เท่าที่ยังใส่จอได้ (ยังไม่รวมปุ่มซูม) */
export function fitZoom(input: ViewportInput): number {
  const canvasWidth = Math.max(1, Math.floor(input.cssWidth * input.devicePixelRatio));
  const canvasHeight = Math.max(1, Math.floor(input.cssHeight * input.devicePixelRatio));
  return Math.max(1, Math.floor(Math.min(canvasWidth / input.baseWidth, canvasHeight / input.baseHeight)));
}

export function computeViewport(input: ViewportInput): Viewport {
  const { cssWidth, cssHeight, devicePixelRatio, zoomStep = 0, fit } = input;
  const canvasWidth = Math.max(1, Math.floor(cssWidth * devicePixelRatio));
  const canvasHeight = Math.max(1, Math.floor(cssHeight * devicePixelRatio));
  const fits = fitZoom(input);
  const zoom = (fit === undefined ? fits : Math.max(1, Math.min(fit, fits))) + zoomStep;

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
  // กดปุ่มเต็มจอในเบราว์เซอร์ก็นับเป็น display-mode: fullscreen ด้วย แต่นั่นไม่ใช่แอปจากหน้าจอโฮม
  if (document.fullscreenElement) return false;
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
