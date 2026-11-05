import { audioSettings, sound } from '../core/audio';
import { eventBus } from '../core/events';
import { gameState, type World } from '../core/state';
import balance from '../data/balance.json';
import { isDish, parseDish, recipes } from '../systems/cooking';
import { isAlert } from '../systems/mood';

const HOURS_PER_DAY = 24;
/** หน้าต่างเหล่านี้ไม่มีเสียงเปิดปิด: ม่านตอนนอนกับหน้าเลือกช่องเซฟตอนเริ่มเกม */
const SILENT_WINDOWS = new Set(['rest', 'slots']);
/** ปุ่มที่เป็นท่าในเกม มีเสียงของท่านั้นเองอยู่แล้ว จึงไม่ใส่เสียงแตะปุ่ม */
const GAME_BUTTONS = '#action-button, #run-button';
const RAPID_TAKES = ['eat_rapid_1', 'eat_rapid_2'];

let lastUiSoundAt = -Infinity;

/** เสียงหน้าจอ (เปิด ปิด พลิกหน้า ผิดพลาด เหรียญ) กดปุ่มที่มีเสียงพวกนี้แล้วจะไม่มีเสียงแตะซ้อน */
export function uiSound(key: 'ui_tap' | 'ui_open' | 'ui_close' | 'ui_page' | 'ui_error' | 'ui_coin'): void {
  lastUiSoundAt = performance.now();
  sound.play(key);
}

let lastEatAt = -Infinity;
let rapidTake = 0;

/** กินจากกระเป๋า: กดซ้ำภายใน 1.5 วินาทีใช้เสียงกินรัวสลับสองแบบ เครื่องดื่มใช้เสียงดื่ม */
export function eatVoice(item: string): void {
  const now = performance.now();
  const drink = isDish(item) && recipes[parseDish(item).recipe]?.category === 'drink';
  const rapid = now - lastEatAt < audioSettings.voice.eatRapidMs;
  lastEatAt = now;
  if (drink) {
    sound.speak('drink', { force: true });
    return;
  }
  if (!rapid) {
    rapidTake = 0;
    sound.speak('eat', { force: true });
    return;
  }
  sound.speak('eat_rapid', { force: true, take: RAPID_TAKES[rapidTake % RAPID_TAKES.length] });
  rapidTake += 1;
}

/** เพลงชั้นฐาน: กลางวัน 06:00–18:00 กลางคืน 18:00–02:00 (ชั่วโมงหลังเที่ยงคืนนับต่อเป็น 24 ขึ้นไป) */
export function farmMusicAt(hour: number): string {
  const inDay = hour % HOURS_PER_DAY;
  return inDay >= audioSettings.dayMusicFromHour && inDay < audioSettings.nightMusicFromHour ? 'bgm_farm_day' : 'bgm_farm_night';
}

function followMusic(world: World): void {
  const key = farmMusicAt(world.hour);
  const fade = sound.musicKey === 'bgm_title' || sound.musicKey === null ? audioSettings.titleFadeMs : audioSettings.dayNightFadeMs;
  sound.playMusic(key, fade);
}

/** บทเตือนหิวกับเหนื่อยพูดไม่เกินชั่วโมงเกมละครั้ง */
function createWarnings(): (world: World) => void {
  const lastSaid = new Map<string, number>();
  const alerted = new Set<string>();
  const say = (line: string, gauge: 'fullness' | 'happiness', world: World): void => {
    const value = world.gauges[gauge];
    if (!isAlert(value)) {
      alerted.delete(gauge);
      return;
    }
    if (alerted.has(gauge)) return;
    alerted.add(gauge);
    const at = world.day * HOURS_PER_DAY + world.hour;
    const last = lastSaid.get(line);
    if (last !== undefined && at - last < audioSettings.voice.warningEveryGameHours) return;
    lastSaid.set(line, at);
    sound.speak(line);
  };
  return (world) => {
    // หิว = เกจอิ่มต่ำ · เหนื่อย = เกจสุขต่ำ สองเกจนี้ทำให้เป็นลม
    say('voice_hungry', 'fullness', world);
    say('voice_tired', 'happiness', world);
  };
}

/** ต่อเสียงเข้ากับหน้าจอและเหตุการณ์ในเกม เสียงในฉาก (ทำสวน ตกปลา ทำอาหาร) อยู่ใน BaseScene */
export function createSound(): void {
  sound.init();
  sound.preloadShort();
  if (!gameState.started) sound.playMusic('bgm_title', 0);

  const warn = createWarnings();
  let coins: number | null = null;
  eventBus.on('game-started', (world) => {
    coins = world.wallet.coins;
    followMusic(world);
  });
  eventBus.on('world-changed', (world) => {
    followMusic(world);
    if (coins !== null && world.wallet.coins > coins) uiSound('ui_coin');
    coins = world.wallet.coins;
    warn(world);
  });

  eventBus.on('window-changed', ({ name, open }) => {
    if (SILENT_WINDOWS.has(name)) return;
    uiSound(open ? 'ui_open' : 'ui_close');
  });

  eventBus.on('player-says', (line) => {
    if (line === 'bagFull' || line === 'noBait' || line === 'baitRanOut') uiSound('ui_error');
    if (line === 'mysteryFood') sound.speak('voice_cook_fail');
  });
  eventBus.on('notice', (key) => {
    if (key === 'save.failed' || key === 'save.import_failed') uiSound('ui_error');
  });

  eventBus.on('rest-finished', ({ cause }) => {
    if (cause === 'faint') sound.speak('voice_faint');
    else window.setTimeout(() => sound.speak('voice_wake'), balance.time.restCurtainMs);
  });

  // เสียงแตะปุ่ม: รอให้ปุ่มทำงานก่อน ถ้าปุ่มนั้นเปิดหน้าต่างหรือมีเสียงของมันเอง ไม่เล่นเสียงแตะซ้อน
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target.closest('button') : null;
      if (!target || target.closest(GAME_BUTTONS)) return;
      const at = performance.now();
      window.setTimeout(() => {
        if (lastUiSoundAt >= at - audioSettings.uiTapDedupeMs) return;
        uiSound('ui_tap');
      }, 0);
    },
    { capture: true },
  );
}
