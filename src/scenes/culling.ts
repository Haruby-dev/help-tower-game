import Phaser from 'phaser';

/** วาดเผื่อนอกขอบกล้องเท่านี้ (พิกเซลเกม) ของที่กำลังเลื่อนเข้าจอจะได้ไม่โผล่ช้า */
const MARGIN_PX = 48;

type Cullable = Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;

/** ภาพ 1:1 ไม่หมุน จึงคิดกรอบจากตำแหน่ง จุดกำเนิด และขนาดภาพ (คูณ scale เผื่อท่ายืดตัวตอนรดน้ำ) */
function onScreen(object: Cullable, view: Phaser.Geom.Rectangle): boolean {
  const width = object.width * Math.abs(object.scaleX);
  const height = object.height * Math.abs(object.scaleY);
  const left = object.x - object.originX * width;
  const top = object.y - object.originY * height;
  return left < view.right + MARGIN_PX && left + width > view.x - MARGIN_PX && top < view.bottom + MARGIN_PX && top + height > view.y - MARGIN_PX;
}

/**
 * ไม่วาดภาพที่อยู่นอกกล้อง (หน้าตาเหมือนเดิมทุกพิกเซล) ฉากมีภาพราว 800 ชิ้น เดิมสั่งวาดทุกชิ้นทุกภาพแม้อยู่นอกจอ
 * มือถือจึงสั่งการ์ดจอวาดหลายร้อยครั้งต่อภาพจนเหลือราว 20 ภาพต่อวินาที
 * ใช้กับภาพที่อยู่ในฉากตอนเรียก (ของในแผนที่ ดอกไม้ แปลงผัก ตัวละคร) ของในกล่องรวมหรือติดจอไม่ยุ่ง
 */
export function cullOffscreen(scene: Phaser.Scene): void {
  for (const child of scene.children.list) {
    if (!(child instanceof Phaser.GameObjects.Image) && !(child instanceof Phaser.GameObjects.Sprite)) continue;
    if (child.parentContainer || child.scrollFactorX !== 1 || child.scrollFactorY !== 1) continue;
    const original = child.willRender.bind(child);
    child.willRender = (camera: Phaser.Cameras.Scene2D.Camera): boolean => original(camera) && onScreen(child, camera.worldView);
  }
}
