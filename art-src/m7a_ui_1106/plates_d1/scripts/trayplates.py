"""Plates on the world food trays -> uniform D1 blue-grey plates (her pick). 0 credits."""
from PIL import Image
import os
D=os.path.dirname(os.path.abspath(__file__))
def lum(p): return 0.299*p[0]+0.587*p[1]+0.114*p[2]
def is_plate(p):
    r,g,b=p[:3]; return p[3] and max(r,g,b)-min(r,g,b)<62 and lum(p)>118
def comps(im):
    px=im.load(); S={(x,y) for y in range(im.height) for x in range(im.width) if is_plate(px[x,y])}; out=[]
    while S:
        p=S.pop(); st=[p]; c={p}
        while st:
            x,y=st.pop()
            for q in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                if q in S: S.remove(q); st.append(q); c.add(q)
        if len(c)>=20: out.append(c)
    return out
EDGE=(150,160,190); RIM=(214,222,236); TOP=(255,255,255); SH=(236,240,248)
def flood(im,seed):
    px=im.load(); c=set(); st=[seed]
    while st:
        x,y=st.pop()
        if (x,y) in c or not(0<=x<im.width and 0<=y<im.height): continue
        p=px[x,y]
        if not p[3] or lum(p)<110: continue
        c.add((x,y)); st+= [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]
        if len(c)>200: return None
    # fill single-pixel holes (dark specks) row by row
    rows={}
    for x,y in c: rows.setdefault(y,[]).append(x)
    for y,xs in rows.items():
        for x in range(min(xs),max(xs)+1): c.add((x,y))
    return c
def plates(im):
    cs=comps(im); seeds=[(round(sum(x for x,y in c)/len(c)),round(sum(y for x,y in c)/len(c))) for c in cs]
    if im.size==(60,36):   # 6-slot tray: the tan bottom-right plate is too saturated for the colour test
        xs=sorted({sx for sx,sy in seeds}); ys=sorted({sy for sx,sy in seeds})
        tr=max(seeds,key=lambda s:(s[0],-s[1])); bm=max(seeds,key=lambda s:(s[1],-abs(s[0]-30)))
        seeds.append((tr[0],bm[1]))
    out=[]
    for i,sd in enumerate(seeds):
        f=flood(im,sd)
        if f is None and i<len(cs):           # light tray (3-slot): flood leaks, keep the colour-test plate + fill specks
            f=set(cs[i]); rows={}
            for x,y in f: rows.setdefault(y,[]).append(x)
            for y,xs in rows.items():
                for x in range(min(xs),max(xs)+1): f.add((x,y))
        if f and all(len(f & o)==0 for o in out): out.append(f)
    return out
def recolor(im):
    im=im.copy(); px=im.load()
    for c in plates(im):
        ys=[y for x,y in c]; cy=(min(ys)+max(ys))/2
        def depth(x,y):
            d=0
            while all((x+dx,y+dy) in c for dx in range(-d-1,d+2) for dy in range(-d-1,d+2) if abs(dx)==d+1 or abs(dy)==d+1): d+=1
            return d
        for (x,y) in c:
            d=0 if any(q not in c for q in ((x+1,y),(x-1,y),(x,y+1),(x,y-1))) else (1 if any(q not in c for q in ((x+2,y),(x-2,y),(x,y+2),(x,y-2))) else 2)
            col=EDGE if d==0 else RIM if d==1 else (SH if y>cy+0.5 else TOP)
            px[x,y]=col+(255,)
    return im
if __name__=='__main__':
    os.makedirs(f'{D}/trays_d1',exist_ok=True)
    for n in (3,6,10):
        src=Image.open(f'{D}/src/public/assets/world/yard/food_tray_{n}.png').convert('RGBA')
        print(n,[len(c) for c in comps(src)])
        recolor(src).save(f'{D}/trays_d1/food_tray_{n}.png')
