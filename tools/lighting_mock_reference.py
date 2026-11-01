from PIL import Image, ImageDraw, ImageFilter, ImageChops
import random, numpy as np
src=Image.open('APPROVED_scene_reference.png').convert('RGB').resize((640,360),Image.NEAREST)
W,H=640,360
rr=random.Random(21)
# ---- canopy shade mask (1 = shade) ----
m=Image.new('L',(W,H),0); d=ImageDraw.Draw(m)
def canopy(cx,cy,rx,ry,n=14):
    for i in range(n):
        x=cx+rr.uniform(-rx,rx); y=cy+rr.uniform(-ry,ry); r=rr.uniform(14,34)
        d.ellipse([x-r,y-r*0.8,x+r,y+r*0.8],fill=255)
for c in [(-10,120,90,110),(20,330,100,60),(650,170,90,120),(640,340,90,60),(120,-10,170,40),(520,-5,170,40),
          (470,310,70,34),(150,250,50,30),(330,350,80,22),(560,95,40,40),(200,150,26,26)]:
    canopy(*c,n=22)
# sun flecks: small holes of light inside shade
for i in range(60):
    x,y=rr.randrange(W),rr.randrange(H); r=rr.uniform(2,5); d.ellipse([x-r,y-r,x+r,y+r],fill=0)
bayer0=np.array([[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]])/16
TH=np.tile(bayer0,(H//4+1,W//4+1))[:H,:W]
def dq(x): return np.floor(x*4+TH)/4
def apply(mask,soft):
    a=np.asarray(src).astype(float)/255
    s=np.asarray(mask).astype(float)/255
    shade=np.array([0.42,0.52,0.66])           # cool shade tint (multiply)
    a=a*(1-s[...,None]*0.85)+a*shade*(s[...,None]*0.85)
    # warm afternoon grade + warm light pool in the clearing
    yy,xx=np.mgrid[0:H,0:W]
    pool=np.clip(1-(((xx-300)/260)**2+((yy-250)/170)**2),0,1)
    if not soft: pool=dq(pool)
    a=a*np.array([1.05,1.0,0.90])
    a=a+pool[...,None]*np.array([0.10,0.07,0.0])
    # glows (fire, gate, burrow)
    for gx,gy,rad,col in [(262,245,46,(1.0,0.6,0.25)),(355,8,40,(0.45,0.7,1.0)),(573,232,30,(0.7,0.4,1.0))]:
        gl=np.clip(1-np.sqrt((xx-gx)**2+(yy-gy)**2)/rad,0,1)
        if not soft: gl=dq(gl)
        a=a+gl[...,None]**1.5*np.array(col)*0.35
    # vignette
    v=np.clip((((xx-W/2)/(W*0.62))**2+((yy-H/2)/(H*0.62))**2),0,1)
    if not soft: v=dq(v)
    a=a*(1-v[...,None]*0.35)
    return Image.fromarray((np.clip(a,0,1)*255).astype('uint8'))
# A: soft (like the reference)
softm=m.filter(ImageFilter.GaussianBlur(7))
A=apply(softm,True)
# B: pixel-friendly: blur then 3 hard steps with ordered dither on the edges
bm=np.asarray(m.filter(ImageFilter.GaussianBlur(5))).astype(float)/255
bayer=np.array([[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]])/16
th=np.tile(bayer,(H//4+1,W//4+1))[:H,:W]
q=np.floor(bm*3+th)/3
Bm=Image.fromarray((np.clip(q,0,1)*255).astype('uint8'))
B=apply(Bm,False)
for n,im in [('fx_soft.png',A),('fx_pixel.png',B),('fx_before.png',src)]:
    im.resize((1280,720),Image.NEAREST).save(n)
print('ok')
