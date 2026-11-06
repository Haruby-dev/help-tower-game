from PIL import Image, ImageDraw, ImageFont
import colorsys
from hover import south_body_mask
PL=(0x4a,0x07,0x3e)
S=Image.open('wingwing_sweet_stand_4dir.png').crop((0,0,56,56))
mask=south_body_mask(S)
def lum(c): return (0.3*c[0]+0.59*c[1]+0.11*c[2])/255
def recol(c,tint,keep=0.15,lo=0.55,hi=0.50):
    g=lum(c); t=[min(255,round(tint[i]*(lo+hi*g))) for i in range(3)]
    return tuple(round(t[i]*(1-keep)+c[i]*keep) for i in range(3))
OPTS=[('A เทานม',(212,206,204)),('B ขาวฝ้า',(236,232,234)),('C เทาม่วงหม่น',(196,184,206)),('D เทาฟ้าหมอก',(190,202,210)),('E น้ำตาลนม',(218,202,184))]
def hungry(S,mask,tint):
    out=S.copy(); p=out.load()
    for y in range(56):
        for x in range(56):
            c=p[x,y]
            if c[3] and (x,y) not in mask and c[:3]!=PL:
                p[x,y]=recol(c[:3],tint)+(255,)
    return out
if __name__=='__main__':
    F=ImageFont.truetype('/usr/share/fonts/opentype/tlwg/Loma-Bold.otf',24)
    K=5; items=[('ปกติ',S)]+[(n,hungry(S,mask,t)) for n,t in OPTS]
    out=Image.new('RGBA',(len(items)*(56*K+16)+16,56*K+60),(246,240,232,255)); d=ImageDraw.Draw(out)
    for i,(n,im) in enumerate(items):
        x=16+i*(56*K+16); d.rectangle([x,8,x+56*K-1,8+56*K-1],fill=(236,228,220,255))
        out.alpha_composite(im.resize((56*K,56*K),Image.NEAREST),(x,8)); d.text((x+56*K//2,16+56*K),n,font=F,fill=(90,40,80),anchor='mt')
        im.save(f'hsw_{i}.png')
    out.save('wingwing_hungry_swatch_1106.png'); print(out.size)
