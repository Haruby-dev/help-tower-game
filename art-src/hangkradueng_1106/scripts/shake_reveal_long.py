"""Longer reveal (her ask: shake longer). Same AI shake frames (group f2ba5bcc) reused:
seq = 1 (hold) + shake cycle 2-7 x3 + 8 (hold) = 20 frames.
Cycle 1 straw, cycle 2 lilac revealed head-down with a jagged edge, cycle 3 lilac; hay bits spawn the whole time."""
import sys, colorsys, math, random
from PIL import Image, ImageDraw, ImageFont
S=sys.argv[1]; K=S+"/shake"
def hx(h): return tuple(int(h[i:i+2],16) for i in (0,2,4))
def tohex(t): return "%02x%02x%02x"%t
FUR=set("e6d19a e4cc94 dba975 d29775 cf8f73 e0bb81 f3daac f1e0b1 f4dfb1 ceb280 e7bc9a e5c8b0 c88358 d79c61 d49555 e3a256 f0dcb2".split())
GOLD=set("eaaf42 f8cc4a ffe148".split())
EYE={"0f0321":"4a0a16","360c2d":"7a1626","471634":"9c2234","925468":"d0606a","8e5e80":"c04858","a090ef":"f29aa6"}
A=dict(s=0.45,v=1.03); B=dict(s=0.25,v=0.95,hue=0.78)
def fur(h,p):
    r,g,b=[c/255 for c in hx(h)]; hh,ss,vv=colorsys.rgb_to_hsv(r,g,b)
    nh=p.get("hue",hh); r2,g2,b2=colorsys.hsv_to_rgb(nh,ss*p["s"],min(1,vv*p["v"]))
    return (round(r2*255),round(g2*255),round(b2*255),255)
st=Image.open(f"{S}/out/rot_S.png").convert("RGBA"); sp=st.load()
def diff(f,dx,dy,box):
    fp=f.load(); x0,y0,x1,y1=box; s=0
    for y in range(y0,y1+1):
        for x in range(x0,x1+1):
            a=sp[x,y]; b=fp[x+dx,y+dy]; s+=sum(abs(a[j]-b[j]) for j in range(4))
    return s
FACE=(9,15,30,25)
raw={i:Image.open(f"{K}/k_{i}.png").convert("RGBA") for i in range(1,9)}
SEQ=[1]+[2,3,4,5,6,7]*3+[8]
# split per output frame: 0 = all straw, -1 = all lilac, else rows above y turn lilac (jagged)
SPLIT=[0]+[0]*6+[12,18,24,30,37,44]+[-1]*6+[-1]
JAG=[0,2,1,3,1,0,2,3,1,2]   # per-column offset pattern -> clumps of hay sliding off
frames=[]
for n,i in enumerate(SEQ):
    f=raw[i].copy(); eyeboxes=[]
    if i in (1,8):
        s,dx,dy=min(((diff(f,dx,dy,(12,4,26,14)),dx,dy) for dx in range(4,13) for dy in range(4,13)))
        f.paste(st.crop(FACE),(FACE[0]+dx,FACE[1]+dy)); eyeboxes=[(10+dx,16+dy,15+dx,22+dy),(23+dx,16+dy,28+dx,22+dy)]
    px=f.load(); src=f.copy().load()
    gold=[(x,y) for y in range(56) for x in range(56) if src[x,y][3] and tohex(src[x,y][:3]) in GOLD]
    sp_=SPLIT[n]
    for y in range(56):
        for x in range(56):
            q=src[x,y]
            if not q[3]: continue
            k=tohex(q[:3])
            if k in EYE and any(b[0]<=x<=b[2] and b[1]<=y<=b[3] for b in eyeboxes): px[x,y]=hx(EYE[k])+(255,); continue
            if k in FUR and not any(abs(x-gx)<=2 and abs(y-gy)<=2 for gx,gy in gold):
                lil = sp_==-1 or (sp_>0 and y < sp_+JAG[(x//2)%len(JAG)])
                px[x,y]=fur(k,B if lil else A)
    frames.append(f)
HAY=[hx("f2e4b4"),hx("dcc78c"),hx("bf9f58")]
rnd=random.Random(11); bits=[]
for m in range(60):
    ang=rnd.uniform(-math.pi*0.97,-math.pi*0.03) if m%4 else rnd.uniform(-math.pi,math.pi)
    r0=rnd.uniform(15,18); sx=28+math.cos(ang)*r0; sy=29+math.sin(ang)*r0*0.85
    v=rnd.uniform(2.0,3.4); vx=math.cos(ang)*v; vy=math.sin(ang)*v-0.6
    start=rnd.randint(2,17); bits.append((sx,sy,vx,vy,start,rnd.choice([0,1,1,2]),rnd.choice([(1,0),(1,1),(0,1),(1,-1)])))
def draw_bits(img,n):
    px=img.load()
    for sx,sy,vx,vy,start,c,(dx,dy) in bits:
        t=n-start
        if t<0 or t>4: continue
        x=sx+vx*t; y=sy+vy*t+0.45*t*t
        for k in range(3 if t<3 else 2):
            X=int(round(x+dx*k)); Y=int(round(y+dy*k))
            if 0<=X<56 and 0<=Y<56 and px[X,Y][3]==0: px[X,Y]=HAY[min(2,c+(1 if k==2 else 0))]+(255,)
GROUND=[(12,47,1),(13,47,0),(15,47,2),(40,46,1),(41,46,2),(43,47,0),(44,47,1)]
for n,f in enumerate(frames):
    if n<len(frames)-1: draw_bits(f,n)
    if n>=13:
        px=f.load()
        for X,Y,c in GROUND[:min(len(GROUND),(n-12))]:
            if px[X,Y][3]==0: px[X,Y]=HAY[c]+(255,)
sheet=Image.new("RGBA",(len(frames)*56,56))
for n,f in enumerate(frames): sheet.paste(f,(n*56,0))
sheet.save(f"{K}/hangkradueng_reveal_shake_long_south.png")
DUR=[300]+[80]*18+[800]
pl=Image.open(f"{S}/out/pl.png"); a=Image.open(f"{S}/twins/hangkradueng_a_full_stand_4dir.png").crop((0,0,40,40))
G=3; FEET=10+64*G; out=[]
def put(can,im,x):
    b=im.getbbox(); big=im.resize((im.size[0]*G,im.size[1]*G),Image.NEAREST); can.alpha_composite(big,(x,FEET-b[3]*G))
for f in frames:
    can=Image.new("RGBA",(3*56*G+40,64*G+20),(186,222,160,255))
    put(can,pl,10); put(can,a,10+64*G+10); put(can,f,10+64*G+10+40*G+4); out.append(can.convert("RGB"))
out[0].save(f"{K}/hangkradueng_reveal_long_mock.gif",save_all=True,append_images=out[1:],duration=DUR,loop=0)
Z=3;c=56*Z;font=ImageFont.load_default(size=16)
cols=5; rows=4
img=Image.new("RGBA",(cols*(c+6)+6,rows*(c+24)+6),(250,244,236,255)); d=ImageDraw.Draw(img)
for n,f in enumerate(frames):
    x=6+(n%cols)*(c+6); y=6+(n//cols)*(c+24)
    d.rectangle([x,y+20,x+c-1,y+20+c-1],fill=(255,251,245,255),outline=(225,210,195,255))
    img.alpha_composite(f.resize((c,c),Image.NEAREST),(x,y+20)); d.text((x+3,y+2),f"{n+1} (AI f{SEQ[n]}) {DUR[n]}ms",fill=(110,70,60,255),font=font)
img.save(f"{K}/hangkradueng_reveal_long_frames.png"); print(len(frames),sum(DUR))
