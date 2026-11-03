from PIL import Image, ImageDraw
import numpy as np, math, random
from scipy import ndimage
base=Image.open('pond_native.png').convert('RGB'); A=np.array(base).astype(int)
r,g,b=A[...,0],A[...,1],A[...,2]
water=(g>r*3)&(b>r*2.5)&(g>90)
# include white sparkle pixels inside water
water=ndimage.binary_closing(water,iterations=2)
water=ndimage.binary_fill_holes(water)
# remove dock/rock: keep only teal-ish or white
dock=np.zeros_like(water); dock[130:216,180:230]=True
dock&=~((g>r*3)&(b>r*2.5))
dist=ndimage.distance_transform_edt(water|dock)
H,W=water.shape
random.seed(4)
# depth colours: shallow sand-teal -> mid teal -> deep blue
BANDS=[np.array([120,196,168]),np.array([70,170,160]),np.array([40,140,148]),np.array([34,112,134]),np.array([30,94,122])]
def lerp(a,b,t): return a+(b-a)*t
out=A.copy().astype(float)
# bottom texture for shallows: pebbles
peb=np.zeros((H,W)); 
for _ in range(220):
    x=random.randint(0,W-1); y=random.randint(0,H-1); peb[y:y+2,x:x+2]=random.choice([1,-1])
for y in range(H):
    for x in range(W):
        if not water[y,x]: continue
        d=dist[y,x]
        edges=[3,8,14,22]
        k=sum(1 for e in edges if d>=e)
        # checker dither one pixel on each band edge
        if k<4 and edges[k]-d<1.0 and (x+y)%2==0: k+=1
        col=BANDS[k].astype(float)
        if d<11 and peb[y,x]!=0: col=col+(16 if peb[y,x]>0 else -16)
        out[y,x]=col
# keep original non-water + dock/rock
orig_keep=~water
# dock/rock: pixels inside water region that are not teal/white in original
teal=(g>r*3)&(b>r*2.5)
white=(r>230)&(g>230)&(b>230)
obj=(water & ~teal & ~white) | (dock & water)
out[obj]=A[obj]
static=Image.fromarray(out.clip(0,255).astype('uint8'))
# light streak caustic layer + sparkles + ripples, 8 frames
frames=[]
sp=[(random.randint(0,W-1),random.randint(0,H-1),random.randint(0,7)) for _ in range(90)]
sp=[s for s in sp if water[s[1],s[0]] and dist[s[1],s[0]]>3]
# ripple centers: around objects (rock/dock posts)
lab,nl=ndimage.label(obj); centers=[tuple(map(int,ndimage.center_of_mass(obj,lab,i+1))) for i in range(nl)]
sizes=ndimage.sum(obj,lab,range(1,nl+1))
centers=[c for c,s in zip(centers,sizes) if s>40]
for f in range(8):
    fr=static.copy(); p=fr.load(); d=ImageDraw.Draw(fr)
    # gentle wave lines (lighter dashes drifting right)
    for (x,y,ph) in sp:
        t=(f+ph)%8
        if t<5:
            xx=x+t//2
            L=[1,2,3,2,1][t]
            for k in range(L):
                X=xx+k
                if 0<=X<W and water[y,X] and not obj[y,X]:
                    c=p[X,y]; p[X,y]=tuple(min(255,int(v+60)) for v in c)
            if t==2 and 0<=xx+1<W and water[y,xx+1]: p[xx+1,y]=(240,255,255)
    for (cy,cx) in centers:
        rr=(f%4)
        bbox=[cx-8-rr*2,cy+6-rr//2,cx+8+rr*2,cy+10+rr//2]
        if rr<3: d.ellipse(bbox,outline=(170,226,222))
    frames.append(fr)
# lily pads with bob
lily=[(70,128),(78,132),(64,136),(350,92),(357,98),(150,200),(158,205)]
for f,fr in enumerate(frames):
    d=ImageDraw.Draw(fr)
    for i,(x,y) in enumerate(lily):
        if not water[y,x]: continue
        dy=1 if (f//2+i)%2 else 0
        d.ellipse([x-4,y-2+dy,x+4,y+2+dy],fill=(96,170,80),outline=(40,96,56)); d.line([(x,y+dy),(x+3,y-1+dy)],fill=(40,96,56))
        if i%3==0: d.point((x-1,y-1+dy),fill=(255,190,210))
big=[fr.resize((W*3,H*3),Image.NEAREST) for fr in frames]
big[0].save('pond_fx.gif',save_all=True,append_images=big[1:],duration=180,loop=0)
B=Image.new('RGB',(W*3,H*3*2+10),(250,244,248)); B.paste(base.resize((W*3,H*3),Image.NEAREST),(0,0)); B.paste(big[2],(0,H*3+10)); B.save('pond_before_after.png')
print(W,H,len(centers))
