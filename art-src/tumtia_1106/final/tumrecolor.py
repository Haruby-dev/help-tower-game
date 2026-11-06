import sys, colorsys, numpy as np
from PIL import Image, ImageDraw
D=sys.argv[1]
H=lambda h:np.array([int(h[i:i+2],16) for i in (0,2,4)])
src=np.array(Image.open(D+'/cand_D48.png').convert('RGBA'))
def hx(p): return '%02x%02x%02x'%tuple(int(v) for v in p[:3])
CAP={'7fc85f':'ee7a72','68a854':'d95a5a','57964e':'c04a52','367551':'8e3346','738f37':'c04a52','645e23':'8e3346'}
MINT_RAMP=['3f5f99','5a84c4','6f9fd6','84b8e6','9fd0f5']   # dark..light blue
def is_mint(c):
    r,g,b=H(c)/255; h,s,v=colorsys.rgb_to_hsv(r,g,b); return 0.36<h<0.55 and s>0.15
def is_cream(c):
    r,g,b=H(c)/255; h,s,v=colorsys.rgb_to_hsv(r,g,b); return 0.1<h<0.2 and s<0.45 and v>0.85
def mint_to_blue(c):
    r,g,b=H(c)/255; h,s,v=colorsys.rgb_to_hsv(r,g,b)
    k=0 if v<0.5 else 1 if v<0.65 else 2 if v<0.75 else 3 if v<0.85 else 4
    return H(MINT_RAMP[k])
RED=('f08a84','e06b6b'); YEL=('fbe08a','f2cc5e'); BLUE_L=('9fd0f5','84b8e6')
def make(variant):
    a=src.copy()
    for y in range(48):
        for x in range(48):
            if not a[y,x,3]: continue
            c=hx(a[y,x])
            if 12<=y<=28 and x<=40 and c in CAP: a[y,x,:3]=H(CAP[c]); continue
            pj = 28<=y<=41 and 8<=x<=35 and not (y<=34 and x<=17)
            if not pj: continue
            if c in ('fc6421','e14214','f4ae07'):   # buttons / zipper line
                a[y,x,:3]=H({'A':'e05a5a','B':'f2c14e','C':'fdf6c6'}[variant]); continue
            if is_mint(c): a[y,x,:3]=mint_to_blue(c); continue
            if c in ('f5e8a3','fbf1b6','e9d394','dfc688','f8e5b6'):
                light=H(c)[2]>0xc0
                if variant=='A': a[y,x,:3]=H(YEL[0] if light else YEL[1])
                elif variant=='B': a[y,x,:3]=H(RED[0] if light else RED[1])
                else:   # C: cream stripes alternate red / yellow by column band
                    band=(x//3)%2
                    a[y,x,:3]=H((RED if band else YEL)[0 if light else 1])
    return Image.fromarray(a)
outs={k:make(k) for k in 'ABC'}
for k,im in outs.items(): im.save(D+f'/tum_col_{k}.png')
items=[('pixen (green)',Image.fromarray(src))]+[(t,outs[k]) for k,t in [('A','A blue + yellow stripes, red buttons'),('B','B blue + red stripes, yellow buttons'),('C','C blue + red/yellow stripes')]]
z=Image.new('RGBA',(4*330+10,370),(250,246,240,255)); d=ImageDraw.Draw(z)
for i,(t,im) in enumerate(items):
    z.alpha_composite(im.resize((320,320),Image.NEAREST),(10+i*330,8)); d.text((14+i*330,345),t,fill=(80,40,60))
z.save(D+'/tum_colors_x6.png')
g=Image.open(D+'/../muk/sheet_raw.png').crop((0,0,152,64)); mk=Image.open(D+'/../muk/mukmik_sweet_stand_4dir.png').crop((0,0,40,40))
W=4+152+4+44+3*52+4; c=Image.new('RGBA',(W,72),(156,204,120,255)); c.alpha_composite(g,(4,4)); c.alpha_composite(mk,(160,28))
for i,k in enumerate('ABC'): c.alpha_composite(outs[k],(204+52*i,20))
c.resize((W*4,288),Image.NEAREST).save(D+'/tum_colors_scene.png')
