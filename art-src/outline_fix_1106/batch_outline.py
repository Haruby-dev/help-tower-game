import os
from PIL import Image
from collections import Counter
U='/mnt/user-data/uploads/help-tower-game/'
OUT='/home/claude/wing/outline_fix_1106'
PLUM=(0x4a,0x07,0x3e)
def lum(c): return 0.3*c[0]+0.59*c[1]+0.11*c[2]
def dist(a,b): return sum((a[i]-b[i])**2 for i in range(3))**0.5
def is_edge(px,w,h,x,y):
    return any(not(0<=a<w and 0<=b<h) or px[a,b][3]==0 for a,b in((x+1,y),(x-1,y),(x,y+1),(x,y-1)))
def fix(path, ref_dom, rad, outer_only):
    im=Image.open(path).convert('RGBA'); px=im.load(); w,h=im.size
    ec=Counter(px[x,y][:3] for y in range(h) for x in range(w) if px[x,y][3] and is_edge(px,w,h,x,y))
    line={c for c in ec if dist(c,ref_dom)<rad}
    # include same colours inside too (for full mode)
    out=im.copy(); p=out.load(); n=0
    for y in range(h):
        for x in range(w):
            c=px[x,y]
            if not c[3] or c[:3] not in line and dist(c[:3],ref_dom)>=rad: continue
            if outer_only and not is_edge(px,w,h,x,y): continue
            t=min(max(lum(c[:3])-lum(ref_dom),0)/120,0.3)
            p[x,y]=tuple(round(PLUM[i]*(1-t)+c[i]*t) for i in range(3))+(255,); n+=1
    return out,n,ec.most_common(1)[0]
jobs=[('mukmik',U+'public/assets/monsters/mookmik/',['mookmik_sweet_stand.png','mookmik_sweet_walk.png','mookmik_sweet_eat.png','mookmik_hungry_stand.png','mookmik_hungry_walk.png','mookmik_hungry_eat.png'],(0x85,0x36,0x49),40,True),
      ('tumtia',U+'art-src/tumtia_1106/final/',['tumtia_sweet_stand_4dir.png','tumtia_sweet_walk_4dir.png','tumtia_sweet_eat_s.png','tumtia_hungry_stand_4dir.png','tumtia_hungry_walk_4dir.png','tumtia_hungry_eat_s.png'],(0x68,0x22,0x15),30,False)]
for name,d,files,dom,rad,oo in jobs:
    os.makedirs(f'{OUT}/{name}',exist_ok=True)
    for f in files:
        out,n,top=fix(d+f,dom,rad,oo)
        out.save(f'{OUT}/{name}/{f}')
        print(f'{f:32s} {Image.open(d+f).size} changed={n:4d} top_edge=#%02x%02x%02x x{top[1]}'%top[0])
