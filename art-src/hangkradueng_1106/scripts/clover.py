import sys
from PIL import Image, ImageDraw, ImageFont
S=sys.argv[1]
base=Image.open(f"{S}/out/hk_F1_star.png").convert("RGBA")
PAL={"O":"#308b93","L":"#aaf1a1","M":"#76ca7d","D":"#48b292"}
SHAPES={
 "C1":[".OO.OO.",
       "OLLOLLO",
       "OLMOMLO",
       ".OODOO.",
       "OLMOMLO",
       "OLLOLLO",
       ".OO.OO."],
 "C2":[".OO.OO.",
       "OLLOLLO",
       "OLMDMLO",
       ".OODOO.",
       ".OLMLO.",
       ".OLLLO.",
       "..OOO.."],
 "C3":[".O.O.",
       "OLOLO",
       ".ODO.",
       "OLOLO",
       ".O.O."],
}
def put(im,shape,cx,top):
    px=im.load(); w=len(shape[0]); x0=cx-w//2
    for y,r in enumerate(shape):
        for x,ch in enumerate(r):
            if ch!=".":
                h=PAL[ch]; px[x0+x,top+y]=(int(h[1:3],16),int(h[3:5],16),int(h[5:7],16),255)
    return im
outs={}
outs["C1"]=put(base.copy(),SHAPES["C1"],19,8)
outs["C2"]=put(base.copy(),SHAPES["C2"],19,8)
outs["C3"]=put(base.copy(),SHAPES["C3"],19,9)
for k,im in outs.items(): im.save(f"{S}/out/hk_F1_{k}.png")
pl=Image.open(f"{S}/out/pl.png"); pu=Image.open(f"{S}/out/pu.png")
font=ImageFont.load_default(size=26)
names={"C1":"C1 4 leaves","C2":"C2 3 leaves","C3":"C3 small"}
cands=[(names[k],outs[k]) for k in ("C1","C2","C3")]
cell=280; pad=30; H1=360; G=3; Wd=960
items=[("hero",pl),("Puinun",pu),("F1",base)]+[(k,outs[k]) for k in ("C1","C2","C3")]
maxh=64*G; gap=14; stripw=sum(im.size[0]*G for _,im in items)+gap*(len(items)+1); H2=maxh+70
out=Image.new("RGBA",(Wd,H1+H2+20),(250,244,236,255)); d=ImageDraw.Draw(out)
for i,(n,im) in enumerate(cands):
    x=pad+i*(cell+pad); y=50
    d.rectangle([x-4,y-4,x+cell+3,y+cell+3],fill=(255,251,245,255),outline=(225,210,195,255),width=2)
    out.alpha_composite(im.resize((cell,cell),Image.NEAREST),(x,y))
    d.text((x+cell//2-len(n)*7,8),n,fill=(110,70,60,255),font=font)
gy=H1+20; d.rectangle([0,gy,Wd,gy+H2],fill=(186,222,160,255)); feet=gy+40+maxh-6
x=gap+(Wd-stripw)//2
for n,im in items:
    big=im.resize((im.size[0]*G,im.size[1]*G),Image.NEAREST)
    out.alpha_composite(big,(x,feet-im.getbbox()[3]*G))
    d.text((x+big.size[0]//2-len(n)*7,gy+6),n,fill=(70,90,60,255),font=font)
    x+=big.size[0]+gap
out.save(f"{S}/out/hangkradueng_clover_1106.png")
