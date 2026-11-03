from PIL import Image, ImageDraw
import numpy as np, math, random
from scipy import ndimage
exec(open('pond_fx3.py').read().split('# light streak caustic layer')[0])
def tint(col,d):
    k=min(0.62,0.18+d/40)
    wcol=np.array([40,130,145]) if d<14 else np.array([30,94,122])
    return (np.array(col)*(1-k)+wcol*k)
# ---- floor: continuous cobble bed (voronoi) tinted by depth ----
rnd=random.Random(21)
from scipy.spatial import cKDTree
pts_=[]
for _ in range(1400):
    x=rnd.uniform(0,W); y=rnd.uniform(0,H); pts_.append((x,y))
tree=cKDTree(pts_)
yy,xx=np.mgrid[0:H,0:W]
dd,ii=tree.query(np.stack([xx.ravel(),yy.ravel()*1.25],1),k=2)
d1=dd[:,0].reshape(H,W); d2=dd[:,1].reshape(H,W); cell=ii[:,0].reshape(H,W)
edge=(d2-d1)<1.3
pal=[(150,140,122),(132,126,112),(162,150,128),(120,114,104),(140,132,118)]
cellcol=np.array([pal[rnd.randrange(len(pal))] for _ in pts_])
fl=np.array(static.convert('RGBA')).astype(float)
cx_=np.array([p[0] for p in pts_]); cy_=np.array([p[1] for p in pts_])
for y in range(H):
    for x in range(W):
        if not water[y,x] or obj[y,x]: continue
        d=dist[y,x]; c=cellcol[cell[y,x]].astype(float)
        # light from top-left inside each cobble
        if (x-cx_[cell[y,x]])+(y-cy_[cell[y,x]])<-2: c=c*1.12
        elif (x-cx_[cell[y,x]])+(y-cy_[cell[y,x]])>3: c=c*0.86
        if edge[y,x]: c=c*0.7
        k=min(0.82,0.48+d/40)
        edges=[3,8,14,22]; kb=sum(1 for e in edges if d>=e)
        wcol=BANDS[kb].astype(float)
        fl[y,x,:3]=c*(1-k)+wcol*k
# ---- the hole: deepest open spot ----
cand=dist.copy(); cand[obj]=0
# avoid dock/rock vicinity
cand[ndimage.binary_dilation(obj,iterations=18)]=0
hy,hx=np.unravel_index(np.argmax(cand),cand.shape)
R=17
hr=random.Random(5)
harm=[(hr.uniform(0.08,0.22),hr.randint(2,5),hr.uniform(0,6.28)) for _ in range(3)]
def rad(th): return R*(1+sum(a_*math.sin(n*th+p) for a_,n,p in harm))
BAYER=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]]
DARK=np.array([10,26,44]); MIDD=np.array([18,48,74])
for Y in range(max(0,hy-40),min(H,hy+40)):
    for X in range(max(0,hx-50),min(W,hx+50)):
        if not water[Y,X] or obj[Y,X]: continue
        dx=X-hx; dy=(Y-hy)/0.72
        th=math.atan2(dy,dx); e=math.hypot(dx,dy)/rad(th)
        if e>1.6: continue
        cur=fl[Y,X,:3]
        if e<0.45: c=DARK
        else:
            t=min(1,max(0,(e-0.45)/1.15))      # 0 at the throat, 1 at the outside
            t=t*t*(3-2*t)
            thr=(BAYER[Y%4][X%4]+0.5)/16
            # stepped, dithered shading so it stays pixel art
            lvl=t*3
            base=int(lvl); frac=lvl-base
            if frac>thr: base+=1
            cols=[DARK,MIDD,cur*0.62,cur]
            c=cols[min(3,base)]
        fl[Y,X,:3]=c
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
        rr_=rad(a)*0.55; X=int(hx+math.cos(a)*rr_); Y=int(hy+math.sin(a)*rr_*0.72)
        d.line([(X,Y),(X+1,Y)],fill=(70,130,160,120))
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
