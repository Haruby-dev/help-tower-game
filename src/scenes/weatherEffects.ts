import Phaser from 'phaser';
import { createRng } from '../core/rng';
import type { Weather } from '../core/state';

const RAIN_TINT = { color: 0x56708c, alpha: 0.16 };
const CLOUD_TINT = { color: 0x8a93a3, alpha: 0.1 };
const DROP_COLOR = 0xd2e8f6;
const DROP_ALPHA = 0.7;
/** เม็ดฝนต่อพื้นที่ 640×360 ของกล้อง */
const DROPS_PER_SCREEN = 80;
const SCREEN_AREA = 640 * 360;
const DROP_SPEED_MIN = 190;
const DROP_SPEED_MAX = 260;
const DROP_SLANT = 0.25;
const DROP_LENGTH = 3;

interface Drop {
  x: number;
  y: number;
  speed: number;
}

/** ฝนกับฟ้าครึ้มวาดด้วยโค้ด อยู่ใต้ชั้นกลางคืน เม็ดฝนวางทีละพิกเซลเต็ม */
export class WeatherEffects {
  private readonly tint: Phaser.GameObjects.Rectangle;
  private readonly rain: Phaser.GameObjects.Graphics;
  private drops: Drop[] = [];
  private readonly rng = createRng(Date.now());

  constructor(scene: Phaser.Scene, depth: number) {
    this.tint = scene.add.rectangle(0, 0, 1, 1, RAIN_TINT.color, 0).setOrigin(0).setDepth(depth);
    this.rain = scene.add.graphics().setDepth(depth + 1);
  }

  update(deltaMs: number, view: Phaser.Geom.Rectangle, weather: Weather | null): void {
    const tint = weather === 'rain' ? RAIN_TINT : weather === 'cloudy' ? CLOUD_TINT : null;
    this.tint.setVisible(tint !== null);
    if (tint) this.tint.setPosition(view.x, view.y).setSize(view.width, view.height).setFillStyle(tint.color, tint.alpha);
    this.rain.clear();
    if (weather !== 'rain') return;

    const wanted = Math.round((DROPS_PER_SCREEN * view.width * view.height) / SCREEN_AREA);
    while (this.drops.length < wanted) {
      this.drops.push({
        x: this.rng.next() * view.width,
        y: this.rng.next() * view.height,
        speed: this.rng.between(DROP_SPEED_MIN, DROP_SPEED_MAX),
      });
    }
    this.drops.length = wanted;
    const seconds = deltaMs / 1000;
    this.rain.fillStyle(DROP_COLOR, DROP_ALPHA);
    for (const drop of this.drops) {
      drop.y += drop.speed * seconds;
      drop.x -= drop.speed * DROP_SLANT * seconds;
      if (drop.y > view.height) drop.y -= view.height;
      if (drop.x < 0) drop.x += view.width;
      const x = Math.round(view.x + drop.x);
      const y = Math.round(view.y + drop.y);
      for (let step = 0; step < DROP_LENGTH; step += 1) this.rain.fillRect(x + (step === 0 ? 1 : 0), y + step, 1, 1);
    }
  }
}
