from PIL import Image, ImageOps
from hover import south_body_mask, layers, BOB
EB={12:16,13:17,14:18,15:20,16:20,17:21,18:21,19:21,20:21,21:20,22:20,23:19,24:19,25:19,26:19,27:19,28:19,29:19,30:20,31:20,32:21,33:22,34:22,35:21,36:21,37:22,38:23,39:21,40:21,41:20,42:20,43:19,44:19,45:20,46:21,47:22,48:20}
def east_mask():
    return {(x,y) for y in range(56) for x in range(56) if not (y in EB and x<=EB[y])}
def north_mask():
    m=set()
    for y in range(56):
        for x in range(56):
            if y<=13: inb=13<=x<=42
            elif y==14: inb=17<=x<=38
            elif y==15: inb=17<=x<=37
            elif y<=24: inb=19<=x<=34
            elif y<=45: inb=25<=x<=29
            else: inb=21<=x<=33
            if inb: m.add((x,y))
    return m
SYM=[(0,0),(1,0),(2,-1),(2,-1),(1,0),(0,0)]
SIDE=[(0,0),(1,0),(1,-1),(1,-1),(1,0),(0,0)]
def build(S,mask,cx,moves,one_wing=False):
    body,L,R=layers(S,mask,cx); out=[]
    for (dx,dy),b in zip(moves,BOB):
        f=Image.new('RGBA',(56,56))
        f.alpha_composite(L,(dx,dy+b))
        if not one_wing: f.alpha_composite(R,(-dx,dy+b))
        else: f.alpha_composite(R,(dx,dy+b))
        f.alpha_composite(body,(0,b))
        o=S.load(); fp=f.load()
        for x,y in holes(f):
            yy=y-b
            if 0<=yy<56 and o[x,yy][3]: fp[x,y]=o[x,yy]
        out.append(f)
    return out
def holes(f):
    a=f.load(); w,h=f.size; seen=set(); st=[(0,0)]
    while st:
        x,y=st.pop()
        if (x,y) in seen or not(0<=x<w and 0<=y<h) or a[x,y][3]: continue
        seen.add((x,y)); st+=[(x+1,y),(x-1,y),(x,y+1),(x,y-1)]
    return [(x,y) for y in range(h) for x in range(w) if not a[x,y][3] and (x,y) not in seen]
def orig_holes(S): return set(holes(S))
import os
STATE=os.environ.get('STATE','sweet')
sh=Image.open(f'wingwing_{STATE}_stand_4dir.png')
S,E,N=[sh.crop((i*56,0,i*56+56,56)) for i in range(3)]
rows={'S':build(S,south_body_mask(S),28,SYM),
      'E':build(E,east_mask(),56,SIDE,one_wing=True),
      'N':build(N,north_mask(),27,SYM)}
rows['W']=[ImageOps.mirror(f) for f in rows['E']]
base={'S':S,'E':E,'N':N,'W':ImageOps.mirror(E)}
for k,fr in rows.items():
    bh=len(holes(base[k]))
    print(k,'orig holes',bh,'frame holes',[len(holes(f)) for f in fr])
sheet=Image.new('RGBA',(56*6,56*4))
for r,k in enumerate('SENW'):
    for i,f in enumerate(rows[k]): sheet.alpha_composite(f,(i*56,r*56))
sheet.save(f'wingwing_{STATE}_hover_4dir.png')
