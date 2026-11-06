from PIL import Image
def hx(s): return tuple(int(s[i:i+2],16) for i in (0,2,4))
DARK={hx(c) for c in ['4b2b3d','3c0f2c','705652','5e383f','d98d6e']}
def fix(im):
    im=im.copy(); p=im.load()
    for x in range(18,46):
        if p[x,16][3] and p[x,16][:3] in DARK: p[x,16]=hx('e6a886')+(255,)
        if p[x,17][3] and p[x,17][:3] in DARK: p[x,17]=hx('f2c49c')+(255,)
    return im
