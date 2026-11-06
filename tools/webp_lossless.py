"""แปลงแผ่นรวมภาพ PNG เป็น WebP แบบไม่เสียรายละเอียด (exact) แล้วลบ PNG ทิ้ง

ตรวจทุกพิกเซลหลังแปลง ถ้าไม่ตรงกับต้นฉบับแม้จุดเดียวให้ล้มทันที ห้ามส่งภาพที่ผิดเข้าเกม
ใช้: python tools/webp_lossless.py <ไฟล์.png> [<ไฟล์.png> ...]
"""
import os
import sys

from PIL import Image


def convert(path: str) -> str:
    target = path[: -len(".png")] + ".webp"
    source = Image.open(path).convert("RGBA")
    source.save(target, "WEBP", lossless=True, quality=100, method=6, exact=True)
    back = Image.open(target).convert("RGBA")
    if back.size != source.size or back.tobytes() != source.tobytes():
        raise SystemExit(f"{target}: pixels changed after WebP conversion")
    os.remove(path)
    return target


if __name__ == "__main__":
    for file in sys.argv[1:]:
        convert(file)
