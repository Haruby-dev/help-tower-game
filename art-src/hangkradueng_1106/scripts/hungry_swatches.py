import sys, colorsys
from PIL import Image, ImageDraw, ImageFont
S=sys.argv[1]; H=S+"/hungry"
FUR=["e6d19a","e4cc94","dba975","d29775","cf8f73","e0bb81"]
CREAM=["fdf4de","faedc7","f9e6cf"]
CLOVER={"308b93":"8a6a45","48b292":"a8844f","aaf1a1":"d2b47a"}           # wilted, dried brown
EYE_BOX=(9,15,29,22)                                                       # eye area on the south sprite
EYE={"0f0321":"4a0a16","360c2d":"7a1626","471634":"9c2234","925468":"d0606a"}  # red eyes, white star kept
def hx(h): return tuple(int(h[i:i+2],16) for i in (0,2,4))
def tohex(t): return "%02x%02x%02x"%t
VARIANTS={
 "H1 pale straw":  dict(s=0.45,v=1.03,dh=0),
 "H2 grey beige":  dict(s=0.22,v=0.98,dh=0),
 "H3 dry hay":     dict(s=0.75,v=0.88,dh=0.03),
 "H4 oatmeal":     dict(s=0.30,v=0.93,dh=-0.01),
 "H5 lilac grey":  dict(s=0.25,v=0.95,dh=None,hue=0.78),
}
def fur_map(p):
    out={}
    for h in FUR:
        r,g,b=[c/255 for c in hx(h)]; hh,ss,vv=colorsys.rgb_to_hsv(r,g,b)
        nh=p["hue"] if p.get("dh") is None else (hh+p["dh"])%1
        r2,g2,b2=colorsys.hsv_to_rgb(nh,ss*p["s"],min(1,vv*p["v"]))
        out[h]=tohex((round(r2*255),round(g2*255),round(b2*255)))
    return out
def apply(im,m,eye=True,clover=True):
    im=im.copy(); px=im.load(); w,h=im.size
    for y in range(h):
        for x in range(w):
            p=px[x,y]
            if not p[3]: continue
            k=tohex(p[:3])
            if k in m: px[x,y]=hx(m[k])+(255,)
            elif clover and k in CLOVER: px[x,y]=hx(CLOVER[k])+(255,)
            elif eye and k in EYE and EYE_BOX[0]<=x<=EYE_BOX[2] and EYE_BOX[1]<=y<=EYE_BOX[3]: px[x,y]=hx(EYE[k])+(255,)
    return im
if __name__=="__main__":
    st=Image.open(f"{S}/out/rot_S.png").convert("RGBA")
    items=[("sweet (now)",st)]+[(n,apply(st,fur_map(p))) for n,p in VARIANTS.items()]
    for n,im in items[1:]: im.save(f"{H}/swatch_{n.split()[0]}.png")
    cell=200; pad=14; font=ImageFont.load_default(size=20)
    out=Image.new("RGBA",(6*(cell+pad)+pad,cell+56+190),(250,244,236,255)); d=ImageDraw.Draw(out)
    for i,(n,im) in enumerate(items):
        x=pad+i*(cell+pad)
        d.text((x+4,8),n,fill=(110,70,60,255),font=font)
        d.rectangle([x-2,38,x+cell+1,38+cell+1],fill=(255,251,245,255),outline=(225,210,195,255))
        out.alpha_composite(im.resize((cell,cell),Image.NEAREST),(x,40))
        # swatch strip of the fur ramp
        cols=FUR if i==0 else [fur_map(VARIANTS[n])[h] for h in FUR]
        for j,c in enumerate(cols):
            d.rectangle([x+j*33,40+cell+10,x+j*33+30,40+cell+40],fill=hx(c))
    gy=40+cell+52; d.rectangle([0,gy,out.size[0],out.size[1]],fill=(186,222,160,255))
    x=pad+60
    for n,im in items:
        out.alpha_composite(im.resize((120,120),Image.NEAREST),(x,gy+12)); x+=cell+pad
    out.save(f"{H}/hangkradueng_hungry_swatches.png")
