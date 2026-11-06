import sys
from PIL import Image, ImageDraw, ImageFont
S=sys.argv[1]; W_=S+"/walk"
st=Image.open(f"{S}/out/rot_S.png").convert("RGBA"); sp=st.load()
def diff(f,dx,dy,box):
    fp=f.load(); x0,y0,x1,y1=box; s=0
    for y in range(y0,y1+1):
        for x in range(x0,x1+1):
            a=sp[x,y]; b=fp[x+dx,y+dy]; s+=sum(abs(a[j]-b[j]) for j in range(4))
    return s
FACE=(9,15,30,25)   # x9..29, y15..24
face=st.crop(FACE)
for i in range(7):
    f=Image.open(f"{W_}/s2_{i}.png").convert("RGBA")
    if i>0:
        s,dx,dy=min(((diff(f,dx,dy,(12,4,26,14)),dx,dy) for dx in range(4,13) for dy in range(3,13)))
        print(i,"head offset",dx,dy,s)
        f.paste(face,(FACE[0]+dx,FACE[1]+dy))
    f.save(f"{W_}/s2_fix_{i}.png")
Z=5;c=56*Z;font=ImageFont.load_default(size=22)
out=Image.new("RGBA",(3*c+40,2*(c+34)+10),(250,244,236,255)); d=ImageDraw.Draw(out)
for k,i in enumerate(range(1,7)):
    f=Image.open(f"{W_}/s2_fix_{i}.png")
    x=10+(k%3)*(c+10); y=10+(k//3)*(c+34)
    d.rectangle([x,y+28,x+c-1,y+28+c-1],fill=(255,251,245,255),outline=(225,210,195,255))
    d.line([x,y+28+46*Z,x+c-1,y+28+46*Z],fill=(255,150,150,255))
    out.alpha_composite(f.resize((c,c),Image.NEAREST),(x,y+28))
    d.text((x+4,y+2),f"frame {i}",fill=(110,70,60,255),font=font)
out.save(f"{W_}/contact_s2_fix.png")
# override: frames 5 and 6 — the head is 1-2 px higher than the head-top tracker found; use the eye tracker offset (8,6)
for i,(dx,dy) in {5:(8,6),6:(8,6)}.items():
    f=Image.open(f"{W_}/s2_{i}.png").convert("RGBA")
    f.paste(face,(FACE[0]+dx,FACE[1]+dy)); f.save(f"{W_}/s2_fix_{i}.png")
big=Image.new("RGBA",(4*200+30,200),(255,255,255,255))
for j,(n) in enumerate(["s2_5","s2_fix_5","s2_6","s2_fix_6"]):
    big.alpha_composite(Image.open(f"{W_}/{n}.png").crop((14,10,44,40)).resize((200,200),Image.NEAREST),(j*210,0))
big.save(f"{W_}/zoom_s2_56.png")
