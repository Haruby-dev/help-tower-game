import { loadAtlasGroup } from '../core/atlas';
import { audioSettings, sound, type SoundHandle } from '../core/audio';
import { eventBus } from '../core/events';
import { gameState, type World } from '../core/state';
import balance from '../data/balance.json';
import { isAlert } from '../systems/mood';

const HOURS_PER_DAY = 24;
/** หน้าต่างเหล่านี้ไม่มีเสียงเปิดปิด: ม่านตอนนอนกับหน้าเลือกช่องเซฟตอนเริ่มเกม */
const SILENT_WINDOWS = new Set(['rest', 'slots']);
/** ปุ่มที่เป็นท่าในเกม มีเสียงของท่านั้นเองอยู่แล้ว จึงไม่ใส่เสียงแตะปุ่ม */
const GAME_BUTTONS = '#action-button, #run-button';
/** เกจที่มีเสียงเตือนเมื่อลงถึงจุดเตือน: อิ่มเป็นเสียงท้องร้อง สุขกับสะอาดเป็นเสียงเตือนทั่วไป */
const WARNINGS = { fullness: 'warn_hungry', happiness: 'warn_generic', cleanliness: 'warn_generic' } as const;

let lastUiSoundAt = -Infinity;

/** เสียงหน้าจอ (เปิด ปิด พลิกหน้า ผิดพลาด เหรียญ) กดปุ่มที่มีเสียงพวกนี้แล้วจะไม่มีเสียงแตะซ้อน */
export function uiSound(key: 'ui_tap' | 'ui_open' | 'ui_close' | 'ui_page' | 'ui_error' | 'ui_coin'): void {
  lastUiSoundAt = performance.now();
  sound.play(key);
}

let lastBite: SoundHandle | null = null;

/** กินหรือดื่มจากกระเป๋า: เสียงกรุบเสียงเดียว แตะรัวหยุดเสียงก่อนหน้าก่อน (ผู้ใช้ตัดสิน 7 พ.ย. 2026 แทน "งั่ม") */
export function eatSound(): void {
  lastBite?.stop();
  lastBite = sound.play(audioSettings.eatSound);
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

/** เสียงเตือนดังครั้งเดียวทุกครั้งที่เกจลงถึงจุดเตือน และไม่เกินชั่วโมงเกมละครั้งต่อเกจ */
function createWarnings(): (world: World) => void {
  const lastWarned = new Map<string, number>();
  const alerted = new Set<string>();
  return (world) => {
    for (const [gauge, key] of Object.entries(WARNINGS) as [keyof typeof WARNINGS, string][]) {
      if (!isAlert(world.gauges[gauge])) {
        alerted.delete(gauge);
        continue;
      }
      if (alerted.has(gauge)) continue;
      alerted.add(gauge);
      const at = world.day * HOURS_PER_DAY + world.hour;
      const last = lastWarned.get(gauge);
      if (last !== undefined && at - last < audioSettings.warningEveryGameHours) continue;
      lastWarned.set(gauge, at);
      sound.play(key);
    }
  };
}

/**
 * เสียงบรรยากาศชั้นฐาน: นกตอนกลางวัน จิ้งหรีดตอนกลางคืน จางเข้าหากันพร้อมเพลง
 * ฝนตกมีเสียงฝนวน และนกหรือจิ้งหรีดเบาลงตาม ambience.underRain
 * ฝนเริ่มตกระหว่างเล่นมีเสียงฝนเริ่มก่อน แล้วเสียงฝนวนตามมา โหลดเซฟที่ฝนตกอยู่แล้วมีแค่เสียงฝนวน
 */
function createAmbience(): { start(world: World): void; follow(world: World): void } {
  const { ambience } = audioSettings;
  let weather: World['weather'] | null = null;
  let base: string | null = null;
  /** เสียงฝนวนยังไม่เริ่มจนกว่าจะถึงเวลานี้ (รอเสียงฝนเริ่มก่อน) */
  let rainLoopFrom = 0;
  /** ม่านตอนนอนปิดถึงเวลานี้ ฝนที่เริ่มตอนตื่นจะดังหลังม่านเปิด */
  let curtainUntil = 0;
  /** บ่อน้ำกับกองไฟดังตามระยะจากตัวเอก ไม่เบาลงตอนฝนตก (ฉากส่งมา) */
  let near: Record<string, number> = {};

  const apply = (world: World, fadeOverride?: number): void => {
    const next = farmMusicAt(world.hour) === 'bgm_farm_day' ? ambience.day : ambience.night;
    const raining = world.weather === 'rain' && performance.now() >= rainLoopFrom;
    const fade = fadeOverride ?? (base !== null && base !== next ? audioSettings.dayNightFadeMs : ambience.rainFadeMs);
    base = next;
    const sky = raining ? { [next]: ambience.underRain, [ambience.rain]: 1 } : { [next]: 1 };
    sound.setAmbience({ ...sky, ...near }, fade);
  };

  eventBus.on('ambience-near', (levels) => {
    near = levels;
    if (gameState.started) apply(gameState.world, audioSettings.nearAmbience.fadeMs);
  });

  const rainStarts = (): void => {
    rainLoopFrom = Infinity;
    // รอให้รู้ก่อนว่าฝนมากับการนอนหรือเปล่า (ม่านเปิดหลังเปลี่ยนวัน)
    window.setTimeout(() => {
      window.setTimeout(
        () => {
          if (gameState.world.weather !== 'rain') return;
          sound.play('rain_start');
          rainLoopFrom = performance.now() + ambience.rainLoopAfterStartMs;
          window.setTimeout(() => apply(gameState.world), ambience.rainLoopAfterStartMs);
        },
        Math.max(0, curtainUntil - performance.now()),
      );
    }, 0);
  };

  eventBus.on('rest-finished', ({ cause }) => {
    // เป็นลม: เสียงเป็นลมครั้งเดียวตอนม่านขึ้น (ม่านไม่มีเสียงเปิดปิด แต่เสียงนี้เล่นเสมอ) นอนปกติกับหลับคาที่ไม่มีเสียงนี้
    if (cause === 'faint') sound.play(audioSettings.faint);
    curtainUntil = performance.now() + balance.time.restCurtainMs;
  });

  return {
    start: (world) => {
      weather = world.weather;
      rainLoopFrom = 0;
      apply(world);
    },
    follow: (world) => {
      if (weather !== null && weather !== 'rain' && world.weather === 'rain') rainStarts();
      weather = world.weather;
      apply(world);
    },
  };
}

/** ต่อเสียงเข้ากับหน้าจอและเหตุการณ์ในเกม เสียงในฉาก (ทำสวน ตกปลา ทำอาหาร อาบน้ำ เดิน) อยู่ใน BaseScene */
export function createSound(): void {
  sound.init();
  // เสียงสั้นโหลดหลังแผ่นภาพเปิดเกมกับภาพหน้าจอเสร็จ จะได้ไม่แย่งเน็ตกันตอนเปิดเกม (เสียงที่เล่นก่อนนั้นโหลดเองตอนเล่น)
  void Promise.allSettled([loadAtlasGroup('boot'), loadAtlasGroup('ui')]).then(() => sound.preloadShort());
  if (!gameState.started) sound.playMusic('bgm_title', 0);

  const warn = createWarnings();
  const ambience = createAmbience();
  let coins: number | null = null;
  eventBus.on('game-started', (world) => {
    coins = world.wallet.coins;
    followMusic(world);
    ambience.start(world);
  });
  eventBus.on('world-changed', (world) => {
    if (!gameState.started) return;
    followMusic(world);
    ambience.follow(world);
    if (coins !== null && world.wallet.coins > coins) uiSound('ui_coin');
    coins = world.wallet.coins;
    warn(world);
  });

  eventBus.on('window-changed', ({ name, open }) => {
    if (SILENT_WINDOWS.has(name)) return;
    uiSound(open ? 'ui_open' : 'ui_close');
  });

  eventBus.on('player-says', (line) => {
    if (line === 'bagFull' || line === 'noBait' || line === 'baitRanOut' || line === 'noMoney') uiSound('ui_error');
  });
  eventBus.on('notice', (key) => {
    if (key === 'save.failed' || key === 'save.import_failed') uiSound('ui_error');
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
