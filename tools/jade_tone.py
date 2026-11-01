"""Jade tone (โทนหยก) recolour for ENVIRONMENT art only.
Approved 1 Nov 2026 against docs/level/APPROVED_scene_reference.png.

Usage:  python tools/jade_tone.py <in.png> <out.png> [--house <tree_ref.png>]
- Run on every environment PNG after fetch-assets (ground tiles, cliff, trees, rocks, path stones,
  decals, decor, flowers, gate, burrow, house).
- NEVER run on characters (player, Gio), pets, monsters, UI or item icons.
- The house additionally gets --house <one tree png>: its greens are matched to the tree greens.
Pure per-pixel HSV mapping: deterministic, no blur, alpha untouched.
"""
import sys, colorsys
from PIL import Image

def tone(img):
    img = img.convert('RGBA'); px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if not a: continue
            h, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
            if s > 0.12 and 0.17 < h < 0.55:                 # greens -> jade
                h = 0.40 + (h - 0.30)*0.4; s = min(0.85, s*1.3875); v = min(1, v*1.0812)
            elif s > 0.33 and h < 0.17:                      # earth -> warm sand-orange (reds/pinks h>0.92 are left alone)
                h = 0.075 + (h - 0.05)*0.4; v = min(1, v*1.12)
            if v < 0.22: v = 0.22 + v*0.5                     # lift near-black outlines a little
            r2, g2, b2 = colorsys.hsv_to_rgb(h % 1, s, v)
            px[x, y] = (int(r2*255), int(g2*255), int(b2*255), a)
    return img

def green_stats(img):
    hs = []; ss = []; vs = []
    for r, g, b, a in img.getdata():
        if a < 200: continue
        h, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
        if s > 0.15 and 0.2 < h < 0.6: hs.append(h); ss.append(s); vs.append(v)
    return sum(hs)/len(hs), sum(ss)/len(ss), sum(vs)/len(vs)

def match_greens(img, ref):
    th, hh = green_stats(ref), green_stats(img)
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if not a: continue
            h, s, v = colorsys.rgb_to_hsv(r/255, g/255, b/255)
            if s > 0.12 and 0.2 < h < 0.6:
                h += th[0] - hh[0]; s = min(1, s*th[1]/hh[1]); v = min(1, v*th[2]/hh[2])
                r2, g2, b2 = colorsys.hsv_to_rgb(h % 1, s, v)
                px[x, y] = (int(r2*255), int(g2*255), int(b2*255), a)
    return img

if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    out = tone(Image.open(src))
    if '--house' in sys.argv:
        ref = tone(Image.open(sys.argv[sys.argv.index('--house') + 1]))
        out = match_greens(out, ref)
    out.save(dst)
