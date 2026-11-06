"""Recipe scroll: several hand-drawn centre pictures (her request 03:03), 0 credits."""
from PIL import Image, ImageDraw, ImageFont
import os
D = os.path.dirname(os.path.abspath(__file__))
C = {'A': (92, 48, 76), 'B': (253, 244, 194), 'E': (234, 218, 176), 'F': (200, 176, 130),
     'R': (255, 255, 250), 'r': (226, 220, 208), 'b': (176, 204, 232), 'd': (130, 164, 206),
     'S': (226, 230, 238), 's': (150, 160, 182), 'G': (128, 188, 104), 'g': (84, 142, 84),
     'Y': (255, 206, 84), 'y': (236, 160, 56), 'p': (240, 120, 160), 'K': (232, 76, 100), 'k': (186, 44, 78),
     'L': (214, 150, 88)}
ART = {
    'ชามข้าว': ["..F..F...",
               ".F..F....",
               ".ARRRRA..",
               "ARRRRRrA.",
               "AbbbbbbA.",
               ".AbddbA..",
               "..AAAA..."],
    'ช้อนส้อม': ["S.S.S..SS",
                "sSsSs.SSS",
                ".AsA..SsS",
                "..As.AsA.",
                "...AsA...",
                "..AsAs...",
                ".As...As."],
    'ข้าวบนใบตอง': ["..F..F...",
                   ".F..F....",
                   "..ARRRA..",
                   ".ARRGRrA.",
                   "AGGGGGGGA",
                   ".AgGGGgA.",
                   "..AAAAA.."],
    'ไข่ดาว': [".........",
              "..ARRA...",
              ".ARRRRRA.",
              "ARRYYRRRA",
              "ARRYyRRA.",
              ".ARRRRA..",
              "..AAAA..."],
    'หมวกเชฟ': ["..AA.AA..",
               ".ARRARRA.",
               "ARRRRRRRA",
               ".ARRRRrA.",
               ".ARRRRrA.",
               ".ApppppA.",
               ".AAAAAAA."],
    'ถังหูลู่': ["......AKA",
               ".....AKRK",
               "...AKAKkA",
               "..AKRKLA.",
               "..AKkAL..",
               ".AKAL....",
               ".LL......"],
}

def make(name):
    im = Image.open(f'{D}/scroll_fix2.png').convert('RGBA'); px = im.load()
    for y in range(12, 19):
        for x in range(11, 20): px[x, y] = C['B'] + (255,)
        px[20, y] = C['E'] + (255,)
    for dy, r in enumerate(ART[name]):
        for dx, c in enumerate(r):
            if c != '.': px[11 + dx, 12 + dy] = C[c] + (255,)
    return im

if __name__ == '__main__':
    F = ImageFont.truetype('/mnt/user-data/uploads/help-tower-game/public/assets/fonts/Mali-Bold.ttf', 24)
    names = list(ART)
    s = Image.new('RGBA', (3 * 330, 2 * 400), (255, 238, 244, 255)); d = ImageDraw.Draw(s)
    for i, n in enumerate(names):
        im = make(n); im.save(f'{D}/scroll_c{i + 1}.png')
        x0, y0 = (i % 3) * 330, (i // 3) * 400
        d.text((x0 + 12, y0 + 4), f'{i + 1} {n}', font=F, fill=(92, 48, 76))
        s.alpha_composite(im.resize((224, 224), Image.NEAREST), (x0 + 10, y0 + 40))
        b = im.getbbox(); c = im.crop(b).resize(((b[2] - b[0]) * 4, (b[3] - b[1]) * 4), Image.NEAREST)
        s.alpha_composite(c, (x0 + 250 - c.width // 2 + 10, y0 + 370 - c.height))
        d.rectangle((x0 + 200, y0 + 370, x0 + 320, y0 + 376), fill=(196, 140, 96))
    s.save(f'{D}/scroll_centers.png')
