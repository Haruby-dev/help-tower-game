import Phaser from 'phaser';
import { footY, registry } from '../core/assets';
import { direction4From, type Direction4, type Vector } from '../core/movement';
import type { Rng } from '../core/rng';
import balance from '../data/balance.json';

const SIT_ID = 'gio_sit';
const BLINK_ID = 'gio_sit_blink';
const STAND_ID = 'gio_stand4';
const EAT_ID = 'gio_eat_lick';
const SEAT_ID = 'gio_seat';
const SIT_ROWS: Direction4[] = ['south', 'east', 'north', 'west'];
/** ภาพยืนสี่ขาเรียงเฟรมตามทิศ ใต้ ตะวันออก เหนือ ตะวันตก */
const STAND_FRAMES: Direction4[] = ['south', 'east', 'north', 'west'];
const BODY_WIDTH = 26;
const BODY_HEIGHT = 10;
/** ถึงเป้าหมายเมื่อเหลือไม่เกินเท่านี้ (พิกเซลเกม) */
const ARRIVE_PX = 1.5;
/** ขยับน้อยกว่านี้ในช่วง stuckMs ถือว่าชนของอยู่ */
const STUCK_MOVE_PX = 2;
const HEADING_TRIES = 8;
const FX_DEPTH_LIFT = 100;
/** หัวใจเริ่มลอยจากเหนือหัวจีโอตอนนั่ง (ท่านั่งสูงราว 43 พิกเซล) */
const HEART_START_ABOVE_FEET = 40;

export type TreatTaste = 'like' | 'love' | 'special';
type Mode = 'seated' | 'walking' | 'standing' | 'eating';

type Point = { x: number; y: number };

/** ทางเดินจากหน้าตะกร้าไปปากโพรง (จุดเรียงจากตะกร้าไปโพรง) อ่านจากแผนที่ */
export interface GioTrip {
  route: Point[];
  burrow: Point;
}

/** ตะกร้าที่นั่งจีโอบนแผนที่ (ภาพแบนวางใต้ตัวละคร) */
export interface GioSeat {
  x: number;
  top: number;
  bottom: number;
  width: number;
}

const walkSheet = (facing: Direction4): string => `gio_walk4_${facing}`;

function sheetOf(id: string): { width: number; height: number; frames: number } {
  const entry = registry[id];
  if (entry?.type !== 'local' || !entry.frame_width || !entry.frame_height) throw new Error(`${id} is not a sprite sheet`);
  return { width: entry.frame_width, height: entry.frame_height, frames: Math.floor(entry.width / entry.frame_width) };
}

/** ทุกท่าวางด้วยจุดเท้าของแผ่นนั้น เท้าจึงอยู่บรรทัดเดียวกันเสมอ สลับท่าแล้วตัวไม่กระโดด */
export function gioFootOrigin(id: string, facing: Direction4): number {
  const meta = id === SIT_ID || id === BLINK_ID ? footY(id, facing) : footY(id);
  return meta / sheetOf(id).height;
}

function createAnimations(scene: Phaser.Scene): void {
  if (scene.anims.exists(`${SIT_ID}_south`)) return;
  const { sitFps, walkFps, eatFps, eatLoops } = balance.gio;
  for (const [id, repeat] of [
    [SIT_ID, -1],
    [BLINK_ID, 0],
  ] as const) {
    const { frames } = sheetOf(id);
    SIT_ROWS.forEach((direction, row) => {
      scene.anims.create({
        key: `${id}_${direction}`,
        frames: scene.anims.generateFrameNumbers(id, { start: row * frames, end: row * frames + frames - 1 }),
        frameRate: sitFps,
        repeat,
      });
    });
  }
  for (const facing of SIT_ROWS) {
    const id = walkSheet(facing);
    scene.anims.create({ key: id, frames: scene.anims.generateFrameNumbers(id), frameRate: walkFps, repeat: -1 });
  }
  scene.anims.create({ key: EAT_ID, frames: scene.anims.generateFrameNumbers(EAT_ID), frameRate: eatFps, repeat: eatLoops - 1 });
}

/**
 * จีโอนั่งในตะกร้า ลุกออกทางขอบหน้าตะกร้า เดินเล่นสี่ขารอบ ๆ ยืนพักด้วยท่ายืนสี่ขา แล้วเดินกลับเข้าตะกร้าทางเดิม
 * ทุกครั้งที่ตัวขยับต้องเล่นท่าเดินของทิศนั้น และสลับภาพทันทีไม่มีการเฟด
 */
export class Gio {
  readonly body: Phaser.GameObjects.Zone;
  readonly sprite: Phaser.GameObjects.Sprite;
  private seatFeet: { x: number; y: number };
  private exitPoint: { x: number; y: number };
  private seatBox: { left: number; right: number; top: number; bottom: number } | null;
  private seatRim: Phaser.GameObjects.Image | null = null;
  private mode: Mode = 'seated';
  private facing: Direction4 = 'south';
  private waitMs = 0;
  private blinkInMs = 0;
  private walksLeft = 0;
  private route: { x: number; y: number }[] = [];
  private afterRoute: () => void = () => undefined;
  private stuck = { ms: 0, x: 0, y: 0 };
  private walkBudgetMs = 0;
  private fx: Phaser.GameObjects.GameObject[] = [];
  /** กำลังเดินเข้าโพรง (out) หรือเดินกลับจากโพรง (back) */
  private trip: 'out' | 'back' | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    spawn: { x: number; y: number },
    seat: GioSeat | null,
    private readonly rng: Rng,
    private readonly tripPath: GioTrip | null = null,
  ) {
    createAnimations(scene);
    const { seatFeetRow, seatExitGap } = balance.gio;
    this.seatFeet = seat ? { x: seat.x, y: seat.top + seatFeetRow } : { x: spawn.x, y: spawn.y + BODY_HEIGHT / 2 };
    this.exitPoint = seat ? { x: seat.x, y: seat.bottom + seatExitGap } : this.seatFeet;
    this.seatBox = seat ? { left: seat.x - seat.width / 2, right: seat.x + seat.width / 2, top: seat.top, bottom: seat.bottom } : null;

    this.body = scene.add.zone(this.seatFeet.x, this.seatFeet.y - BODY_HEIGHT / 2, BODY_WIDTH, BODY_HEIGHT).setName('gio_body');
    scene.physics.add.existing(this.body);
    this.physicsBody.setCollideWorldBounds(true);
    this.physicsBody.setImmovable(true);

    this.sprite = scene.add.sprite(this.seatFeet.x, this.seatFeet.y, SIT_ID).setName('gio');
    this.sprite.on(Phaser.Animations.Events.ANIMATION_COMPLETE, (animation: Phaser.Animations.Animation) => {
      if (animation.key === EAT_ID) this.finishEating();
      else if (this.mode === 'seated') this.playSit();
    });
    if (seat) this.addSeatRim(seat);
    this.sitInSeat();
    this.syncSprite();
    // วางภาพหลังฟิสิกส์ขยับตัวชนแล้วในเฟรมเดียวกัน ภาพจึงไม่ตามหลังตัวชน
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.syncSprite, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.syncSprite, this));
  }

  /** ผู้เล่นย้ายตะกร้าในโหมดจัดวาง จีโอที่นั่งอยู่ย้ายไปนั่งในตะกร้าใหม่ ถ้าเดินเล่นอยู่จะกลับไปที่ตะกร้าใหม่เอง */
  moveSeat(seat: GioSeat): void {
    const { seatFeetRow, seatExitGap } = balance.gio;
    this.seatFeet = { x: seat.x, y: seat.top + seatFeetRow };
    this.exitPoint = { x: seat.x, y: seat.bottom + seatExitGap };
    this.seatBox = { left: seat.x - seat.width / 2, right: seat.x + seat.width / 2, top: seat.top, bottom: seat.bottom };
    this.seatRim?.setPosition(seat.x, seat.bottom).setDepth(this.seatFeet.y + 0.5);
    if (this.mode === 'seated' || !this.present) {
      this.physicsBody.reset(this.seatFeet.x, this.seatFeet.y - BODY_HEIGHT / 2);
      this.syncSprite();
    } else if (this.mode === 'walking' && this.homing && this.trip === null) {
      // กำลังเดินกลับตะกร้าเดิม เปลี่ยนไปเดินกลับตะกร้าใหม่ (ไม่ต้องหลบตัวเอก เพราะกำลังกลับบ้าน)
      this.goHome(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
    }
  }

  /** ขอบหน้าตะกร้าวาดทับตัวตอนนั่ง จีโอจึงดูนั่งอยู่ในตะกร้า ไม่ใช่ข้าง ๆ */
  private addSeatRim(seat: GioSeat): void {
    const { seatRimRow } = balance.gio;
    const height = seat.bottom - seat.top;
    this.seatRim = this.scene.add
      .image(seat.x, seat.bottom, SEAT_ID)
      .setOrigin(0.5, 1)
      .setCrop(0, seatRimRow, seat.width, height - seatRimRow)
      .setDepth(this.seatFeet.y + 0.5)
      .setName('gio_seat_rim');
  }

  private get physicsBody(): Phaser.Physics.Arcade.Body {
    return this.body.body as Phaser.Physics.Arcade.Body;
  }

  get isWalking(): boolean {
    return this.mode === 'walking';
  }

  get isSeated(): boolean {
    return this.mode === 'seated';
  }

  /** วันที่ไปเร่ขาย จีโอเข้าโพรงตอนเที่ยงและออกมาตอนหกโมงเย็น ระหว่างนั้นซ่อนทั้งภาพและตัวชน */
  get present(): boolean {
    return this.sprite.visible;
  }

  /** คุยได้เมื่ออยู่บ้านและไม่ได้กำลังเดินเข้าหรือออกจากโพรง */
  get canTalk(): boolean {
    return this.present && this.trip === null;
  }

  get leaving(): boolean {
    return this.trip === 'out';
  }

  get returning(): boolean {
    return this.trip === 'back';
  }

  get burrowPoint(): Point | null {
    return this.tripPath?.burrow ?? null;
  }

  /** ออกไปเร่ขาย: walk คือเดินไปมุดโพรงให้เห็น ไม่งั้นหายไปเลย (ตอนกล้องมองไม่เห็นหรือเพิ่งโหลดเซฟ) */
  leave(walk: boolean): void {
    if (!this.present || this.trip === 'out' || this.mode === 'eating') return;
    this.clearFx();
    if (!walk || !this.tripPath) {
      this.hide();
      return;
    }
    const { route, burrow } = this.tripPath;
    // เริ่มจากจุดบนทางที่ใกล้ที่สุด จะได้ไม่เดินย้อนกลับไปหน้าตะกร้า
    const away = (point: Point): number => Math.hypot(point.x - this.feetX, point.y - this.feetY);
    let start = 0;
    route.forEach((point, index) => {
      if (away(point) < away(route[start]!)) start = index;
    });
    const tail = this.mode === 'seated' ? route : route.slice(start);
    const first = tail[0] ?? burrow;
    const lead = this.mode === 'seated' ? [this.exitPoint] : this.aroundSeat(first);
    this.trip = 'out';
    this.homing = true;
    this.walkTo([...lead, ...tail, burrow], () => this.hide());
  }

  /** กลับจากเร่ขาย: walk คือโผล่จากปากโพรงแล้วเดินกลับเข้าตะกร้า ไม่งั้นนั่งในตะกร้าเลย */
  comeBack(walk: boolean): void {
    if (this.present) return;
    this.sprite.setVisible(true);
    this.physicsBody.enable = true;
    if (!walk || !this.tripPath) {
      this.physicsBody.reset(this.seatFeet.x, this.seatFeet.y - BODY_HEIGHT / 2);
      this.sitInSeat();
      this.syncSprite();
      return;
    }
    const { route, burrow } = this.tripPath;
    this.physicsBody.reset(burrow.x, burrow.y - BODY_HEIGHT / 2);
    this.trip = 'back';
    this.homing = true;
    this.walkTo([...[...route].reverse(), this.exitPoint, this.seatFeet], () => this.sitInSeat());
    this.syncSprite();
  }

  /** ยกเลิกการออก (เช่นโหลดเซฟที่ไม่ได้ฝากของ) เดินกลับตะกร้าตามปกติ */
  cancelLeave(playerX: number, playerY: number): void {
    if (this.trip !== 'out') return;
    this.trip = null;
    this.goHome(playerX, playerY);
  }

  private hide(): void {
    this.clearFx();
    this.sprite.setVisible(false);
    this.physicsBody.enable = false;
    this.physicsBody.reset(this.seatFeet.x, this.seatFeet.y - BODY_HEIGHT / 2);
    this.sitInSeat();
    this.syncSprite();
  }

  /** ถ้าเดินตรงไปแล้วจะข้ามตะกร้า ให้อ้อมด้านข้างก่อน */
  private aroundSeat(target: Point): Point[] {
    if (!this.seatBox || !this.crossesSeat(this.feetX, this.feetY, target.x, target.y)) return [];
    const sideX = this.feetX < this.seatFeet.x ? this.seatBox.left - BODY_WIDTH : this.seatBox.right + BODY_WIDTH;
    return [{ x: sideX, y: this.feetY }, { x: sideX, y: this.exitPoint.y }];
  }

  get feetX(): number {
    return this.body.x;
  }

  get feetY(): number {
    return this.body.y + BODY_HEIGHT / 2;
  }

  /** paused คือนาฬิกาหยุด (เปิดหน้าต่างอยู่) จีโอหยุดเดินแต่ท่าที่เล่นอยู่ยังเล่นต่อ */
  update(deltaMs: number, playerX: number, playerY: number, paused = false): void {
    if (!this.present) return;
    if (paused || this.mode === 'eating') {
      this.physicsBody.setVelocity(0, 0);
      this.syncSprite();
      return;
    }
    if (this.mode === 'walking') this.stepRoute(deltaMs, playerX, playerY);
    else if (this.mode === 'seated') {
      this.waitMs -= deltaMs;
      this.blinkInMs -= deltaMs;
      if (this.blinkInMs <= 0) this.blink();
      if (this.waitMs <= 0) this.leaveSeat(playerX, playerY);
    } else if (this.mode === 'standing') {
      this.waitMs -= deltaMs;
      if (this.waitMs <= 0) this.nextWalk(playerX, playerY);
    }
    this.syncSprite();
  }

  /** ได้แมวเลีย: นั่งเลียหันหน้าลงจอ 2 รอบ หัวใจลอยตามรส แล้วกลับไปนั่งหรือยืนที่เดิม */
  eatTreat(taste: TreatTaste): void {
    if (!this.present) return;
    this.clearFx();
    this.physicsBody.setVelocity(0, 0);
    this.route = [];
    this.wasSeated = this.mode === 'seated' || this.atSeat();
    this.mode = 'eating';
    this.facing = 'south';
    this.sprite.setFlipX(false);
    this.sprite.setOrigin(0.5, gioFootOrigin(EAT_ID, 'south'));
    this.sprite.play(EAT_ID);
    this.floatHearts(taste);
  }

  private wasSeated = true;

  private finishEating(): void {
    this.clearFx();
    if (this.wasSeated) this.sitInSeat();
    else this.stand(this.rng.between(balance.gio.standMinMs, balance.gio.standMaxMs));
  }

  private floatHearts(taste: TreatTaste): void {
    const { heartRisePx, heartRiseMs, heartStaggerMs, heartsByTaste, sparkleSpots, sparkleBlinkMs } = balance.gio;
    const headY = this.feetY - HEART_START_ABOVE_FEET;
    const depth = this.feetY + FX_DEPTH_LIFT;
    for (let index = 0; index < heartsByTaste[taste]; index += 1) {
      const offsetX = heartsByTaste[taste] > 1 ? (index - (heartsByTaste[taste] - 1) / 2) * 6 : 0;
      const heart = this.scene.add.image(Math.round(this.feetX + offsetX), Math.round(headY), 'fx_heart_5').setDepth(depth).setVisible(false);
      this.fx.push(heart);
      this.scene.time.delayedCall(index * heartStaggerMs, () => {
        heart.setVisible(true);
        const startX = heart.x;
        this.scene.tweens.add({
          targets: heart,
          y: headY - heartRisePx,
          duration: heartRiseMs,
          onUpdate: (tween) => heart.setX(startX + (Math.round(tween.progress * 4) % 2 === 0 ? 0 : 1)),
          onComplete: () => heart.setVisible(false),
        });
      });
    }
    if (taste !== 'special') return;
    for (const [dx, dy] of sparkleSpots) {
      const sparkle = this.scene.add.image(Math.round(this.feetX + dx), Math.round(this.feetY + dy), 'fx_sparkle_5').setDepth(depth);
      this.fx.push(sparkle);
      const timer = this.scene.time.addEvent({ delay: sparkleBlinkMs, loop: true, callback: () => sparkle.setVisible(!sparkle.visible) });
      sparkle.once(Phaser.GameObjects.Events.DESTROY, () => timer.remove());
    }
  }

  private clearFx(): void {
    for (const piece of this.fx) {
      this.scene.tweens.killTweensOf(piece);
      piece.destroy();
    }
    this.fx = [];
  }

  private atSeat(): boolean {
    return Math.hypot(this.feetX - this.seatFeet.x, this.feetY - this.seatFeet.y) < ARRIVE_PX * 2;
  }

  private sitInSeat(): void {
    this.mode = 'seated';
    this.trip = null;
    this.homing = false;
    this.facing = 'south';
    this.route = [];
    this.physicsBody.setVelocity(0, 0);
    this.waitMs = this.rng.between(balance.gio.sitMinMs, balance.gio.sitMaxMs);
    this.blinkInMs = this.nextBlinkMs();
    this.sprite.setFlipX(false);
    this.playSit();
  }

  private playSit(): void {
    this.sprite.setOrigin(0.5, gioFootOrigin(SIT_ID, this.facing));
    this.sprite.play(`${SIT_ID}_${this.facing}`, true);
  }

  private blink(): void {
    this.blinkInMs = this.nextBlinkMs();
    this.sprite.setOrigin(0.5, gioFootOrigin(BLINK_ID, this.facing));
    this.sprite.play(`${BLINK_ID}_${this.facing}`);
  }

  private nextBlinkMs(): number {
    return this.rng.between(balance.gio.blinkEveryMinMs, balance.gio.blinkEveryMaxMs);
  }

  private stand(ms: number): void {
    this.mode = 'standing';
    this.waitMs = ms;
    this.physicsBody.setVelocity(0, 0);
    this.sprite.setFlipX(false);
    this.sprite.stop();
    this.sprite.setTexture(STAND_ID, STAND_FRAMES.indexOf(this.facing));
    this.sprite.setOrigin(0.5, gioFootOrigin(STAND_ID, this.facing));
  }

  private nearPlayer(x: number, y: number, playerX: number, playerY: number): boolean {
    return Math.hypot(x - playerX, y - playerY) < balance.gio.keepAwayDistance;
  }

  /** ลุกจากตะกร้าโดยเดินลงทางขอบหน้า ไม่เดินข้ามขอบตะกร้า */
  private leaveSeat(playerX: number, playerY: number): void {
    if (this.nearPlayer(this.exitPoint.x, this.exitPoint.y, playerX, playerY)) {
      this.waitMs = balance.gio.sitMinMs;
      return;
    }
    this.homing = false;
    this.walksLeft = Math.round(this.rng.between(balance.gio.walksBeforeHomeMin, balance.gio.walksBeforeHomeMax));
    this.walkTo([this.exitPoint], () => this.stand(this.rng.between(balance.gio.standMinMs, balance.gio.standMaxMs) / 2));
  }

  private nextWalk(playerX: number, playerY: number): void {
    if (this.walksLeft <= 0) {
      this.goHome(playerX, playerY);
      return;
    }
    const target = this.pickTarget(playerX, playerY);
    if (!target) {
      this.waitMs = balance.gio.standMinMs;
      return;
    }
    this.walksLeft -= 1;
    this.walkTo([target], () => this.stand(this.rng.between(balance.gio.standMinMs, balance.gio.standMaxMs)));
  }

  /** กลับเข้าตะกร้า: เดินมาหน้าตะกร้าก่อน แล้วเดินขึ้นเข้าไปนั่ง */
  private goHome(playerX: number, playerY: number): void {
    if (this.nearPlayer(this.exitPoint.x, this.exitPoint.y, playerX, playerY)) {
      this.waitMs = balance.gio.standMinMs;
      return;
    }
    this.homing = true;
    this.walkTo([...this.aroundSeat(this.exitPoint), this.exitPoint, this.seatFeet], () => this.sitInSeat());
  }

  private homing = false;

  private walkTo(route: { x: number; y: number }[], then: () => void): void {
    this.mode = 'walking';
    this.route = route.map((point) => ({ ...point }));
    this.afterRoute = then;
    this.stuck = { ms: 0, x: this.feetX, y: this.feetY };
    // ให้เวลาเดินตามความยาวทางจริง เผื่อไว้สองเท่า
    let length = 0;
    let from: Point = { x: this.feetX, y: this.feetY };
    for (const point of route) {
      length += Math.hypot(point.x - from.x, point.y - from.y);
      from = point;
    }
    this.walkBudgetMs = Math.max(balance.gio.walkMaxMs * (route.length + 1), (length / balance.gio.walkSpeed) * 1000 * 2);
    this.headToward(this.route[0]!);
  }

  private headToward(point: { x: number; y: number }): void {
    const dx = point.x - this.feetX;
    const dy = point.y - this.feetY;
    const length = Math.hypot(dx, dy) || 1;
    const heading: Vector = { x: dx / length, y: dy / length };
    const speed = balance.gio.walkSpeed;
    this.physicsBody.setVelocity(heading.x * speed, heading.y * speed);
    const facing = direction4From(heading);
    const sheet = walkSheet(facing);
    if (this.facing !== facing || this.sprite.anims.currentAnim?.key !== sheet || !this.sprite.anims.isPlaying) {
      this.facing = facing;
      this.sprite.setFlipX(false);
      this.sprite.setOrigin(0.5, gioFootOrigin(sheet, facing));
      this.sprite.play(sheet, true);
    }
  }

  private stepRoute(deltaMs: number, playerX: number, playerY: number): void {
    const point = this.route[0];
    if (!point) {
      this.afterRoute();
      return;
    }
    const remaining = Math.hypot(point.x - this.feetX, point.y - this.feetY);
    if (remaining <= ARRIVE_PX || remaining < (balance.gio.walkSpeed * deltaMs) / 1000) {
      this.physicsBody.reset(point.x, point.y - BODY_HEIGHT / 2);
      this.route.shift();
      if (this.route.length === 0) {
        this.physicsBody.setVelocity(0, 0);
        this.afterRoute();
      } else this.headToward(this.route[0]!);
      return;
    }
    // ไม่เดินชนตัวเอก และไม่เดินค้างตอนชนของ
    const velocity = this.physicsBody.velocity;
    const speed = Math.hypot(velocity.x, velocity.y) || 1;
    const aheadX = this.feetX + (velocity.x / speed) * 8;
    const aheadY = this.feetY + (velocity.y / speed) * 8;
    const homeLeg = this.homing;
    this.walkBudgetMs -= deltaMs;
    this.stuck.ms += deltaMs;
    if (this.stuck.ms >= balance.gio.stuckMs) {
      const moved = Math.hypot(this.feetX - this.stuck.x, this.feetY - this.stuck.y);
      this.stuck = { ms: 0, x: this.feetX, y: this.feetY };
      if (moved < STUCK_MOVE_PX) {
        this.giveUpWalk(homeLeg);
        return;
      }
    }
    if (this.walkBudgetMs <= 0 || (!homeLeg && this.nearPlayer(aheadX, aheadY, playerX, playerY))) {
      this.giveUpWalk(homeLeg);
      return;
    }
    this.headToward(point);
  }

  /** เดินต่อไม่ได้ ยืนพักก่อน ถ้ากำลังกลับบ้านจะลองใหม่รอบหน้า · ระหว่างไปหรือกลับจากโพรงให้ถึงปลายทางเลย */
  private giveUpWalk(homeLeg: boolean): void {
    this.route = [];
    if (this.trip === 'out') {
      this.hide();
      return;
    }
    if (this.trip === 'back') {
      this.physicsBody.reset(this.seatFeet.x, this.seatFeet.y - BODY_HEIGHT / 2);
      this.sitInSeat();
      return;
    }
    if (homeLeg) this.walksLeft = 0;
    this.stand(balance.gio.standMinMs);
  }

  /** สุ่มจุดเดินในรัศมีเล่นรอบตะกร้า ไม่เดินผ่านตะกร้า และไม่ไปใกล้ตัวเอก */
  private pickTarget(playerX: number, playerY: number): { x: number; y: number } | null {
    const { walkSpeed, walkMinMs, walkMaxMs, wanderRadius } = balance.gio;
    for (let attempt = 0; attempt < HEADING_TRIES; attempt += 1) {
      const fromHome = Math.hypot(this.feetX - this.exitPoint.x, this.feetY - this.exitPoint.y);
      const angle = this.rng.between(0, Math.PI * 2);
      let heading: Vector = { x: Math.cos(angle), y: Math.sin(angle) };
      if (fromHome > wanderRadius) heading = { x: (this.exitPoint.x - this.feetX) / fromHome, y: (this.exitPoint.y - this.feetY) / fromHome };
      const length = (walkSpeed * this.rng.between(walkMinMs, walkMaxMs)) / 1000;
      const target = { x: this.feetX + heading.x * length, y: this.feetY + heading.y * length };
      if (this.crossesSeat(this.feetX, this.feetY, target.x, target.y)) continue;
      if (this.nearPlayer(target.x, target.y, playerX, playerY)) continue;
      return target;
    }
    return null;
  }

  /** เส้นเดินตัดผ่านกรอบตะกร้า (ขยายเผื่อตัวจีโอ) หรือไม่ */
  private crossesSeat(fromX: number, fromY: number, toX: number, toY: number): boolean {
    const box = this.seatBox;
    if (!box) return false;
    const margin = BODY_WIDTH / 2;
    for (let step = 0; step <= 20; step += 1) {
      const x = fromX + ((toX - fromX) * step) / 20;
      const y = fromY + ((toY - fromY) * step) / 20;
      if (x > box.left - margin && x < box.right + margin && y > box.top && y < box.bottom + BODY_HEIGHT / 2) return true;
    }
    return false;
  }

  private syncSprite(): void {
    const feetY = this.feetY;
    this.sprite.setPosition(this.body.x, feetY);
    this.sprite.setDepth(feetY);
  }
}

