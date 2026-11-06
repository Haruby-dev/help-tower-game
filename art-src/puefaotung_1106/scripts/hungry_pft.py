from PIL import Image
import colorsys, hop
def hx(s): return tuple(int(s[i:i+2],16) for i in (0,2,4))
def hsv(c): return colorsys.rgb_to_hsv(*[a/255 for a in c])
def rgb(h,s,v): return tuple(round(a*255) for a in colorsys.hsv_to_rgb(h,s,v))
def dilate(m,k=1):
    out=set(m)
    for (x,y) in m:
        for a in range(-k,k+1):
            for b in range(-k,k+1): out.add((x+a,y+b))
    return out
def remove_bird_mirror(fr,d,cx2):
    m=hop.bird_mask(fr,d)
    if not m: return fr.copy()
    m=dilate(m,1)
    out=fr.copy(); p=out.load(); src=fr.load()
    for (x,y) in m:
        if 0<=x<64 and 0<=y<64:
            mx=cx2-x
            p[x,y]=src[mx,y] if 0<=mx<64 else (0,0,0,0)
    return out
def is_coat_red(c):
    h,s,v=hsv(c); h*=360
    return (h>=340 or h<=12) and s>0.45 and v>0.35
def coat(fr,mode):
    out=fr.copy(); p=out.load()
    for y in range(64):
        for x in range(64):
            c=p[x,y]
            if not c[3] or c[:3]==(0x4a,0x07,0x3e): continue
            hh,ss,vv=hsv(c[:3])
            if vv>0.9 and ss<0.7 and 15<y<=29: continue   # nose / face highlights
            if 29<y<=52 and 10<=hh*360<=28 and ss>0.35 and vv>0.75: p[x,y]=rgb(350/360,ss*0.45,min(1,vv*1.0))+(255,); continue   # orange coat highlights
            if is_coat_red(c[:3]) or (y<=15 and 5<=hh*360<=14 and ss>0.45):
                h,s,v=hsv(c[:3])
                if mode=='C1': n=rgb(350/360,s*0.45,min(1,v*1.02))        # dusty rose
                elif mode=='C2': n=rgb(8/360,s*0.55,v*0.88)               # faded brick
                elif mode=='C3': n=rgb(330/360,s*0.32,v*0.85)             # grey mauve
                elif mode=='C4': n=rgb(355/360,s*0.62,v*0.72)             # dull maroon
                else: n=c[:3]
                p[x,y]=n+(255,)
    return out
def straw(fr):
    out=fr.copy(); p=out.load()
    for y in range(0,64):
        for x in range(64):
            c=p[x,y]
            if not c[3]: continue
            h,s,v=hsv(c[:3]); hd=h*360
            if (22<=hd<=50 and s>0.4 and v>0.55) or (y<=15 and 14<=hd<=50 and s>0.4 and v>0.45):   # straw hat (+ its shading), wooden hands, base, gold buttons
                p[x,y]=rgb(h,s*0.6,v*0.93)+(255,)
    return out
def sad_eyes_S(fr):
    out=fr.copy(); p=out.load(); G=hx('4b2b3d')+(255,); C=hx('fbe1b4')+(255,)
    for x in (24,25,26,27): 
        if p[x,20][3]: p[x,20]=G
    for x in (34,35,36,37):
        if p[x,20][3]: p[x,20]=G
    for y in range(21,24):
        for x in range(22,40):
            if p[x,y][:3]==hx('fffdf6'): p[x,y]=C
    return out

import hop as _hop
def remove_bird_W(wfr,efr):
    m=dilate(_hop.bird_mask(wfr,'W') if 'W' in _hop.RECT else set(),1)
    return m
