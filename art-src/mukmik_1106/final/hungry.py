import sys, colorsys
import numpy as np
from PIL import Image, ImageDraw
H=lambda h:np.array([int(h[i:i+2],16) for i in (0,2,4)])
RED=H('c2364a'); RED_L=H('e07484')
DARK={'823247','823548','82293b','894347','89384b','853649','85394b','91444f'}
LIGHTEYE={'b9746a','b46d66'}
SCARF={'738f51':'6e5136','759254':'6e5136','779556':'7a5a3a','7e9d5a':'7a5a3a','8ca168':'8f6a42','96b56a':'9c7448','96b56a':'9c7448','aecb72':'b88d55','c1de82':'cfa96c','c4e388':'d6b378'}
def hx(p): return '%02x%02x%02x'%tuple(int(v) for v in p[:3])
def recolor(f, eyes):
    a=np.array(f).astype(int); out=a.copy()
    for y in range(40):
        for x in range(40):
            if a[y,x,3]==0: continue
            c=hx(a[y,x]); r,g,b=a[y,x,:3]/255; h,s,v=colorsys.rgb_to_hsv(r,g,b)
            if y>=20 and c in SCARF: out[y,x,:3]=H(SCARF[c]); continue
            if y>=20 and 0.2<h<0.45 and s>0.2: # other greens on the scarf
                out[y,x,:3]=H('8f6a42') if v<0.7 else H('c49a5e'); continue
            if c=='fab9c7': out[y,x,:3]=H('d9aab0'); continue
            if (0.04<h<0.2 and s<0.5 and v>0.72) or c in('fcfbf7','fdfae5','fcfaed'):   # fur / cream
                s2=s*0.85+0.10; v2=v*0.93; nr,ng,nb=colorsys.hsv_to_rgb(0.10,min(s2,0.55),v2); out[y,x,:3]=[round(nr*255),round(ng*255),round(nb*255)]; continue
            if y<20 and 0.42<h<0.55 and s>0.1:   # inner ear blue/mint, dull a bit
                nr,ng,nb=colorsys.hsv_to_rgb(h,s*0.5,v*0.9); out[y,x,:3]=[round(nr*255),round(ng*255),round(nb*255)]
    for e in eyes:
        if e[0] in ('side','sideW'):
            dy=e[1]; pts=[(25,21),(25,22),(26,22)]; hl=(26,21)
            if e[0]=='sideW': pts=[(39-x,y) for x,y in pts]; hl=(39-hl[0],hl[1])
            for x,y in pts: out[y-dy,x,:3]=RED
            out[hl[1]-dy,hl[0],:3]=a[hl[1]-dy,hl[0],:3]
            continue
        (x0,x1,y0,y1)=e
        for y in range(y0,y1+1):
            for x in range(x0,x1+1):
                c=hx(a[y,x])
                if a[y,x,3] and c in DARK: out[y,x,:3]=RED
                elif a[y,x,3] and c in LIGHTEYE: out[y,x,:3]=RED_L
    return Image.fromarray(out.astype(np.uint8))
def front_eyes(f):
    a=np.array(f); boxes=[]
    for y in range(14,30):
        for x in range(40):
            if a[y,x,3] and tuple(a[y,x,:3])==(255,255,255): boxes.append((x-2,x+2,y,y+1))
    return boxes
D=sys.argv[1]
stand=Image.open(D+'/mukmik_sweet_stand_4dir.png').convert('RGBA'); hop=Image.open(D+'/mukmik_sweet_hop_4dir.png').convert('RGBA')
LIFT=[0,2,1,0,2,1]
def side_box(dy): return [('side',dy)]
def mirror_box(bs): return [('sideW',b[1]) for b in bs]
st=Image.new('RGBA',(160,40))
for i,n in enumerate('SENW'):
    f=stand.crop((40*i,0,40*i+40,40))
    eyes=front_eyes(f) if n=='S' else side_box(0) if n=='E' else mirror_box(side_box(0)) if n=='W' else []
    st.alpha_composite(recolor(f,eyes),(40*i,0))
st.save(D+'/mukmik_hungry_stand_4dir.png')
hp=Image.new('RGBA',(240,160))
for r,n in enumerate('SENW'):
    for c in range(6):
        f=hop.crop((c*40,r*40,c*40+40,r*40+40))
        eyes=front_eyes(f) if n=='S' else side_box(LIFT[c]) if n=='E' else mirror_box(side_box(LIFT[c])) if n=='W' else []
        hp.alpha_composite(recolor(f,eyes),(c*40,r*40))
hp.save(D+'/mukmik_hungry_hop_4dir.png')
# previews
z=Image.new('RGBA',(4*330+10,2*330+10),(250,246,240,255))
for i in range(4):
    z.alpha_composite(stand.crop((40*i,0,40*i+40,40)).resize((320,320),Image.NEAREST),(10+i*330,10))
    z.alpha_composite(st.crop((40*i,0,40*i+40,40)).resize((320,320),Image.NEAREST),(10+i*330,340))
z.save(D+'/hungry_compare_x8.png')
gif=[]
for c in range(6):
    cv=Image.new('RGBA',(4*44+4,92),(156,204,120,255))
    for i in range(4):
        cv.alpha_composite(hop.crop((c*40,i*40,c*40+40,i*40+40)),(4+44*i,4))
        cv.alpha_composite(hp.crop((c*40,i*40,c*40+40,i*40+40)),(4+44*i,48))
    gif.append(cv.resize((cv.size[0]*4,cv.size[1]*4),Image.NEAREST).convert('P',palette=Image.ADAPTIVE))
gif[0].save(D+'/hungry_hop.gif',save_all=True,append_images=gif[1:],duration=110,loop=0)
