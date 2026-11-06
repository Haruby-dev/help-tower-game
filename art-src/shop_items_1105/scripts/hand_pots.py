"""Hand-drawn shop icon: pot + frying pan, 32x32, flat 2-tone colours (her rule 02:32), 0 credits."""
from PIL import Image
import os
D = os.path.dirname(os.path.abspath(__file__))
C = {
    'O': (92, 48, 76), 'P': (248, 170, 190), 'p': (226, 120, 150), 'H': (255, 222, 230), 'h': (214, 84, 132),
    'G': (252, 234, 196), 'g': (226, 194, 138), 'I': (244, 214, 160), 'W': (255, 250, 240),
    'B': (214, 150, 88), 'b': (170, 105, 60),
}
W_ = H_ = 32

def draw():
    px = [[None] * W_ for _ in range(H_)]
    def setp(x, y, c):
        if 0 <= x < W_ and 0 <= y < H_: px[y][x] = c
    # ---- frying pan (round face, standing behind the pot, right side)
    cx, cy = 21, 12
    pan = set()
    for y in range(H_):
        for x in range(W_):
            dx, dy = x - cx, y - cy
            r2 = dx * dx + dy * dy
            if r2 <= 7.6 ** 2:
                pan.add((x, y))
                if r2 <= 4.9 ** 2:
                    setp(x, y, 'g' if dx + dy > 2 else 'I')
                elif r2 <= 5.9 ** 2:
                    setp(x, y, 'O')
                elif dx + dy > 3:
                    setp(x, y, 'g')
                else:
                    setp(x, y, 'G')
    for (x, y) in [(18, 9), (19, 8), (18, 10)]:   # small shine on the cooking surface
        setp(x, y, 'W')
    # handle: 2 px wide, up-right
    handle = [(26, 6, 'B'), (27, 6, 'B'), (27, 5, 'B'), (28, 5, 'B'), (28, 6, 'b'), (27, 7, 'b'),
              (28, 4, 'B'), (29, 4, 'B'), (29, 5, 'b'), (29, 3, 'B'), (30, 3, 'B'), (30, 4, 'b'),
              (29, 2, 'B'), (30, 2, 'B'), (30, 1, 'B')]
    for x, y, c in handle:
        setp(x, y, c); pan.add((x, y))
    # outline the pan silhouette
    def outline(shape):
        for (x, y) in list(shape):
            for nx, ny in [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]:
                if (nx, ny) not in shape and 0 <= nx < W_ and 0 <= ny < H_:
                    setp(nx, ny, 'O')
    outline(pan)
    # inner ring line between rim and cooking surface (lower-right half only, soft)
    # ---- pot (front, left)
    rows = {9: (10, 12), 10: (9, 13), 11: (7, 15), 12: (5, 17), 13: (4, 18), 14: (4, 18), 15: (4, 18),
            16: (2, 20), 17: (3, 19), 18: (3, 19), 19: (3, 19), 20: (3, 19), 21: (3, 19), 22: (3, 19),
            23: (3, 19), 24: (3, 19), 25: (3, 19), 26: (3, 19), 27: (4, 18), 28: (6, 16)}
    pot = set()
    for y, (a, b) in rows.items():
        for x in range(a, b + 1):
            pot.add((x, y))
    # side handles
    for (x, y) in [(1, 18), (2, 18), (1, 19), (2, 19), (20, 18), (21, 18), (20, 19), (21, 19)]:
        pot.add((x, y))
    for (x, y) in pot:
        setp(x, y, 'P')
    # knob cream
    for x in range(10, 13): setp(x, 9, 'W')
    for x in range(9, 14): setp(x, 10, 'G')
    # lid highlight + shadow
    for (x, y) in [(6, 12), (7, 12), (5, 13), (6, 13), (5, 14)]:
        setp(x, y, 'H')
    for y in range(12, 16):
        a, b = rows[y]
        setp(b, y, 'p'); setp(b - 1, y, 'p') if y >= 13 else None
    # rim: plum line + darker band
    for x in range(2, 21): setp(x, 16, 'O')
    for x in range(3, 20): setp(x, 17, 'p')
    # body shading: right 3 columns + bottom 2 rows darker, left highlight strip
    for y in range(18, 29):
        a, b = rows[y]
        for x in range(max(a, b - 2), b + 1): setp(x, y, 'p')
    for y in (27, 28):
        a, b = rows[y]
        for x in range(a, b + 1): setp(x, y, 'p')
    for y in range(19, 24): setp(5, y, 'H')
    for y in range(19, 22): setp(6, y, 'H')
    # handles darker
    for (x, y) in [(1, 18), (1, 19), (21, 18), (21, 19)]: setp(x, y, 'p')
    # heart
    heart = [".h.h.", "hhhhh", ".hhh.", "..h.."]
    for yy, r in enumerate(heart):
        for xx, c in enumerate(r):
            if c != '.': setp(9 + xx, 20 + yy, 'h')
    outline(pot)
    # re-draw rim line ends so it meets the outline
    img = Image.new('RGBA', (W_, H_), (0, 0, 0, 0))
    for y in range(H_):
        for x in range(W_):
            if px[y][x]: img.putpixel((x, y), C[px[y][x]] + (255,))
    return img

if __name__ == '__main__':
    im = draw(); im.save(f'{D}/pots_hand_v1.png')
    im.resize((320, 320), Image.NEAREST).save(f'{D}/pots_hand_v1_x10.png')
    print(len(set(c for c in im.getdata() if c[3])))
