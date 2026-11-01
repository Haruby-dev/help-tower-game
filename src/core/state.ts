import { eventBus } from './events';
import type { TextKey } from './i18n';
import type { Vector } from './movement';
import type { Viewport } from './viewport';

export interface Point {
  x: number;
  y: number;
}

export interface GaugeValues {
  fullness: number;
  happiness: number;
  cleanliness: number;
  homesickness: number;
}

/** ความจริงของเกมที่อยู่ในเซฟ */
export interface World {
  day: number;
  /** ชั่วโมงนับต่อเนื่องจากเที่ยงคืนของวันนั้น 26 คือตีสองของวันถัดไป */
  hour: number;
  gauges: GaugeValues;
  /** null คือยังไม่เคยวาง ให้ใช้จุดเกิดบนแผนที่ */
  player: Point | null;
}

class GameState {
  private currentViewport: Viewport | null = null;
  private currentRotationRequired = false;
  private currentJoystick: Vector = { x: 0, y: 0 };
  private currentLightingEnabled = true;
  private currentZoomStep = 0;
  private currentWorld: World | null = null;
  private currentSlot: number | null = null;
  private currentAction: TextKey | null = null;
  private openWindows = new Set<string>();

  get viewport(): Viewport {
    if (!this.currentViewport) throw new Error('viewport has not been set');
    return this.currentViewport;
  }

  get rotationRequired(): boolean {
    return this.currentRotationRequired;
  }

  get joystick(): Vector {
    return this.currentJoystick;
  }

  get world(): World {
    if (!this.currentWorld) throw new Error('game has not started');
    return this.currentWorld;
  }

  get started(): boolean {
    return this.currentWorld !== null;
  }

  get activeSlot(): number | null {
    return this.currentSlot;
  }

  /** นาฬิกาหยุดเมื่อเปิดหน้าต่างเต็มหรือยังไม่เลือกช่องเซฟ */
  get clockRunning(): boolean {
    return this.currentWorld !== null && this.openWindows.size === 0;
  }

  startGame(slot: number, world: World): void {
    this.currentSlot = slot;
    this.currentWorld = world;
    eventBus.emit('game-started', world);
    eventBus.emit('world-changed', world);
  }

  setWorld(world: World): void {
    this.currentWorld = world;
    eventBus.emit('world-changed', world);
  }

  /** ฉากรายงานตำแหน่งทุกเฟรม ไม่ต้องแจ้งใคร */
  trackPlayer(point: Point): void {
    if (this.currentWorld) this.currentWorld = { ...this.currentWorld, player: point };
  }

  /** ระบบย้ายตัวละคร เช่น ตื่นที่หน้าบ้าน ฉากจึงต้องตาม */
  movePlayer(point: Point): void {
    this.trackPlayer(point);
    eventBus.emit('player-moved', point);
  }

  setWindowOpen(name: string, open: boolean): void {
    if (open) this.openWindows.add(name);
    else this.openWindows.delete(name);
  }

  setAction(action: TextKey | null): void {
    if (action === this.currentAction) return;
    this.currentAction = action;
    eventBus.emit('action-changed', action);
  }

  get zoomStep(): number {
    return this.currentZoomStep;
  }

  setZoomStep(step: number): void {
    if (step === this.currentZoomStep) return;
    this.currentZoomStep = step;
    eventBus.emit('zoom-step-changed', step);
  }

  get lightingEnabled(): boolean {
    return this.currentLightingEnabled;
  }

  setLightingEnabled(enabled: boolean): void {
    if (enabled === this.currentLightingEnabled) return;
    this.currentLightingEnabled = enabled;
    eventBus.emit('lighting-changed', enabled);
  }

  setViewport(viewport: Viewport): void {
    this.currentViewport = viewport;
    eventBus.emit('viewport-changed', viewport);
  }

  setRotationRequired(required: boolean): void {
    if (required === this.currentRotationRequired) return;
    this.currentRotationRequired = required;
    eventBus.emit('rotation-required-changed', required);
  }

  setJoystick(vector: Vector): void {
    this.currentJoystick = vector;
  }
}

export const gameState = new GameState();
