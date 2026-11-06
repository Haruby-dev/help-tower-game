import sys
from PIL import Image, ImageDraw, ImageFont
S=sys.argv[1]
W=(255,255,255,255); K=(0x36,0x0c,0x2d,255)
def plus(im,cx,cy,clear):
    px=im.load()
    for p in clear: px[p]=K
    for p in [(cx,cy-1),(cx-1,cy),(cx,cy),(cx+1,cy),(cx,cy+1)]: px[p]=W
    return im
E0=Image.open(f"{S}/out/rot_E.png").convert("RGBA"); W0=Image.open(f"{S}/out/rot_W.png").convert("RGBA")
E1=plus(E0.copy(),25,19,[(26,18)])
W1=plus(W0.copy(),12,19,[(11,18)])
E1.save(f"{S}/out/rot_E_star.png"); W1.save(f"{S}/out/rot_W_star.png")
Sx=Image.open(f"{S}/out/rot_S.png"); N=Image.open(f"{S}/out/rot_N.png")
font=ImageFont.load_default(size=22); fb=ImageFont.load_default(size=26)
cell=200; pad=14
rows=[("AI as made",[Sx,E0,N,W0]),("star eyes on sides (S, N unchanged)",[Sx,E1,N,W1])]
Wd=4*cell+5*pad; H=2*(cell+50)+40+260
out=Image.new("RGBA",(Wd,H),(250,244,236,255)); d=ImageDraw.Draw(out)
y=8
for title,ims in rows:
    d.text((pad,y),title,fill=(110,70,60,255),font=fb); y+=36
    for i,im in enumerate(ims):
        x=pad+i*(cell+pad)
        d.rectangle([x-2,y-2,x+cell+1,y+cell+1],fill=(255,251,245,255),outline=(225,210,195,255))
        out.alpha_composite(im.resize((cell,cell),Image.NEAREST),(x,y))
        d.text((x+6,y+4),["S","E","N","W"][i],fill=(150,120,110,255),font=font)
    y+=cell+14
# game-size strip
gy=y+6; d.rectangle([0,gy,Wd,H],fill=(186,222,160,255))
pl=Image.open(f"{S}/out/pl.png"); pu=Image.open(f"{S}/out/pu.png")
G=3; items=[pl,pu,Sx,E1,N,W1]; gap=14
stripw=sum(im.size[0]*G for im in items)+gap*(len(items)-1)
x=(Wd-stripw)//2; feet=gy+20+64*G-6
for im in items:
    big=im.resize((im.size[0]*G,im.size[1]*G),Image.NEAREST)
    out.alpha_composite(big,(x,feet-im.getbbox()[3]*G)); x+=big.size[0]+gap
out.save(f"{S}/out/hangkradueng_4dir_1106.png"); print(out.size)
