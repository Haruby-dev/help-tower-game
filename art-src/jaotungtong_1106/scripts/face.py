from PIL import Image
U=(0x1a,0x01,0x1f,255); B=(0x4a,0x07,0x3e,255); F=(0xf9,0xf0,0xc5,255); V=(0xfe,0xff,0xfe,255)
LE={27:[23,24],28:[22,23,24,25],29:[22,23,24,25],30:[22,23,24,25],31:[23,24]}
RE={27:[36,37],28:[35,36,37,38],29:[35,36,37,38],30:[35,36,37,38],31:[36,37]}
def clear_eyes(p):
    for E in (LE,RE):
        for y,xs in E.items():
            for x in xs: p[x,y]=F
    p[35,31]=F; p[38,31]=F
def smirk(p):
    for xy in [(27,33),(33,33),(30,33),(28,34),(32,34)]: p[xy]=F
    for x in (28,29,30,31): p[x,34]=B
    p[32,33]=B; p[33,32]=B
def halflid(p):
    for E,sh in ((LE,23),(RE,36)):
        xs=E[28]
        for x in E[27]: p[x,27]=F
        for x in xs: p[x,28]=U
        p[xs[0]-1,28]=U  # small outer-ish extension left side of each eye
        for x in xs: p[x,29]=U; p[x,30]=U
        p[sh,29]=V
def H1(im):
    im=im.copy(); p=im.load(); halflid(p); smirk(p); return im
def H2(im):
    im=im.copy(); p=im.load(); smirk(p)
    for x in (22,23,24): p[x,25]=B          # left brow flat
    for x in (36,37): p[x,24]=B             # right brow raised
    p[35,25]=B; p[38,25]=B
    return im
def H3(im):
    im=im.copy(); p=im.load(); clear_eyes(p); smirk(p)
    for x in (22,23,24,25): p[x,29]=U
    p[21,28]=U
    for x in (35,36,37,38): p[x,29]=U
    p[39,28]=U
    return im
