import sys
from PIL import Image, ImageDraw, ImageFont
S=sys.argv[1]
FUR=(0xe6,0xd1,0x9a,255)
PAL={"O":"#308b93","L":"#aaf1a1","D":"#48b292"}
C3=[".O.O.","OLOLO",".ODO.","OLOLO",".O.O."]
def is_green(p): return p[3] and "%02x%02x%02x"%p[:3] in ("308b93","aaf1a1","48b292","6ec896")
def fix(src,box,cx,cy):
    im=src.copy(); px=im.load(); x0,y0,x1,y1=box
    n=0
    for y in range(y0,y1+1):
        for x in range(x0,x1+1):
            if is_green(px[x,y]): px[x,y]=FUR; n+=1
    for j,r in enumerate(C3):
        for i,ch in enumerate(r):
            if ch!=".":
                h=PAL[ch]; px[cx-2+i,cy-2+j]=(int(h[1:3],16),int(h[3:5],16),int(h[5:7],16),255)
    return im,n
E,ne=fix(Image.open(f"{S}/out/rot_E_star.png").convert("RGBA"),(26,7,32,13),26,12)
W,nw=fix(Image.open(f"{S}/out/rot_W_star.png").convert("RGBA"),(7,7,12,13),11,12)
print("erased",ne,nw)
E.save(f"{S}/out/hk_E_final.png"); W.save(f"{S}/out/hk_W_final.png")
Sx=Image.open(f"{S}/out/rot_S.png"); N=Image.open(f"{S}/out/rot_N.png")
E0=Image.open(f"{S}/out/rot_E_star.png"); W0=Image.open(f"{S}/out/rot_W_star.png")
font=ImageFont.load_default(size=22); fb=ImageFont.load_default(size=26)
cell=200; pad=14
rows=[("before (clover on top of head)",[Sx,E0,N,W0]),("after (clover moved to forehead, C3 pattern)",[Sx,E,N,W])]
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
gy=y+6; d.rectangle([0,gy,Wd,H],fill=(186,222,160,255))
pl=Image.open(f"{S}/out/pl.png"); pu=Image.open(f"{S}/out/pu.png")
G=3; items=[pl,pu,Sx,E,N,W]; gap=14
stripw=sum(im.size[0]*G for im in items)+gap*(len(items)-1)
x=(Wd-stripw)//2; feet=gy+20+64*G-6
for im in items:
    big=im.resize((im.size[0]*G,im.size[1]*G),Image.NEAREST)
    out.alpha_composite(big,(x,feet-im.getbbox()[3]*G)); x+=big.size[0]+gap
out.save(f"{S}/out/hangkradueng_4dir_clover_1106.png")
