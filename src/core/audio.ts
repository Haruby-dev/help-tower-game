import audioIndexJson from '../../public/assets/audio/_audio_index.json';
import audioJson from '../data/audio.json';
import { audioSchema, soundGroupSchema } from '../data/schema';
import { assetUrl } from './assets';

export type SoundGroup = 'bgm' | 'sfx' | 'voice' | 'amb';

const settings = audioSchema.parse(audioJson);
/**
 * รายการเสียงจากฝั่งเสียง กลุ่มที่เกมยังไม่รู้จักข้ามไปก่อน ห้ามทำให้เกมเปิดไม่ขึ้น
 * npm run validate ยังตรวจทุกชื่อตามปกติ
 */
const soundIndex = Object.fromEntries(
  Object.entries(audioIndexJson as Record<string, string>).filter((entry): entry is [string, SoundGroup] => soundGroupSchema.safeParse(entry[1]).success),
);
const GROUPS: SoundGroup[] = ['bgm', 'sfx', 'voice', 'amb'];
const MS = 1000;
/** เสียงสั้นที่โหลดไม่ทันเกินเท่านี้ไม่เล่น เสียงที่ดังช้าฟังเหมือนบั๊ก */
const LATE_LIMIT_MS = 400;
const LOG_LIMIT = 80;
const PRELOAD_TOGETHER = 4;
/** เสียงพูดตัวเอกที่ยังโหลด: เหลือเสียงออกแรงตอนพรวนดิน (ผู้ใช้ตัดสิน 7 พ.ย. 2026 "งั่ม" เปลี่ยนเป็นเสียงกรุบในกลุ่มเอฟเฟกต์) ไฟล์เสียงพูดอื่นยังอยู่ แต่ไม่โหลด */
const VOICE_KEYS = new Set(settings.voiceTakes);

export interface SoundHandle {
  stop(fadeMs?: number): void;
}

interface Playing {
  key: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

interface AmbienceLoop {
  playing: Playing | null;
  level: number;
}

const NO_SOUND: SoundHandle = { stop: () => undefined };

function readVolume(group: SoundGroup): number {
  try {
    const stored = window.localStorage.getItem(`volume-${group}`);
    const value = stored === null ? NaN : Number(stored);
    return Number.isFinite(value) && value >= 0 && value <= 1 ? value : settings.defaultVolume[group];
  } catch {
    return settings.defaultVolume[group];
  }
}

function storeVolume(group: SoundGroup, value: number): void {
  try {
    window.localStorage.setItem(`volume-${group}`, String(value));
  } catch {
    // ไม่เก็บค่าก็ยังเล่นได้
  }
}

/** iPhone Safari เล่น .ogg ไม่ได้ทุกรุ่น จึงใช้ .m4a เมื่อเบราว์เซอร์ไม่รับ ogg */
function preferredFormat(): 'ogg' | 'm4a' {
  const probe = document.createElement('audio');
  return probe.canPlayType('audio/ogg; codecs="vorbis"') === '' ? 'm4a' : 'ogg';
}

/** เสียงที่ใช้ในเกมจริง: เสียงพูดเฉพาะที่อยู่ใน voiceTakes */
const inUse = (key: string): boolean => soundIndex[key] !== undefined && (soundIndex[key] !== 'voice' || VOICE_KEYS.has(key));

/**
 * ตัวจัดการเสียงเดียวทั้งเกม ใช้ Web Audio ตรง ๆ เพื่อให้เพลงเล่นครั้งแรกจาก 0 แล้ววนจากจุดวนถึงท้ายไฟล์โดยไม่มีรอยต่อ
 * เสียงแบ่ง 4 กลุ่ม (เพลง เอฟเฟกต์ เสียงพูด เสียงบรรยากาศ) ปรับระดับแยกกันได้ และจำไว้ในเครื่อง
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private readonly gains = new Map<SoundGroup, GainNode>();
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  private format: 'ogg' | 'm4a' = 'ogg';
  private readonly volumes: Record<SoundGroup, number> = { ...settings.defaultVolume };
  private music: Playing | null = null;
  private wantedMusic: string | null = null;
  private voice: Playing | null = null;
  private voiceToken = 0;
  private readonly ambience = new Map<string, AmbienceLoop>();
  private unlocked = false;
  /** เสียงที่สั่งเล่นล่าสุด ใช้ในการทดสอบ */
  readonly log: string[] = [];

  init(): void {
    if (this.ctx) return;
    for (const group of GROUPS) this.volumes[group] = readVolume(group);
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    this.format = preferredFormat();
    const ctx = new Context();
    this.ctx = ctx;
    for (const group of GROUPS) {
      const gain = ctx.createGain();
      gain.gain.value = this.volumes[group];
      gain.connect(ctx.destination);
      this.gains.set(group, gain);
    }
    // มือถือเปิดเสียงได้ต้องรอผู้เล่นแตะครั้งแรก
    const unlock = (): void => this.unlock();
    for (const type of ['pointerdown', 'touchend', 'click', 'keydown']) document.addEventListener(type, unlock, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void ctx.suspend().catch(() => undefined);
      else if (this.unlocked) void ctx.resume().catch(() => undefined);
    });
  }

  private unlock(): void {
    const ctx = this.ctx;
    if (!ctx || document.hidden) return;
    if (!this.unlocked) {
      // iPhone ต้องเล่นเสียงสักอย่างในจังหวะที่แตะ จึงเล่นเสียงเงียบสั้น ๆ หนึ่งครั้ง
      const silent = ctx.createBufferSource();
      silent.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      silent.connect(ctx.destination);
      silent.start();
    }
    if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
    this.unlocked = true;
  }

  get musicKey(): string | null {
    return this.wantedMusic;
  }

  get running(): boolean {
    return this.ctx?.state === 'running';
  }

  volume(group: SoundGroup): number {
    return this.volumes[group];
  }

  setVolume(group: SoundGroup, value: number): void {
    const clamped = Math.min(1, Math.max(0, value));
    this.volumes[group] = clamped;
    storeVolume(group, clamped);
    const gain = this.gains.get(group);
    if (gain && this.ctx) gain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.02);
  }

  private url(key: string, format: 'ogg' | 'm4a'): string {
    return assetUrl(`audio/${soundIndex[key]}/${key}.${format}`);
  }

  /** โหลดครั้งเดียวต่อเสียง ถ้าถอดแบบที่เลือกไม่ได้ลองอีกแบบ */
  load(key: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(key);
    if (cached) return cached;
    const ctx = this.ctx;
    if (!ctx || !inUse(key)) return Promise.resolve(null);
    const decode = async (format: 'ogg' | 'm4a'): Promise<AudioBuffer> => {
      const response = await fetch(this.url(key, format));
      if (!response.ok) throw new Error(`${key}.${format}: ${response.status}`);
      const data = await response.arrayBuffer();
      return await ctx.decodeAudioData(data);
    };
    const other = this.format === 'ogg' ? 'm4a' : 'ogg';
    const loading = decode(this.format).catch(() => decode(other)).catch(() => null);
    this.buffers.set(key, loading);
    return loading;
  }

  /** เพลงกับเสียงบรรยากาศโหลดเมื่อจะใช้ (ไฟล์ยาว ถอดแล้วกินหน่วยความจำ) เสียงสั้นโหลดล่วงหน้าทั้งหมด */
  preloadShort(): void {
    const keys = Object.keys(soundIndex).filter((key) => inUse(key) && soundIndex[key] !== 'bgm' && soundIndex[key] !== 'amb');
    const next = (): void => {
      const key = keys.shift();
      if (key) void this.load(key).finally(next);
    };
    for (let lane = 0; lane < PRELOAD_TOGETHER; lane += 1) next();
  }

  /** เลิกใช้เพลงที่ไม่เล่นแล้ว คืนหน่วยความจำ */
  forget(key: string): void {
    if (soundIndex[key] === 'bgm' && this.wantedMusic !== key) this.buffers.delete(key);
  }

  private remember(key: string): void {
    this.log.push(key);
    if (this.log.length > LOG_LIMIT) this.log.shift();
  }

  /** level คือระดับที่ค่อย ๆ ขึ้นไปถึงใน fadeInMs (ไม่ใส่ fade ดังทันที) */
  private start(key: string, buffer: AudioBuffer, output: AudioNode, loop: { from: number } | null, fadeInMs = 0, level = 1): Playing {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    if (loop) {
      // เล่นครั้งแรกจาก 0 แล้ววนจากจุดวนถึงท้ายไฟล์
      source.loop = true;
      source.loopStart = loop.from;
      source.loopEnd = buffer.duration;
    }
    gain.gain.setValueAtTime(fadeInMs > 0 ? 0 : level, ctx.currentTime);
    if (fadeInMs > 0) gain.gain.linearRampToValueAtTime(level, ctx.currentTime + fadeInMs / MS);
    source.connect(gain).connect(output);
    source.start();
    this.remember(key);
    return { key, source, gain };
  }

  private rampTo(playing: Playing, level: number, fadeMs: number): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    playing.gain.gain.cancelScheduledValues(now);
    playing.gain.gain.setValueAtTime(playing.gain.gain.value, now);
    playing.gain.gain.linearRampToValueAtTime(level, now + fadeMs / MS);
  }

  private fadeOut(playing: Playing, fadeMs: number): void {
    this.rampTo(playing, 0, fadeMs);
    try {
      playing.source.stop(this.ctx!.currentTime + fadeMs / MS + 0.02);
    } catch {
      // หยุดไปแล้ว
    }
  }

  /** เปลี่ยนเพลงแบบค่อย ๆ จางเข้าหากัน null คือหยุดเพลง */
  playMusic(key: string | null, fadeMs: number): void {
    if (key === this.wantedMusic) return;
    const previous = this.wantedMusic;
    this.wantedMusic = key;
    if (this.music) {
      this.fadeOut(this.music, fadeMs);
      this.music = null;
    }
    if (previous) window.setTimeout(() => this.forget(previous), fadeMs + MS);
    if (!key || !this.ctx) return;
    const loopFrom = settings.music[key]?.loopStart ?? 0;
    void this.load(key).then((buffer) => {
      if (!buffer || this.wantedMusic !== key || this.music?.key === key) return;
      this.music = this.start(key, buffer, this.gains.get('bgm')!, { from: loopFrom }, previous ? fadeMs : settings.titleFadeMs);
    });
  }

  /** เอฟเฟกต์เสียง loop ใช้กับเสียงที่วนจนกว่าจะสั่งหยุด เช่นเสียงผัดตอนทำอาหาร */
  play(key: string, options: { loop?: boolean; volume?: number } = {}): SoundHandle {
    if (!this.ctx || !inUse(key)) return NO_SOUND;
    const asked = performance.now();
    let playing: Playing | null = null;
    let stopped = false;
    const group = soundIndex[key]!;
    void this.load(key).then((buffer) => {
      if (!buffer || stopped) return;
      if (!options.loop && performance.now() - asked > LATE_LIMIT_MS) return;
      playing = this.start(key, buffer, this.gains.get(group)!, options.loop ? { from: 0 } : null, 0, options.volume ?? 1);
    });
    return {
      stop: (fadeMs = 0) => {
        stopped = true;
        if (playing) this.fadeOut(playing, fadeMs);
      },
    };
  }

  /** เสียงพูดตัวเอก: ได้ทีละเสียง เสียงใหม่หยุดเสียงเก่าก่อน */
  say(key: string): void {
    if (!this.ctx || !inUse(key)) return;
    const asked = performance.now();
    this.stopVoice();
    const token = ++this.voiceToken;
    void this.load(key).then((buffer) => {
      if (!buffer || token !== this.voiceToken || performance.now() - asked > LATE_LIMIT_MS) return;
      const playing = this.start(key, buffer, this.gains.get('voice')!, null);
      this.voice = playing;
      playing.source.addEventListener('ended', () => {
        if (this.voice === playing) this.voice = null;
      });
    });
  }

  stopVoice(): void {
    if (!this.voice) return;
    const playing = this.voice;
    this.voice = null;
    this.fadeOut(playing, 0);
  }

  /**
   * เสียงบรรยากาศที่วนอยู่: ส่งชื่อเสียงกับระดับที่ต้องการ ตัวที่ไม่อยู่ในรายการค่อย ๆ หายไป ตัวใหม่ค่อย ๆ ดังขึ้น
   * ไม่ถูกเสียงอื่นกด และเล่นต่อตอนเปิดเมนูหรือโทรศัพท์
   */
  setAmbience(levels: Record<string, number>, fadeMs: number): void {
    if (!this.ctx) return;
    for (const [key, loop] of [...this.ambience]) {
      if ((levels[key] ?? 0) > 0) continue;
      if (loop.playing) this.fadeOut(loop.playing, fadeMs);
      this.ambience.delete(key);
    }
    for (const [key, level] of Object.entries(levels)) {
      if (level <= 0 || !inUse(key)) continue;
      const current = this.ambience.get(key);
      if (current) {
        if (current.level !== level && current.playing) this.rampTo(current.playing, level, fadeMs);
        current.level = level;
        continue;
      }
      const loop: AmbienceLoop = { playing: null, level };
      this.ambience.set(key, loop);
      void this.load(key).then((buffer) => {
        if (!buffer || this.ambience.get(key) !== loop) return;
        loop.playing = this.start(key, buffer, this.gains.get('amb')!, { from: 0 }, fadeMs, loop.level);
      });
    }
  }

  /** ระดับเสียงบรรยากาศที่ต้องการตอนนี้ ใช้ในการทดสอบ */
  get ambienceLevels(): Record<string, number> {
    return Object.fromEntries([...this.ambience].map(([key, loop]) => [key, loop.level]));
  }
}

export const sound = new SoundEngine();
export const audioSettings = settings;
