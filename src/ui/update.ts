import { t } from '../core/i18n';

const SCRIPT_PATTERN = /assets\/index-[\w-]+\.js/;

/** ไฟล์เกมที่หน้านี้โหลดอยู่ เปิดแบบเครื่องผู้พัฒนาไม่มีชื่อแบบนี้ จึงไม่เช็ก */
function loadedScript(): string | null {
  const script = document.querySelector<HTMLScriptElement>('script[type="module"][src]');
  return script?.src.match(SCRIPT_PATTERN)?.[0] ?? null;
}

/** iPhone มักค้างหน้าเก่าไว้ เช็กไฟล์เกมบนเว็บตอนเปิดและตอนกลับเข้าแอป ถ้าใหม่กว่าให้ผู้เล่นแตะโหลดเอง */
export function createUpdateCheck(uiRoot: HTMLElement): void {
  const current = loadedScript();
  if (!current) return;
  const button = document.createElement('button');
  button.id = 'update-button';
  button.type = 'button';
  button.className = 'phone-tool';
  button.hidden = true;
  button.textContent = t('update.available');
  button.addEventListener('click', () => window.location.reload());
  uiRoot.append(button);

  const check = async (): Promise<void> => {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}?v=${Date.now()}`, { cache: 'no-store' });
      const latest = (await response.text()).match(SCRIPT_PATTERN)?.[0];
      button.hidden = !latest || latest === current;
    } catch {
      // ไม่มีเน็ตก็เล่นต่อได้ตามปกติ
    }
  };
  void check();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });
}
