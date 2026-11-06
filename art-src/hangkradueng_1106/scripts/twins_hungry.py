import sys, colorsys
from PIL import Image, ImageDraw, ImageFont
S=sys.argv[1]; H=S+"/hungry"
FUR=["e6d19a","e4cc94","dba975","d29775","cf8f73","e0bb81"]
CLOVER={"308b93":"8a6a45","48b292":"a8844f","aaf1a1":"d2b47a"}
EYE_BOX=(9,15,29,22)
EYE={"0f0321":"4a0a16","360c2d":"7a1626","471634":"9c2234","925468":"d0606a"}
def hx(h): return tuple(int(h[i:i+2],16) for i in (0,2,4))
def tohex(t): return "%02x%02x%02x"%t
def fur_map(s,v,dh=0.0,hue=None):
    out={}
    for h in FUR:
        r,g,b=[c/255 for c in hx(h)]; hh,ss,vv=colorsys.rgb_to_hsv(r,g,b)
        nh=hue if hue is not None else (hh+dh)%1
        r2,g2,b2=colorsys.hsv_to_rgb(nh,ss*s,min(1,vv*v))
        out[h]=tohex((round(r2*255),round(g2*255),round(b2*255)))
    return out
def apply(im,m,eye=False,clover=False):
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
SWEET={"H1 straw twin":dict(s=0.45,v=1.03),"H5 lilac twin":dict(s=0.25,v=0.95,hue=0.78)}
HUNGRY={
 "G1 grey beige":dict(s=0.22,v=0.98),
 "G2 warm grey":dict(s=0.12,v=0.92),
 "G3 pale grey":dict(s=0.08,v=1.0),
 "G4 ash grey":dict(s=0.10,v=0.80),
 "G5 dusty mauve":dict(s=0.14,v=0.90,hue=0.92),
}
if __name__=="__main__":
    st=Image.open(f"{S}/out/rot_S.png").convert("RGBA")
    sweet=[(n,apply(st,fur_map(**p))) for n,p in SWEET.items()]
    hung=[(n,apply(st,fur_map(**p),eye=True,clover=True)) for n,p in HUNGRY.items()]
    for n,im in hung: im.save(f"{H}/twin_hungry_{n.split()[0]}.png")
    for n,im in sweet: im.save(f"{H}/twin_sweet_{n.split()[0]}.png")
    cell=170; pad=12; font=ImageFont.load_default(size=18); fb=ImageFont.load_default(size=22)
    Wd=pad+7*(cell+pad)+20
    out=Image.new("RGBA",(Wd,cell+62+150),(250,244,236,255)); d=ImageDraw.Draw(out)
    d.text((pad,4),"full (after reveal)",fill=(110,70,60,255),font=fb)
    d.text((pad+2*(cell+pad)+20,4),"hungry (shared by both twins)",fill=(110,70,60,255),font=fb)
    allitems=sweet+hung
    for i,(n,im) in enumerate(allitems):
        x=pad+i*(cell+pad)+(20 if i>=2 else 0)
        d.text((x+2,30),n,fill=(110,70,60,255),font=font)
        d.rectangle([x-2,52,x+cell+1,52+cell+1],fill=(255,251,245,255),outline=(225,210,195,255))
        out.alpha_composite(im.resize((cell,cell),Image.NEAREST),(x,54))
    d.line([pad+2*(cell+pad)+6,30,pad+2*(cell+pad)+6,52+cell],fill=(200,180,170,255),width=2)
    gy=54+cell+14; d.rectangle([0,gy,Wd,out.size[1]],fill=(186,222,160,255))
    for i,(n,im) in enumerate(allitems):
        x=pad+i*(cell+pad)+(20 if i>=2 else 0)+25
        out.alpha_composite(im.resize((120,120),Image.NEAREST),(x,gy+12))
    out.save(f"{H}/hangkradueng_twins_hungry_swatches.png")
