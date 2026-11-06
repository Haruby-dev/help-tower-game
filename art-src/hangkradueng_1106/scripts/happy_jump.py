"""Happy jump for the reveal = the rejected front hop walk (6 frames, face-locked) recoloured to a_full and b_full."""
import sys, colorsys
from PIL import Image
S=sys.argv[1]; W_=S+"/walk"
def hx(h): return tuple(int(h[i:i+2],16) for i in (0,2,4))
def tohex(t): return "%02x%02x%02x"%t
FUR=set("e6d19a e4cc94 dba975 d29775 cf8f73 e0bb81 f3daac f1e0b1 f4dfb1 ceb280 e7bc9a e5c8b0 c88358 d79c61 d49555 e3a256 f0dcb2".split())
GOLD=set("eaaf42 f8cc4a ffe148".split())
EYE={"0f0321":"4a0a16","360c2d":"7a1626","471634":"9c2234","925468":"d0606a","8e5e80":"c04858","a090ef":"f29aa6"}
ST={"a_full":dict(s=0.45,v=1.03),"b_full":dict(s=0.25,v=0.95,hue=0.78)}
OFF={1:(8,9),2:(8,8),3:(9,7),4:(9,7),5:(9,8),6:(9,8)}
def fur(h,p):
    r,g,b=[c/255 for c in hx(h)]; hh,ss,vv=colorsys.rgb_to_hsv(r,g,b)
    r2,g2,b2=colorsys.hsv_to_rgb(p.get("hue",hh),ss*p["s"],min(1,vv*p["v"])); return (round(r2*255),round(g2*255),round(b2*255),255)
for st,p in ST.items():
    sheet=Image.new("RGBA",(6*56,56))
    for i in range(1,7):
        f=Image.open(f"{W_}/s1hop_fix_{i}.png").convert("RGBA"); px=f.load(); src=f.copy().load(); dx,dy=OFF[i]
        boxes=[(10+dx,16+dy,15+dx,22+dy),(23+dx,16+dy,28+dx,22+dy)]
        gold=[(x,y) for y in range(56) for x in range(56) if src[x,y][3] and tohex(src[x,y][:3]) in GOLD]
        for y in range(56):
            for x in range(56):
                q=src[x,y]
                if not q[3]: continue
                k=tohex(q[:3])
                if k in EYE and any(b[0]<=x<=b[2] and b[1]<=y<=b[3] for b in boxes): px[x,y]=hx(EYE[k])+(255,); continue
                if k in FUR and not any(abs(x-gx)<=2 and abs(y-gy)<=2 for gx,gy in gold): px[x,y]=fur(k,p)
        sheet.paste(f,((i-1)*56,0))
    sheet.save(f"{S}/run/hangkradueng_{st}_happy_jump_south.png")
a=Image.open(f"{S}/run/hangkradueng_a_full_happy_jump_south.png"); b=Image.open(f"{S}/run/hangkradueng_b_full_happy_jump_south.png")
G=3; fr=[]
for i in range(6):
    can=Image.new("RGBA",(2*56*G+30,56*G+10),(186,222,160,255))
    can.alpha_composite(a.crop((i*56,0,i*56+56,56)).resize((56*G,56*G),Image.NEAREST),(10,5))
    can.alpha_composite(b.crop((((i+3)%6)*56,0,((i+3)%6)*56+56,56)).resize((56*G,56*G),Image.NEAREST),(56*G+20,5))
    fr.append(can.convert("RGB"))
fr[0].save(f"{S}/run/hangkradueng_twins_happy_jump.gif",save_all=True,append_images=fr[1:],duration=110,loop=0)
print("ok")
