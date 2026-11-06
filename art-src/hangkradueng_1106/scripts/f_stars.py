import sys
from PIL import Image, ImageDraw, ImageFont
S=sys.argv[1]
src=Image.open(f"{S}/out/r2_F.png").convert("RGBA")
W=(255,255,255,255); K=(0x36,0x0c,0x2d,255)
def setp(im,pts,col,expect=None):
    px=im.load()
    for p in pts: px[p]=col
def star(im):
    # 3x3 plus star, mirrored on both eyes (axis x=19)
    setp(im,[(14,18),(24,18)],K)              # remove old 2x2 shine corner
    for cx in (13,25):
        setp(im,[(cx,18),(cx-1,19),(cx,19),(cx+1,19),(cx,20)],W)
    return im
F1=star(src.copy())
F2=star(src.copy()); setp(F2,[(11,21),(27,21)],W)   # + tiny lower sparkle
F1.save(f"{S}/out/hk_F1_star.png"); F2.save(f"{S}/out/hk_F2_star_dot.png")
pl=Image.open(f"{S}/out/pl.png"); pu=Image.open(f"{S}/out/pu.png")
font=ImageFont.load_default(size=26)
cands=[("F (AI)",src),("F1",F1),("F2",F2)]
cell=280; pad=30; H1=360; G=3
items=[("hero",pl),("Puinun",pu)]+cands
maxh=64*G; gap=18; stripw=sum(im.size[0]*G for _,im in items)+gap*(len(items)+1); H2=maxh+70
Wd=960
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
out.save(f"{S}/out/hangkradueng_F_stars_1106.png")
