from PIL import Image
from collections import Counter
OL=(0x2b,0x00,0x23)
im=Image.open('cand_1.png').convert('RGBA'); w,h=im.size; px=im.load()
def nb4(x,y): return [(x+dx,y+dy) for dx,dy in((1,0),(-1,0),(0,1),(0,-1))]
def transparent(a,b): return not(0<=a<w and 0<=b<h) or px[a,b][3]==0
outer=[];inner=[]
for y in range(h):
  for x in range(w):
    if px[x,y][3] and px[x,y][:3]==OL:
      (outer if any(transparent(a,b) for a,b in nb4(x,y)) else inner).append((x,y))
print('outer',len(outer),'inner',len(inner))
def neighbour_fill(x,y):
    c=Counter()
    for dy in(-1,0,1):
      for dx in(-1,0,1):
        a,b=x+dx,y+dy
        if 0<=a<w and 0<=b<h and px[a,b][3] and px[a,b][:3] not in (OL,(0x13,0x08,0x30)):
          c[px[a,b][:3]]+=1
    return c.most_common(1)[0][0] if c else None
def mix(a,b,t): return tuple(round(a[i]*(1-t)+b[i]*t) for i in range(3))
PLUM=(0x4a,0x07,0x3e)
# V1 plum
v1=im.copy(); p1=v1.load()
for x,y in outer+inner: p1[x,y]=PLUM+(255,)
v1.save('k1_v1_plum.png')
# V2 selective: tint plum toward neighbouring fill colour; inner outline pixels get stronger tint
v2=im.copy(); p2=v2.load()
for x,y in outer+inner:
    f=neighbour_fill(x,y)
    if f is None: p2[x,y]=PLUM+(255,); continue
    t=0.30 if (x,y) in outer else 0.5
    p2[x,y]=mix(PLUM,f,t)+(255,)
v2.save('k1_v2_selout.png')
print(len(set(p for p in v2.get_flattened_data() if p[3])) if hasattr(v2,'get_flattened_data') else '')
# V3: B + interior lines softened much more (only outer silhouette stays dark)
v3=im.copy(); p3=v3.load()
for x,y in outer+inner:
    f=neighbour_fill(x,y)
    if f is None: p3[x,y]=PLUM+(255,); continue
    if (x,y) in outer: p3[x,y]=mix(PLUM,f,0.30)+(255,)
    else:
        # darker shade of the neighbouring fill
        p3[x,y]=mix(f,PLUM,0.45)+(255,)
v3.save('k1_v3_soft.png')
