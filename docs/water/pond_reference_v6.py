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
harm=[(0.10,2,1.1),(0.07,3,2.6),(0.04,5,0.4)]
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
        if e<0.5: c=DARK if e<0.42 else MIDD
        else:
            # darken the cobbles step by step toward the throat, following each stone
            t=(e-0.5)/1.1
            ci=cell[Y,X]; jitter=((ci*37)%7)/7*0.25
            t=min(1,max(0,t+jitter-0.12))
            f_=[0.28,0.42,0.58,0.76,1.0][min(4,int(t*5))]
            c=cur*f_+DARK*(1-f_)*0.6
        fl[Y,X,:3]=c
floorimg=Image.fromarray(fl.clip(0,255).astype('uint8'))
# ================= v6 additions =================
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

from scipy.spatial import cKDTree
fl=np.array(floorimg).astype(float)
# --- bank shadow: water near the north/west shore gets darker (sun from top-left)
land=~(water|dock)
shade=np.zeros((H,W))
for dy,dx,w in [(-1,0,1.0),(-2,0,0.8),(-3,0,0.6),(-4,0,0.4),(-5,0,0.25),(0,-1,0.6),(0,-2,0.4),(0,-3,0.2)]:
    sh=np.roll(np.roll(land,-dy,0),-dx,1)  # land at offset (dy,dx) from this pixel
    shade=np.maximum(shade,sh*w)
shade[~water]=0
# dock & rock shadows cast down-right
objm=obj.copy()
for k in range(1,5):
    shade=np.maximum(shade,np.roll(np.roll(objm,k+1,0),k,1)*0.55*(water&~obj))
m=(shade>0)
fl[m,:3]=fl[m,:3]*(1-0.42*shade[m,None])
base_floor=fl.copy()
# --- shore stones & reeds (static, on the boundary)
edge_w=water&ndimage.binary_dilation(land,iterations=1)
ey,ex=np.nonzero(edge_w)
rs=random.Random(11)
order=list(range(len(ey))); rs.shuffle(order)
stones_s=[]; reeds=[]
taken=np.zeros((H,W),bool)
for i in order:
    y,x=ey[i],ex[i]
    if taken[max(0,y-6):y+7,max(0,x-6):x+7].any(): continue
    if rs.random()<0.55: stones_s.append((x,y,rs.choice([2,2,3])))
    elif rs.random()<0.35: reeds.append((x,y))
    taken[y,x]=True
    if len(stones_s)>34: break
# --- caustics: drifting voronoi edges
cp=[(rs.uniform(0,W),rs.uniform(0,H),rs.uniform(-1,1),rs.uniform(-1,1)) for _ in range(260)]
yyg,xxg=np.mgrid[0:H,0:W]
depthk=np.clip(1-dist/26,0.15,1.0)
N=48; frames=[]
random.seed(9)
pts=[]
for _ in range(110):
    x=random.randint(0,W-1); y=random.randint(0,H-1)
    if water[y,x] and not obj[y,x] and dist[y,x]>4: pts.append((x,y,random.random()*N,random.choice([2,3])))
lab,nl=ndimage.label(obj); cs=[tuple(map(int,ndimage.center_of_mass(obj,lab,i+1))) for i in range(nl)]; sz=ndimage.sum(obj,lab,range(1,nl+1)); rock=[c for c,s_ in zip(cs,sz) if 40<s_<2000]
lily=[(70,128),(78,132),(64,136),(84,128),(350,92),(357,98),(344,98),(150,200),(158,205),(146,206)]
bubbles=[(rs.uniform(0,1),rs.uniform(-4,4)) for _ in range(6)]
fish=[(0.0,1.0,0),(0.35,-0.6,1),(0.7,2.3,0)]
for f in range(N):
    T=f/N
    # caustic pattern
    P=np.array([[ (x+math.cos(T*2*math.pi+ax*3)*6)%W, (y+math.sin(T*2*math.pi+ay*3)*4)%H ] for (x,y,ax,ay) in cp])
    tr=cKDTree(P); dd,_=tr.query(np.stack([xxg.ravel(),yyg.ravel()],1),k=2)
    caus=((dd[:,1]-dd[:,0])<1.1).reshape(H,W)
    img=base_floor.copy()
    cm=caus&water&~obj
    img[cm,:3]=np.minimum(255,img[cm,:3]+ (30*depthk[cm])[:,None]*(1-0.6*shade[cm,None]))
    # cloud shadow drifting
    cx_=-80+T*(W+160); cyc=H*0.45
    cl=(((xxg-cx_)/70)**2+((yyg-cyc)/40)**2)<1
    bay=np.array([[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]])[yyg%4,xxg%4]
    edgecl=(((xxg-cx_)/70)**2+((yyg-cyc)/40)**2)
    cloud=water&((edgecl<0.75)|((edgecl<1)&(bay<8)))
    img[cloud,:3]*=0.86
    fr=Image.fromarray(img.clip(0,255).astype('uint8')); ov=Image.new('RGBA',fr.size); d=ImageDraw.Draw(ov)
    # fish from the hole
    for (p0,ang,s_) in fish:
        t=((T)+p0)%1.0; dist_=t*70
        x=hx+math.cos(ang)*dist_; y=hy+math.sin(ang)*dist_*0.7; al=int(160*math.sin(t*math.pi))
        if 0<=int(x)<W and 0<=int(y)<H and water[int(y),int(x)] and not obj[int(y),int(x)]: fish_sprite(d,x,y,ang,s_,al)
    # bubbles rising from the hole
    for (p0,ox) in bubbles:
        t=(T*1.5+p0)%1.0
        bx=hx+ox+math.sin(t*9+p0*10)*1.2; by=hy-t*14
        r=1 if t<0.5 else 2
        al=int(220*(1-t*0.6))
        if t<0.92: d.ellipse([bx-r,by-r,bx+r,by+r],outline=(200,240,250,al))
        else: d.ellipse([bx-4,by-1,bx+4,by+2],outline=(200,240,250,120))
    # surface sparkles
    for (x,y,ph,L) in pts:
        t=((f+ph)%N)/N; a=math.sin(t*math.pi)
        if a<0.05: continue
        xx=int(x+t*4)
        for k in range(L if a>0.5 else 1):
            X=xx+k
            if 0<=X<W and water[y,X] and not obj[y,X]: d.point((X,y),fill=(225,250,250,int(190*a)))
    for (cy,cx) in rock:
        for off in (0,N//2):
            t=((f+off)%N)/N; rr=int(t*8); al=int(190*(1-t))
            d.ellipse([cx-8-rr*2,cy+6-rr//2,cx+8+rr*2,cy+10+rr//2],outline=(190,235,232,al))
    fr=fr.convert('RGBA'); fr.alpha_composite(ov); dd_=ImageDraw.Draw(fr)
    # shore stones (half in water)
    for (x,y,r) in stones_s:
        dd_.ellipse([x-r-1,y-r,x+r+1,y+r],fill=(120,112,100),outline=(70,62,56)); dd_.line([(x-r+1,y-r+1),(x,y-r+1)],fill=(168,158,140))
        if (f//6+x)%5==0: dd_.point((x+r+1,y+r),fill=(220,245,245))
    # reeds sway
    for i,(x,y) in enumerate(reeds):
        sw=round(math.sin(T*2*math.pi+i))
        for k,(hgt,dx0) in enumerate([(9,-2),(12,0),(8,2)]):
            dd_.line([(x+dx0,y),(x+dx0+sw*(k%2),y-hgt)],fill=(70,120,60))
            dd_.point((x+dx0+sw*(k%2),y-hgt),fill=(120,170,80))
        dd_.line([(x,y-12+sw),(x,y-9+sw)],fill=(120,80,50))
    for i,(x,y) in enumerate(lily):
        dy=round(math.sin(T*2*math.pi+i))
        dd_.ellipse([x-4,y-2+dy,x+4,y+2+dy],fill=(96,170,80),outline=(40,96,56)); dd_.line([(x,y+dy),(x+3,y-1+dy)],fill=(40,96,56))
        if i%3==0: dd_.point((x-1,y-1+dy),fill=(255,190,210)); dd_.point((x,y-1+dy),fill=(255,230,240))
    frames.append(fr.convert('RGB').resize((W*2,H*2),Image.NEAREST))
frames[0].save('pond_v6.gif',save_all=True,append_images=frames[1:],duration=70,loop=0)
frames[10].save('pond_v6_still.png')
print('ok',len(stones_s),len(reeds))
