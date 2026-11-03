from PIL import Image, ImageDraw
import numpy as np, math, random
from scipy import ndimage
exec(open('pond_fx3.py').read().split('# light streak caustic layer')[0])
# ---- floor: stones under water (tinted by depth) ----
rnd=random.Random(21)
floor=static.copy().convert('RGBA'); fl=np.array(floor).astype(float)
def tint(col,d):  # deeper = more water colour mixed in
    k=min(0.85,0.35+d/30)
    wcol=np.array([40,130,145]) if d<14 else np.array([30,94,122])
    return (np.array(col)*(1-k)+wcol*k)
stones=[]
for _ in range(400):
    x=rnd.randint(4,W-5); y=rnd.randint(4,H-5)
    if not water[y,x] or obj[y,x]: continue
    d=dist[y,x]
    if d<3: continue
    r=rnd.choice([1,2,2,3,3,4]) if d<16 else rnd.choice([2,3,4,5])
    stones.append((x,y,r,d))
stones=stones[:150]
for (x,y,r,d) in stones:
    base=rnd.choice([(150,140,120),(130,124,110),(170,160,140),(120,110,100)])
    for yy in range(-r,r+1):
        for xx in range(-r-1,r+2):
            X,Y=x+xx,y+yy
            if not(0<=X<W and 0<=Y<H) or not water[Y,X] or obj[Y,X]: continue
            e=(xx/(r+1.0))**2+(yy/max(1,r*0.8))**2
            if e>1: continue
            c=np.array(base)*(1.15 if yy<0 else 0.85)
            if e>0.7: c=np.array(base)*0.6
            fl[Y,X,:3]=tint(c,d)
# ---- the hole: deepest open spot ----
cand=dist.copy(); cand[obj]=0
# avoid dock/rock vicinity
cand[ndimage.binary_dilation(obj,iterations=18)]=0
hy,hx=np.unravel_index(np.argmax(cand),cand.shape)
R=14
for yy in range(-R-4,R+5):
    for xx in range(-R-6,R+7):
        X,Y=hx+xx,hy+yy
        if not(0<=X<W and 0<=Y<H) or not water[Y,X]: continue
        e=math.sqrt((xx/(R+4))**2+(yy/(R*0.7))**2)
        if e<=1.0:
            if e<0.55: c=(8,22,40)
            elif e<0.75: c=(14,36,62)
            elif e<0.9: c=(20,52,82)
            else: c=(26,70,100)
            if 0.55<=e<0.75 and (X+Y)%2==0: c=(8,22,40)
            fl[Y,X,:3]=c
        elif e<1.25:
            # ring of rim stones around the hole
            if (int(math.degrees(math.atan2(yy,xx)))//22)%2==0:
                fl[Y,X,:3]=tint((140,130,115) if e<1.12 else (95,88,80),20)
floorimg=Image.fromarray(fl.clip(0,255).astype('uint8'))
# ---- animate: sparkles, rock ripple, lily, hole swirl, fish ----
N=40; frames=[]
random.seed(9)
pts=[]
for _ in range(140):
    x=random.randint(0,W-1); y=random.randint(0,H-1)
    if water[y,x] and not obj[y,x] and dist[y,x]>4: pts.append((x,y,random.random()*N,random.choice([2,3,4])))
lab,nl=ndimage.label(obj); cs=[tuple(map(int,ndimage.center_of_mass(obj,lab,i+1))) for i in range(nl)]; sz=ndimage.sum(obj,lab,range(1,nl+1)); rock=[c for c,s_ in zip(cs,sz) if 40<s_<2000]
lily=[(70,128),(78,132),(64,136),(350,92),(357,98),(150,200),(158,205)]
fish=[(0.0,1.0,0),(0.35,-0.6,1),(0.7,2.3,0)]  # start phase, angle, size
def fish_sprite(d,x,y,ang,s,al):
    cx,cy=math.cos(ang),math.sin(ang)
    L=6+s*2
    for i in range(-L//2,L//2+1):
        w=1.6 if abs(i)<L//3 else 0.8
        for j in (-1,0,1):
            if abs(j)>w: continue
            X=int(round(x+cx*i - cy*j)); Y=int(round(y+cy*i*0.7 + cx*j))
            d.point((X,Y),fill=(10,30,50,al))
    # tail
    for j in (-2,2):
        X=int(round(x-cx*(L//2+2) - cy*j)); Y=int(round(y-cy*(L//2+2)*0.7+cx*j)); d.point((X,Y),fill=(10,30,50,al))
for f in range(N):
    fr=floorimg.copy(); ov=Image.new('RGBA',fr.size); d=ImageDraw.Draw(ov)
    # hole swirl: rotating light dashes on the rim
    for k in range(6):
        a=f/N*2*math.pi+k*math.pi/3
        X=int(hx+math.cos(a)*(R+1)); Y=int(hy+math.sin(a)*(R*0.7-1))
        d.line([(X,Y),(X+1,Y)],fill=(120,190,210,170))
    # fish swim out of the hole and fade
    for (p0,ang,s) in fish:
        t=((f/N)+p0)%1.0
        dist_=t*70
        x=hx+math.cos(ang)*dist_; y=hy+math.sin(ang)*dist_*0.7
        al=int(170*math.sin(t*math.pi))
        if 0<=int(x)<W and 0<=int(y)<H and water[int(y),int(x)] and not obj[int(y),int(x)]:
            fish_sprite(d,x,y,ang,s,al)
    for (x,y,ph,L) in pts:
        t=((f+ph)%N)/N; a=math.sin(t*math.pi)
        if a<0.05: continue
        xx=int(x+t*4); alpha=int(200*a)
        for k in range(L if a>0.5 else max(1,L-1)):
            X=xx+k
            if 0<=X<W and water[y,X] and not obj[y,X]: d.point((X,y),fill=(220,250,250,alpha))
    for (cy,cx) in rock:
        for off in (0,N//2):
            t=((f+off)%N)/N; rr=int(t*8); al=int(200*(1-t))
            d.ellipse([cx-8-rr*2,cy+6-rr//2,cx+8+rr*2,cy+10+rr//2],outline=(190,235,232,al))
    fr.alpha_composite(ov); dd=ImageDraw.Draw(fr)
    for i,(x,y) in enumerate(lily):
        dy=round(math.sin((f/N)*2*math.pi+i))
        dd.ellipse([x-4,y-2+dy,x+4,y+2+dy],fill=(96,170,80),outline=(40,96,56)); dd.line([(x,y+dy),(x+3,y-1+dy)],fill=(40,96,56))
        if i%3==0: dd.point((x-1,y-1+dy),fill=(255,190,210))
    frames.append(fr.convert('RGB').resize((W*2,H*2),Image.NEAREST))
frames[0].save('pond_hole.gif',save_all=True,append_images=frames[1:],duration=70,loop=0)
frames[5].save('pond_hole_still.png')
print(hx,hy)
