import sys; sys.path.insert(0,'/home/claude/wing')
from PIL import Image, ImageDraw, ImageFont
import colorsys
PL={(0x3e,0x07,0x2b),(0x40,0x09,0x2c)}
def hsv(c): return colorsys.rgb_to_hsv(*[v/255 for v in c])
def lum(c): return (0.3*c[0]+0.59*c[1]+0.11*c[2])/255
def ramp(c,t,lo=0.45,hi=0.75,keep=0.12):
    L=lum(c); n=[min(255,round(t[i]*(lo+hi*L))) for i in range(3)]; return tuple(round(n[i]*(1-keep)+c[i]*keep) for i in range(3))
def desat(c,s=0.5,v=1.0):
    h,sa,va=hsv(c); r,g,b=colorsys.hsv_to_rgb(h,sa*s,min(1,va*v)); return (round(r*255),round(g*255),round(b*255))
EYES={(0xe9,0xc0,0x73),(0xf2,0xdc,0xac),(0xef,0xcc,0x8e)}
def classify(c,y):
    h,s,v=hsv(c)
    if c in PL: return 'line'
    if c in EYES: return 'eye'
    if s<0.12: return 'neutral'
    if 0.17<=h<0.32 and s>0.2: return 'umb' if y<40 else 'pad'
    if 0.32<=h<0.58: return 'hood'
    if 0.65<=h<0.85 and s<0.3: return 'umb_dark' if y<40 else 'hood'
    if h>=0.9 or h<0.05: return 'pink'
    return 'warm'
UMB=(172,150,96); UMB_D=(110,88,70); PAD=(204,190,112)
def hungry(img,hood_t):
    out=img.copy(); p=out.load(); o=img.load()
    for y in range(img.height):
        for x in range(img.width):
            c=o[x,y]
            if not c[3]: continue
            k=classify(c[:3],y); rgb=c[:3]
            if k=='hood': n=ramp(rgb,hood_t)
            elif k=='umb': n=ramp(rgb,UMB)
            elif k=='umb_dark': n=ramp(rgb,UMB_D,lo=0.6,hi=0.6)
            elif k=='pad': n=ramp(rgb,PAD)
            elif k=='pink': n=desat(rgb,0.5,0.97)
            elif k=='warm': n=desat(rgb,0.7,0.97)
            elif k=='neutral': n=desat(rgb,0.8,0.98)
            else: n=rgb
            p[x,y]=n+(255,)
    return out
W_=(0xfb,0xfb,0xee,255); D=(0x3e,0x07,0x2b,255)
def frown_S(im):
    p=im.load()
    for xy in [(23,24),(22,25),(24,25),(23,26)]: p[xy]=W_
    for xy in [(23,25),(22,26),(24,26)]: p[xy]=D
def frown_E(im):
    p=im.load()
    for xy in [(34,24),(33,25),(34,25),(33,26)]: p[xy]=W_
    for xy in [(33,26),(34,25)]: p[xy]=D
HOODS=[('H1 เขียวมะกอกเทา',(150,162,128)),('H2 เซจหม่น',(162,178,150)),('H3 เทาอมฟ้า',(140,160,160)),('H4 มอสน้ำตาล',(150,148,108)),('H5 เขียวซีด',(176,188,168))]
if __name__=='__main__':
    st=Image.open('tubpong_sweet_stand_4dir.png'); S=st.crop((0,0,56,56))
    F=ImageFont.truetype('/usr/share/fonts/opentype/tlwg/Loma-Bold.otf',22); K=5
    items=[('ปกติ',S)]
    for n,t in HOODS:
        h=hungry(S,t); frown_S(h); items.append((n,h))
    out=Image.new('RGBA',(len(items)*(56*K+14)+14,56*K+110),(246,240,232,255)); d=ImageDraw.Draw(out)
    for i,(n,im) in enumerate(items):
        X=14+i*(56*K+14); d.rectangle([X,8,X+56*K-1,8+56*K-1],fill=(236,228,220,255))
        out.alpha_composite(im.resize((56*K,56*K),Image.NEAREST),(X,8)); d.text((X+56*K//2,14+56*K),n,font=F,fill=(90,40,80),anchor='mt')
        if i: d.rounded_rectangle([X+56*K//2-40,56*K+50,X+56*K//2+40,56*K+90],8,fill=HOODS[i-1][1],outline=(120,90,110))
    out.save('tubpong_hungry_swatch_1106.png')
