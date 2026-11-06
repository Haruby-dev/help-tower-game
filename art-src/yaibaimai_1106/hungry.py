"""Yai Bai Mai hungry recolour: dry autumn crown + faded moss shawl. Body/face unchanged, eyes stay closed.
Crown vs shawl split by a per-direction row threshold, shifted by the frame's bob."""
import colorsys
from PIL import Image

T_DIR = {0: 19, 1: 20, 2: 22, 3: 20}       # crown if y < T (stand pose), dirs S,E,N,W
STAND_TOP = {0: 2, 1: 2, 2: 2, 3: 2}

VARIANTS = {
    'A': (['6b4a2b', '8c6538', 'b08850', 'cfae72', 'e6cf9a'], ['5e6a35', '7d8a45', '9fa85c', 'bfc47c', 'd9dba0']),
    'B': (['6a2f22', '8e4430', 'b5633f', 'd68b5a', 'ecb488'], ['6e6538', '8f8548', 'b0a663', 'cbc283', 'e0d9a6']),
    'C': (['55473e', '75655a', '978778', 'b7a898', 'd6cab9'], ['434c3e', '636d58', '8a9479', 'aeb69c', 'd0d5c5']),
    'D': (['7a5418', 'a0721f', 'c49431', 'dfb752', 'f0d68a'], ['6b7030', '8e9440', 'b0b555', 'cdd072', 'e3e59c']),
}
BERRY = ['3a1f3a', '5a3a5e', '7a5a7e', '9a7f9c']


def h2(s):
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def classify(c):
    r, g, b = [v / 255 for v in c]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    if l < 0.2:
        return 'dark'
    if 0.17 < h < 0.5 and s > 0.2:
        return 'green'
    if 0.55 < h < 0.8:
        return 'blue'
    return 'other'


def ramp_map(colors, ramp):
    cols = sorted(set(colors), key=lum)
    out = {}
    for i, c in enumerate(cols):
        k = 0 if len(cols) == 1 else round(i * (len(ramp) - 1) / (len(cols) - 1))
        out[c] = h2(ramp[k])
    return out


def dry(c):
    r, g, b = [v / 255 for v in c]
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    s *= 0.55
    l *= 0.92
    h = h * 0.6 + 0.07 * 0.4  # pull toward brown-orange
    return tuple(round(v * 255) for v in colorsys.hls_to_rgb(h, l, s))


def recolour_cell(cell, d, variant):
    crown_r, shawl_r = VARIANTS[variant]
    px = cell.load()
    bb = cell.getbbox()
    if not bb:
        return cell
    T = T_DIR[d] + (bb[1] - STAND_TOP[d])
    greens_c, greens_s, blues = [], [], []
    for y in range(cell.height):
        for x in range(cell.width):
            p = px[x, y]
            if not p[3]:
                continue
            k = classify(p[:3])
            if k == 'green':
                (greens_c if y < T else greens_s).append(p[:3])
            elif k == 'blue' and y < T:
                blues.append(p[:3])
    mc, ms, mb = ramp_map(greens_c, crown_r), ramp_map(greens_s, shawl_r), ramp_map(blues, BERRY)
    out = cell.copy()
    op = out.load()
    for y in range(cell.height):
        for x in range(cell.width):
            p = px[x, y]
            if not p[3]:
                continue
            c = p[:3]
            k = classify(c)
            if y < T:
                if k == 'green':
                    op[x, y] = mc[c] + (255,)
                elif k == 'blue':
                    op[x, y] = mb[c] + (255,)
                elif k == 'other':
                    op[x, y] = dry(c) + (255,)
            elif k == 'green':
                op[x, y] = ms[c] + (255,)
    return out


def recolour_sheet(sheet, variant, dirs=(0, 1, 2, 3), cell=48):
    out = Image.new('RGBA', sheet.size)
    rows = sheet.height // cell
    for r in range(rows):
        d = dirs[r]
        for c in range(sheet.width // cell):
            cl = sheet.crop((c * cell, r * cell, c * cell + cell, r * cell + cell))
            out.alpha_composite(recolour_cell(cl, d, variant), (c * cell, r * cell))
    return out
