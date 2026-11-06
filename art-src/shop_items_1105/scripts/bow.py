"""Redraw the recipe-scroll bow as a clear bow shape (her pick 03:09). 0 credits."""
from PIL import Image
import os, sys
D_ = os.path.dirname(os.path.abspath(__file__))
C = {'A': (92, 48, 76), 'P': (254, 175, 186), 'I': (229, 86, 118), 'D': (176, 52, 96), 'C': (242, 228, 188)}
BOWCOL = {(160, 52, 96), (229, 86, 118), (254, 165, 168), (210, 39, 56), (133, 26, 21)}
BOW = [".AA...AA.",
       "APPA.APPA",
       "APIIAIIPA",
       ".AIDIDIA.",
       "..AADAA..",
       "..AIAIA..",
       ".AIA.AIA.",
       ".AA...AA."]
def rebow(path_in, path_out):
    im = Image.open(path_in).convert('RGBA'); px = im.load()
    # 1) clear the old bow first (paper colour inside the roll, outline on the bottom row)
    for y in range(20, 29):
        for x in range(8, 21):
            if px[x, y][3] and px[x, y][:3] in BOWCOL:
                px[x, y] = (C['C'] + (255,)) if y <= 26 else (C['A'] + (255,))
    if px[16, 28][3]: px[16, 28] = (0, 0, 0, 0)
    # 2) draw the new bow
    for dy, r in enumerate(BOW):
        for dx, c in enumerate(r):
            if c != '.':
                px[10 + dx, 20 + dy] = C[c] + (255,)
    im.save(path_out)
    return im
if __name__ == '__main__':
    for a, b in [('scroll_ข้าวบนใบตอง_v3.png', 'scroll_savory_final.png'), ('scroll_ถังหูลู่_v2.png', 'scroll_sweet_final.png')]:
        rebow(os.path.join(D_, a), os.path.join(D_, b))
