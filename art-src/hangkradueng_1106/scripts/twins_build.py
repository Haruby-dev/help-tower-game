"""Build hangkradueng twin sets: A = straw (H1), B = lilac (H5), hungry = shared warm grey (G2).
Red eyes in every state (her pick). Clover green when full, wilted brown when hungry.
Neutral file names (a/b) so the twin secret does not leak from public/ file names."""
import sys, colorsys
from PIL import Image, ImageDraw, ImageFont
S=sys.argv[1]; O=S+"/twins"
def hx(h): return tuple(int(h[i:i+2],16) for i in (0,2,4))
def tohex(t): return "%02x%02x%02x"%t
FUR=set("e6d19a e4cc94 dba975 d29775 cf8f73 e0bb81 f3daac f1e0b1 f4dfb1 ceb280 e7bc9a e5c8b0 c88358 d79c61 d49555 e3a256".split())
GOLD=set("eaaf42 f8cc4a ffe148".split())
EYE={"0f0321":"4a0a16","360c2d":"7a1626","471634":"9c2234","925468":"d0606a","8e5e80":"c04858","a090ef":"f29aa6"}
STATES={"a_full":dict(s=0.45,v=1.03),"b_full":dict(s=0.25,v=0.95,hue=0.78),"hungry":dict(s=0.12,v=0.92)}
def fur(h,p):
    r,g,b=[c/255 for c in hx(h)]; hh,ss,vv=colorsys.rgb_to_hsv(r,g,b)
    nh=p.get("hue",hh); r2,g2,b2=colorsys.hsv_to_rgb(nh,ss*p["s"],min(1,vv*p["v"]))
    return (round(r2*255),round(g2*255),round(b2*255),255)
def wilt(p):
    r,g,b=[c/255 for c in p[:3]]; _,_,v=colorsys.rgb_to_hsv(r,g,b)
    return hx("8a6a45")+(255,) if v<0.62 else (hx("a8844f")+(255,) if v<0.8 else hx("d2b47a")+(255,))
def greenish(p):
    r,g,b=[c/255 for c in p[:3]]; hh,s,v=colorsys.rgb_to_hsv(r,g,b); return 0.25<hh<0.52 and s>0.2
# eye boxes and clover boxes in 40x40 stand coordinates, per direction
EYES={"s":[(10,16,15,22),(23,16,28,22)],"e":[(23,15,27,21)],"w":[(10,15,14,21)],"n":[]}
CLOV={"s":(16,8,22,14),"e":(23,9,29,15),"w":(8,9,14,15),"n":None}
OFFS={"s":{0:(8,8),1:(8,7),2:(7,7),3:(8,8),4:(8,8),5:(8,6),6:(8,6)},
      "e":{0:(8,8),1:(8,8),2:(9,9),3:(9,9),4:(9,8),5:(9,8),6:(9,9)},
      "w":{0:(8,8),1:(7,8),2:(6,8),3:(7,8),4:(8,8),5:(7,8),6:(6,8)},
      "n":{i:(8,8) for i in range(7)}}
def inbox(x,y,b,o): return b and b[0]+o[0]<=x<=b[2]+o[0] and b[1]+o[1]<=y<=b[3]+o[1]
def recolor(im,d,off,state):
    p=STATES[state]; im=im.convert("RGBA").copy(); px=im.load(); w,h=im.size
    gold=[(x,y) for y in range(h) for x in range(w) if px[x,y][3] and tohex(px[x,y][:3]) in GOLD]
    src=im.copy().load()
    for y in range(h):
        for x in range(w):
            q=src[x,y]
            if not q[3]: continue
            k=tohex(q[:3])
            if any(inbox(x,y,b,off) for b in EYES[d]) and k in EYE: px[x,y]=hx(EYE[k])+(255,); continue
            if state=="hungry" and CLOV[d] and inbox(x,y,(CLOV[d][0]-1,CLOV[d][1]-1,CLOV[d][2]+1,CLOV[d][3]+1),off) and greenish(q):
                px[x,y]=wilt(q); continue
            if k in FUR and not any(abs(x-gx)<=2 and abs(y-gy)<=2 for gx,gy in gold): px[x,y]=fur(k,p)
    return im
STAND={"s":f"{S}/out/rot_S.png","e":f"{S}/out/hk_E_final.png","n":f"{S}/out/rot_N.png","w":f"{S}/out/hk_W_final.png"}
ORDER="senw"
res={}
for st in STATES:
    sheet=Image.new("RGBA",(160,40)); walk=Image.new("RGBA",(6*56,4*56))
    for j,d in enumerate(ORDER):
        im=recolor(Image.open(STAND[d]),d,(0,0),st); sheet.paste(im,(j*40,0)); res[(st,d,"stand")]=im
        for i in range(1,7):
            f=recolor(Image.open(f"{S}/walk/{d}_fix_{i}.png"),d,OFFS[d][i],st); walk.paste(f,((i-1)*56,j*56)); res[(st,d,i)]=f
    sheet.save(f"{O}/hangkradueng_{st}_stand_4dir.png"); walk.save(f"{O}/hangkradueng_{st}_walk_4dir.png")
# preview: stand grid 3 states x 4 dirs + in-game strip
cell=150; pad=10; font=ImageFont.load_default(size=20)
labels={"a_full":"twin A full (straw)","b_full":"twin B full (lilac)","hungry":"hungry (both)"}
Wd=max(170+4*(cell+pad),20+64*3+40*3*6+8*7); out=Image.new("RGBA",(Wd,3*(cell+pad)+20+190),(250,244,236,255)); d_=ImageDraw.Draw(out)
for r,st in enumerate(STATES):
    y=10+r*(cell+pad); d_.text((8,y+cell//2-10),labels[st],fill=(110,70,60,255),font=font)
    for j,d in enumerate(ORDER):
        x=170+j*(cell+pad); d_.rectangle([x-1,y-1,x+cell,y+cell],fill=(255,251,245,255),outline=(225,210,195,255))
        out.alpha_composite(res[(st,d,"stand")].resize((cell,cell),Image.NEAREST),(x,y))
gy=10+3*(cell+pad)+6; d_.rectangle([0,gy,Wd,out.size[1]],fill=(186,222,160,255))
pl=Image.open(f"{S}/out/pl.png"); pu=Image.open(f"{S}/out/pu.png")
x=20
for im in [pl,pu,res[("a_full","s","stand")],res[("b_full","s","stand")],res[("hungry","s","stand")],res[("a_full","e","stand")],res[("b_full","w","stand")]]:
    big=im.resize((im.size[0]*3,im.size[1]*3),Image.NEAREST); out.alpha_composite(big,(x,gy+180-im.getbbox()[3]*3)); x+=big.size[0]+8
out.save(f"{O}/hangkradueng_twins_set.png")
# GIF: 3 rows x 4 dirs walking, 2x, 110 ms
G=2; frames=[]
for i in range(1,7):
    can=Image.new("RGBA",(4*56*G+50,3*56*G+40),(186,222,160,255))
    for r,st in enumerate(STATES):
        for j,d in enumerate(ORDER):
            can.alpha_composite(res[(st,d,i)].resize((56*G,56*G),Image.NEAREST),(10+j*(56*G+10),10+r*(56*G+10)))
    frames.append(can.convert("RGB"))
frames[0].save(f"{O}/hangkradueng_twins_walk.gif",save_all=True,append_images=frames[1:],duration=110,loop=0)
print("ok")
