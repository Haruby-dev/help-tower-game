import audioIndexJson from '../../public/assets/audio/_audio_index.json';
import audioJson from '../data/audio.json';
import { audioIndexSchema, audioSchema } from '../data/schema';
import { assetUrl } from './assets';
import { createRng } from './rng';

export type SoundGroup = 'bgm' | 'sfx' | 'voice';

const settings = audioSchema.parse(audioJson);
const soundIndex = audioIndexSchema.parse(audioIndexJson);
const GROUPS: SoundGroup[] = ['bgm', 'sfx', 'voice'];
const MS = 1000;
/** เสียงสั้นที่โหลดไม่ทันเกินเท่านี้ไม่เล่น เสียงที่ดังช้าฟังเหมือนบั๊ก */
const LATE_LIMIT_MS = 400;
const LOG_LIMIT = 80;
const PRELOAD_TOGETHER = 4;
/** เสียงพูดเริ่มลดเพลงเร็ว ๆ ไม่ให้กลบเสียงพูดคำแรก */
const DUCK_IN_MS = 80;

export interface SoundHandle {
  stop(fadeMs?: number): void;
}

interface Playing {
  key: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
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

/**
 * ตัวจัดการเสียงเดียวทั้งเกม ใช้ Web Audio ตรง ๆ เพื่อให้เพลงเล่นครั้งแรกจาก 0 แล้ววนจากจุดวนถึงท้ายไฟล์โดยไม่มีรอยต่อ
 * เสียงแบ่ง 3 กลุ่ม (เพลง เอฟเฟกต์ เสียงพูด) ปรับระดับแยกกันได้ และจำไว้ในเครื่อง
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private readonly gains = new Map<SoundGroup, GainNode>();
  private duck: GainNode | null = null;
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  private format: 'ogg' | 'm4a' = 'ogg';
  private readonly volumes: Record<SoundGroup, number> = { ...settings.defaultVolume };
  private music: Playing | null = null;
  private wantedMusic: string | null = null;
  private voice: Playing | null = null;
  private readonly voiceAt = new Map<string, number>();
  private voiceToken = 0;
  private readonly rng = createRng(Date.now());
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
    this.duck = ctx.createGain();
    this.duck.connect(this.gains.get('bgm')!);
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
    if (!ctx || !soundIndex[key]) return Promise.resolve(null);
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

  /** เพลงโหลดเมื่อจะใช้ (ไฟล์ใหญ่ ถอดแล้วกินหน่วยความจำ) เสียงสั้นโหลดล่วงหน้าทั้งหมด */
  preloadShort(): void {
    const keys = Object.keys(soundIndex).filter((key) => soundIndex[key] !== 'bgm');
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

  private start(key: string, buffer: AudioBuffer, output: AudioNode, loop: { from: number } | null, fadeInMs = 0): Playing {
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
    gain.gain.setValueAtTime(fadeInMs > 0 ? 0 : 1, ctx.currentTime);
    if (fadeInMs > 0) gain.gain.linearRampToValueAtTime(1, ctx.currentTime + fadeInMs / MS);
    source.connect(gain).connect(output);
    source.start();
    this.remember(key);
    return { key, source, gain };
  }

  private fadeOut(playing: Playing, fadeMs: number): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    playing.gain.gain.cancelScheduledValues(now);
    playing.gain.gain.setValueAtTime(playing.gain.gain.value, now);
    playing.gain.gain.linearRampToValueAtTime(0, now + fadeMs / MS);
    try {
      playing.source.stop(now + fadeMs / MS + 0.02);
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
      this.music = this.start(key, buffer, this.duck!, { from: loopFrom }, previous ? fadeMs : settings.titleFadeMs);
    });
  }

  /** เอฟเฟกต์เสียง loop ใช้กับเสียงที่วนจนกว่าจะสั่งหยุด เช่นเสียงผัดตอนทำอาหาร */
  play(key: string, options: { loop?: boolean } = {}): SoundHandle {
    if (!this.ctx || !soundIndex[key]) return NO_SOUND;
    const asked = performance.now();
    let playing: Playing | null = null;
    let stopped = false;
    const group = soundIndex[key]!;
    void this.load(key).then((buffer) => {
      if (!buffer || stopped) return;
      if (!options.loop && performance.now() - asked > LATE_LIMIT_MS) return;
      playing = this.start(key, buffer, this.gains.get(group)!, options.loop ? { from: 0 } : null);
    });
    return {
      stop: (fadeMs = 0) => {
        stopped = true;
        if (playing) this.fadeOut(playing, fadeMs);
      },
    };
  }

  /** ชื่อบทพูดที่มีหลายเทค (_1 _2) สุ่มเทค ถ้ามีไฟล์เดียวใช้ชื่อนั้นเลย */
  takeOf(line: string): string {
    if (soundIndex[line]) return line;
    const takes = Object.keys(soundIndex).filter((key) => key.startsWith(`${line}_`) && /_\d+$/.test(key));
    return takes[Math.floor(this.rng.next() * takes.length)] ?? line;
  }

  /**
   * เสียงพูดตัวเอก: พูดได้ทีละบท บทใหม่หยุดบทเก่า บทเดิมไม่พูดซ้ำภายในราว 3 วินาที (ยกเว้น force)
   * ระหว่างพูดเพลงเบาลงแล้วค่อยกลับ
   */
  speak(line: string, options: { force?: boolean; take?: string } = {}): void {
    if (!this.ctx) return;
    const now = performance.now();
    const last = this.voiceAt.get(line);
    if (!options.force && last !== undefined && now - last < settings.voice.repeatGuardMs) return;
    this.voiceAt.set(line, now);
    const key = options.take ?? this.takeOf(line);
    this.stopVoice();
    const token = ++this.voiceToken;
    void this.load(key).then((buffer) => {
      if (!buffer || token !== this.voiceToken || performance.now() - now > LATE_LIMIT_MS) return;
      const playing = this.start(key, buffer, this.gains.get('voice')!, null);
      this.voice = playing;
      this.duckMusic(true);
      playing.source.addEventListener('ended', () => {
        if (this.voice !== playing) return;
        this.voice = null;
        this.duckMusic(false);
      });
    });
  }

  stopVoice(): void {
    if (!this.voice) return;
    const playing = this.voice;
    this.voice = null;
    this.fadeOut(playing, 0);
  }

  get voicePlaying(): boolean {
    return this.voice !== null;
  }

  private duckMusic(down: boolean): void {
    const ctx = this.ctx;
    const duck = this.duck;
    if (!ctx || !duck) return;
    const now = ctx.currentTime;
    duck.gain.cancelScheduledValues(now);
    duck.gain.setValueAtTime(duck.gain.value, now);
    duck.gain.linearRampToValueAtTime(down ? settings.duckTo : 1, now + (down ? DUCK_IN_MS : settings.duckRestoreMs) / MS);
  }
}

export const sound = new SoundEngine();
export const audioSettings = settings;
