"""Twin A (older, straw) teasing visit: giggle (south, reuse shake frames 2-4 with ^^ eyes, x2) then run away.
Run = AI v3 east (group a8eb91ef, 6 frames loop), side face locked to the stand face, west = mirror. All a_full colours, red eyes."""
import sys, colorsys
from PIL import Image, ImageOps, ImageDraw, ImageFont
S=sys.argv[1]; R=S+"/run"; K=S+"/shake"
def hx(h): return tuple(int(h[i:i+2],16) for i in (0,2,4))
def tohex(t): return "%02x%02x%02x"%t
FUR=set("e6d19a e4cc94 dba975 d29775 cf8f73 e0bb81 f3daac f1e0b1 f4dfb1 ceb280 e7bc9a e5c8b0 c88358 d79c61 d49555 e3a256 f0dcb2".split())
GOLD=set("eaaf42 f8cc4a ffe148".split())
EYE={"0f0321":"4a0a16","360c2d":"7a1626","471634":"9c2234","925468":"d0606a","8e5e80":"c04858","a090ef":"f29aa6"}
A=dict(s=0.45,v=1.03)
def fur(h):
    r,g,b=[c/255 for c in hx(h)]; hh,ss,vv=colorsys.rgb_to_hsv(r,g,b)
    r2,g2,b2=colorsys.hsv_to_rgb(hh,ss*A["s"],min(1,vv*A["v"])); return (round(r2*255),round(g2*255),round(b2*255),255)
def recolor(f,eyeboxes):
    f=f.copy(); px=f.load(); src=f.copy().load()
    gold=[(x,y) for y in range(56) for x in range(56) if src[x,y][3] and tohex(src[x,y][:3]) in GOLD]
    for y in range(56):
        for x in range(56):
            q=src[x,y]
            if not q[3]: continue
            k=tohex(q[:3])
            if k in EYE and any(b[0]<=x<=b[2] and b[1]<=y<=b[3] for b in eyeboxes): px[x,y]=hx(EYE[k])+(255,); continue
            if k in FUR and not any(abs(x-gx)<=2 and abs(y-gy)<=2 for gx,gy in gold): px[x,y]=fur(k)
    return f
E=Image.open(f"{S}/out/hk_E_final.png").convert("RGBA"); ep=E.load()
def diff(f,dx,dy,box):
    fp=f.load(); x0,y0,x1,y1=box; s=0
    for y in range(y0,y1+1):
        for x in range(x0,x1+1):
            a=ep[x,y]; b=fp[x+dx,y+dy]; s+=sum(abs(a[j]-b[j]) for j in range(4))
    return s
FACE=(22,15,31,25)
run=[]
for i in range(1,7):
    f=Image.open(f"{R}/r_{i}.png").convert("RGBA")
    s,dx,dy=min(((diff(f,dx,dy,(16,3,33,14)),dx,dy) for dx in range(4,13) for dy in range(4,13)))
    f.paste(E.crop(FACE),(FACE[0]+dx,FACE[1]+dy))
    run.append(recolor(f,[(23+dx,15+dy,27+dx,21+dy)]))
giggle=[recolor(Image.open(f"{K}/k_{i}.png").convert("RGBA"),[]) for i in (2,3,4)]
sheet=Image.new("RGBA",(6*56,3*56))
for i,f in enumerate(giggle): sheet.paste(f,(i*56,0))
for i,f in enumerate(run): sheet.paste(f,(i*56,56)); sheet.paste(ImageOps.mirror(f),(i*56,112))
sheet.save(f"{R}/hangkradueng_a_full_tease_giggle_run.png")
# mock: giggle x2 in front, then run off to the right across the grass
W_,H_=520,200; G=3; frames=[]; dur=[]
for rep in range(2):
    for f in giggle:
        can=Image.new("RGBA",(W_,H_),(186,222,160,255)); can.alpha_composite(f.resize((56*G,56*G),Image.NEAREST),(170,10)); frames.append(can.convert("RGB")); dur.append(120)
x=170
for step in range(12):
    f=run[step%6]; can=Image.new("RGBA",(W_,H_),(186,222,160,255))
    can.alpha_composite(f.resize((56*G,56*G),Image.NEAREST),(x,10)); frames.append(can.convert("RGB")); dur.append(90); x+=26
frames.append(Image.new("RGB",(W_,H_),(186,222,160))); dur.append(600)
frames[0].save(f"{R}/hangkradueng_tease_mock.gif",save_all=True,append_images=frames[1:],duration=dur,loop=0)
Z=4;c=56*Z;font=ImageFont.load_default(size=20)
out=Image.new("RGBA",(6*(c+8)+8,2*(c+30)+8),(250,244,236,255)); d=ImageDraw.Draw(out)
for k,f in enumerate(giggle+run):
    x=8+(k%6)*(c+8) if k>=3 else 8+k*(c+8); y=8 if k<3 else 8+(c+30)
    if k>=3: x=8+(k-3)*(c+8)
    d.rectangle([x,y+24,x+c-1,y+24+c-1],fill=(255,251,245,255),outline=(225,210,195,255))
    out.alpha_composite(f.resize((c,c),Image.NEAREST),(x,y+24)); d.text((x+4,y+2),(f"giggle {k+1}" if k<3 else f"run {k-2}"),fill=(110,70,60,255),font=font)
out.save(f"{R}/hangkradueng_tease_frames.png"); print("ok")
