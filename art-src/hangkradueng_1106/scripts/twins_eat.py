"""Eat (south) for the twins: AI v3 frames 1-8 as made (150 ms loop), recoloured to a_full / b_full / hungry.
Open-eye frames (1,7,8) get red eyes inside fixed eye boxes; closed-eye frames keep the dark eyelid lines."""
import sys, colorsys
from PIL import Image, ImageDraw, ImageFont
S=sys.argv[1]; O=S+"/twins"
def hx(h): return tuple(int(h[i:i+2],16) for i in (0,2,4))
def tohex(t): return "%02x%02x%02x"%t
FUR=set("e6d19a e4cc94 dba975 d29775 cf8f73 e0bb81 f3daac f1e0b1 f4dfb1 ceb280 e7bc9a e5c8b0 c88358 d79c61 d49555 e3a256 f0dcb2".split())
GOLD=set("eaaf42 f8cc4a ffe148".split())
EYE={"0f0321":"4a0a16","360c2d":"7a1626","471634":"9c2234","925468":"d0606a","8e5e80":"c04858","a090ef":"f29aa6"}
STATES={"a_full":dict(s=0.45,v=1.03),"b_full":dict(s=0.25,v=0.95,hue=0.78),"hungry":dict(s=0.12,v=0.92)}
EYEBOX={1:[(17,26,24,33),(30,26,38,33)],7:[(17,26,24,33),(30,26,38,33)],8:[(17,24,24,32),(30,24,38,32)]}
NOT_CLOVER=set("b1d09f".split())
def fur(h,p):
    r,g,b=[c/255 for c in hx(h)]; hh,ss,vv=colorsys.rgb_to_hsv(r,g,b)
    nh=p.get("hue",hh); r2,g2,b2=colorsys.hsv_to_rgb(nh,ss*p["s"],min(1,vv*p["v"]))
    return (round(r2*255),round(g2*255),round(b2*255),255)
def wilt(q):
    r,g,b=[c/255 for c in q[:3]]; _,_,v=colorsys.rgb_to_hsv(r,g,b)
    return hx("8a6a45")+(255,) if v<0.62 else (hx("a8844f")+(255,) if v<0.8 else hx("d2b47a")+(255,))
def greenish(q):
    r,g,b=[c/255 for c in q[:3]]; hh,s,v=colorsys.rgb_to_hsv(r,g,b); return 0.25<hh<0.52 and s>0.2
def recolor(im,i,st):
    p=STATES[st]; im=im.convert("RGBA").copy(); px=im.load(); src=im.copy().load(); w,h=im.size
    gold=[(x,y) for y in range(h) for x in range(w) if src[x,y][3] and tohex(src[x,y][:3]) in GOLD]
    for y in range(h):
        for x in range(w):
            q=src[x,y]
            if not q[3]: continue
            k=tohex(q[:3])
            if k in EYE and any(b[0]<=x<=b[2] and b[1]<=y<=b[3] for b in EYEBOX.get(i,[])): px[x,y]=hx(EYE[k])+(255,); continue
            if st=="hungry" and y<=36 and greenish(q) and k not in NOT_CLOVER: px[x,y]=wilt(q); continue
            if k in FUR and not any(abs(x-gx)<=2 and abs(y-gy)<=2 for gx,gy in gold): px[x,y]=fur(k,p)
    return im
res={}
for st in STATES:
    sheet=Image.new("RGBA",(8*56,56))
    for i in range(1,9):
        f=recolor(Image.open(f"{S}/eat/e_{i}.png"),i,st); sheet.paste(f,((i-1)*56,0)); res[(st,i)]=f
    sheet.save(f"{O}/hangkradueng_{st}_eat_south.png")
G=3; frames=[]; font=ImageFont.load_default(size=18)
for i in range(1,9):
    can=Image.new("RGBA",(3*(56*G+10)+10,56*G+10),(186,222,160,255))
    for j,st in enumerate(STATES):
        can.alpha_composite(res[(st,i)].resize((56*G,56*G),Image.NEAREST),(10+j*(56*G+10),5))
    frames.append(can.convert("RGB"))
frames[0].save(f"{O}/hangkradueng_twins_eat.gif",save_all=True,append_images=frames[1:],duration=150,loop=0)
Z=4;c=56*Z;fontb=ImageFont.load_default(size=20)
out=Image.new("RGBA",(4*(c+8)+8,2*(c+30)+8),(250,244,236,255)); d=ImageDraw.Draw(out)
for k,i in enumerate(range(1,9)):
    f=res[("a_full",i)]; x=8+(k%4)*(c+8); y=8+(k//4)*(c+30)
    d.rectangle([x,y+24,x+c-1,y+24+c-1],fill=(255,251,245,255),outline=(225,210,195,255))
    d.line([x,y+24+46*Z,x+c-1,y+24+46*Z],fill=(255,150,150,255))
    out.alpha_composite(f.resize((c,c),Image.NEAREST),(x,y+24)); d.text((x+4,y+2),f"frame {i}",fill=(110,70,60,255),font=fontb)
out.save(f"{O}/hangkradueng_eat_frames.png")
print("ok")
