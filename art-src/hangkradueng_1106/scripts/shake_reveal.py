"""Reveal: twin B shakes off the hay. AI v3 shake (group f2ba5bcc, 8 frames) ->
frames 1-2 straw (disguise), 3-5 lilac revealed from the head down while hay flies off, 6-8 lilac; hay bits drawn by hand.
Frames 1 and 8 get the stand face (star eyes); red eyes like every state."""
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
SPLIT={1:0,2:0,3:22,4:32,5:44,6:-1,7:-1,8:-1}   # rows ABOVE this y turn lilac (0 = all straw, -1 = all lilac)
frames=[]
for i in range(1,9):
    f=Image.open(f"{K}/k_{i}.png").convert("RGBA")
    eyeboxes=[]
    if i in (1,8):
        s,dx,dy=min(((diff(f,dx,dy,(12,4,26,14)),dx,dy) for dx in range(4,13) for dy in range(4,13)))
        f.paste(st.crop(FACE),(FACE[0]+dx,FACE[1]+dy))
        eyeboxes=[(10+dx,16+dy,15+dx,22+dy),(23+dx,16+dy,28+dx,22+dy)]
    px=f.load(); src=f.copy().load()
    gold=[(x,y) for y in range(56) for x in range(56) if src[x,y][3] and tohex(src[x,y][:3]) in GOLD]
    for y in range(56):
        for x in range(56):
            q=src[x,y]
            if not q[3]: continue
            k=tohex(q[:3])
            if k in EYE and any(b[0]<=x<=b[2] and b[1]<=y<=b[3] for b in eyeboxes): px[x,y]=hx(EYE[k])+(255,); continue
            if k in FUR and not any(abs(x-gx)<=2 and abs(y-gy)<=2 for gx,gy in gold):
                lil = SPLIT[i]==-1 or y < SPLIT[i]
                px[x,y]=fur(k,B if lil else A)
    frames.append(f)
# hay bits: short straw sticks flying out from the body edge, then falling
HAY=[hx("efe0b0"),hx("dcc78c"),hx("c4a964")]
rnd=random.Random(7)
bits=[]
for n in range(26):
    ang=rnd.uniform(-math.pi*0.95,-math.pi*0.05) if n%3 else rnd.uniform(-math.pi,math.pi)
    r0=rnd.uniform(15,18); sx=28+math.cos(ang)*r0; sy=29+math.sin(ang)*r0*0.85
    v=rnd.uniform(2.2,3.6); vx=math.cos(ang)*v; vy=math.sin(ang)*v-0.5
    start=rnd.choice([2,2,3,3,4,5]); bits.append((sx,sy,vx,vy,start,rnd.choice([0,1,2]),rnd.choice([(1,0),(1,1),(0,1),(1,-1)])))
def draw_bits(img,i):
    px=img.load()
    for sx,sy,vx,vy,start,c,(dx,dy) in bits:
        t=i-start
        if t<0 or t>4: continue
        x=sx+vx*t; y=sy+vy*t+0.45*t*t
        for k in range(3 if t<3 else 2):
            X=int(round(x+dx*k)); Y=int(round(y+dy*k))
            if 0<=X<56 and 0<=Y<56 and px[X,Y][3]==0: px[X,Y]=HAY[min(2,c+(1 if k==2 else 0))]+(255,)
for idx,f in enumerate(frames[:7]): draw_bits(f,idx+1)
# a few bits resting on the ground in the last frames
for f in frames[6:]:
    px=f.load()
    for X,Y,c in [(12,47,1),(13,47,0),(41,46,1),(42,46,2),(44,47,0),(45,47,1)]: px[X,Y]=HAY[c]+(255,)
sheet=Image.new("RGBA",(8*56,56))
for i,f in enumerate(frames): sheet.paste(f,(i*56,0)); f.save(f"{K}/reveal_{i+1}.png")
sheet.save(f"{K}/hangkradueng_reveal_shake_south.png")
# timing: 1 hold, shake fast, end hold
DUR=[300,90,90,90,90,90,120,500]
G=4; gif=[]
for i,f in enumerate(frames):
    can=Image.new("RGBA",(56*G,56*G),(186,222,160,255)); can.alpha_composite(f.resize((56*G,56*G),Image.NEAREST),(0,0)); gif.append(can.convert("RGB"))
gif[0].save(f"{K}/hangkradueng_reveal_shake.gif",save_all=True,append_images=gif[1:],duration=DUR,loop=0)
Z=4;c=56*Z;font=ImageFont.load_default(size=20)
out=Image.new("RGBA",(4*(c+8)+8,2*(c+30)+8),(250,244,236,255)); d=ImageDraw.Draw(out)
for k,f in enumerate(frames):
    x=8+(k%4)*(c+8); y=8+(k//4)*(c+30)
    d.rectangle([x,y+24,x+c-1,y+24+c-1],fill=(255,251,245,255),outline=(225,210,195,255))
    out.alpha_composite(f.resize((c,c),Image.NEAREST),(x,y+24)); d.text((x+4,y+2),f"frame {k+1}  {DUR[k]} ms",fill=(110,70,60,255),font=font)
out.save(f"{K}/hangkradueng_reveal_frames.png"); print("ok")
