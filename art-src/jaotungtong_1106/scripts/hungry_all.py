from PIL import Image
import colorsys
def hx(s): return tuple(int(s[i:i+2],16) for i in (0,2,4))
PLUM=(0x4a,0x07,0x3e)
FUR_EX={hx(a):hx(b) for a,b in zip(['f7dfa3','edc26c','dca552','c48647'],['e6dcc6','d4c6a6','bfae8e','9e8c70'])}
ANT_EX={hx(a):hx(b) for a,b in zip(['f5e083','f1cc3c','ebb743','e29e27','cd7e1a','b15b14','923815','f9f0c5'],['e3efb0','c9de8a','b5cf78','9fbd66','80a052','5f7f42','4c6638','eef5d2'])}
CHEEK=(0xe3,0xa6,0x9b)
def hsv(c): return colorsys.rgb_to_hsv(*[a/255 for a in c])
def rgb(h,s,v): return tuple(round(a*255) for a in colorsys.hsv_to_rgb(h,s,v))
def is_fur(c):
    h,s,v=hsv(c); h*=360
    return 25<=h<=45 and 0.28<=s<0.69 and v>0.6
def is_gold(c):
    h,s,v=hsv(c); h*=360
    if not (12<=h<=66): return False
    if c in ANT_EX: return True
    return (s>=0.69) or (h>=45 and s>0.15)
def fur_map(c):
    if c in FUR_EX: return FUR_EX[c]
    h,s,v=hsv(c); h2=min(h*360+4,42)/360
    return rgb(h2, s*0.43, max(0.35,min(1,1.45*v-0.5)))
def ant_map(c):
    if c in ANT_EX: return ANT_EX[c]
    h,s,v=hsv(c)
    return rgb(80/360, min(s*0.55,0.5), max(0.3,min(0.96,1.6*v-0.63)))
# per-direction stand geometry: (antler zone max y, crown box x0,x1,y0,y1)
GEO={'S':(21,(26,38,11,20)),'E':(20,(33,42,12,19)),'N':(19,(25,37,11,17)),'W':(20,(18,27,13,19))}
HEADMAX={'S':35,'E':32,'N':30,'W':32}
CREAM=(0xf9,0xf0,0xc5)
def head_offset(stand,frame):
    best=None
    for dx in range(-3,4):
        for dy in range(-4,5):
            s=0
            for y in range(0,24):
                for x in range(0,64):
                    a=stand[x,y]; xx,yy=x+dx,y+dy
                    b=frame[xx,yy] if 0<=xx<64 and 0<=yy<64 else (0,0,0,0)
                    if (a[3]>0)!=(b[3]>0): s+=1
            if best is None or s<best[0]: best=(s,dx,dy)
    return best[1],best[2]
def recolor(fr,d,dx=0,dy=0):
    fr=fr.copy(); p=fr.load()
    zy,(cx0,cx1,cy0,cy1)=GEO[d]
    for y in range(64):
        for x in range(64):
            c=p[x,y]
            if not c[3]: continue
            k=c[:3]
            if k==PLUM: continue
            incrown = cx0+dx<=x<=cx1+dx and cy0+dy<=y<=cy1+dy
            if y<=zy+dy and not incrown and is_gold(k) and not is_fur(k):
                p[x,y]=ant_map(k)+(255,); continue
            if is_fur(k) and not incrown:
                p[x,y]=fur_map(k)+(255,); continue
            if (not incrown) and zy+dy<y<=HEADMAX[d]+dy and k!=CREAM:
                hh,ss,vv=hsv(k)
                if 12<=hh*360<=50 and ss>=0.5:
                    p[x,y]=fur_map(k)+(255,); continue
            h,s,v=hsv(k)
            if (h*360>=335) and 0.35<=s<=0.62 and v>0.85 and 29+dy<=y<=37+dy:
                p[x,y]=CHEEK+(255,)
    return fr
F=(0xf9,0xf0,0xc5,255); B=PLUM+(255,)
def frown_stand(sheet):
    p=sheet.load()
    # S
    for xy in [(28,34),(32,33),(33,32)]: p[xy]=F
    for x in (29,30,31): p[x,34]=B
    p[28,35]=B; p[32,35]=B
    # E (offset 64): smirk corner up -> down
    p[64+42,31]=F; p[64+42,33]=B
    # W (offset 192)
    p[192+19,31]=F; p[192+19,33]=B
    return sheet
