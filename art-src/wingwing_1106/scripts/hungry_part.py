from PIL import Image, ImageDraw, ImageFont
import colorsys
from hungry_sw import S, mask, PL
FUR={'#fdf9de','#f3dcc9'}
SKIN={'#e4b4ba','#dfa2b6'}
GREEN={'#46ae76','#a9e96d','#55c43b'}
YEL={'#f6cf8a','#fef29b','#e9a279','#d07057'}
FACE={'#130830','#631038','#fdffff'}
def hx(c): return '#%02x%02x%02x'%c
def hsv_adj(c,sat=1.0,val=1.0,hue_to=None,hue_w=0.0):
    h,s,v=colorsys.rgb_to_hsv(*[x/255 for x in c])
    if hue_to is not None: h=h*(1-hue_w)+hue_to*hue_w
    r,g,b=colorsys.hsv_to_rgb(h,min(1,s*sat),min(1,v*val)); return (round(r*255),round(g*255),round(b*255))
def mix(a,b,t): return tuple(round(a[i]*(1-t)+b[i]*t) for i in range(3))
def make(milk, wing_mix=0.45, petal_sat=0.45, petal_val=0.93):
    out=S.copy(); p=out.load()
    for y in range(56):
        for x in range(56):
            c=p[x,y]
            if not c[3] or c[:3]==PL: continue
            k=hx(c[:3]); rgb=c[:3]
            if (x,y) not in mask:      # wings: cloudy glass, faint tint kept
                n=mix(hsv_adj(rgb,sat=0.35),milk,wing_mix)
            elif k in FACE: n=rgb
            elif k in FUR: n=hsv_adj(rgb,sat=0.75,val=0.98)
            elif k in SKIN: n=hsv_adj(rgb,sat=0.55,val=0.97)
            elif k in GREEN: n=hsv_adj(rgb,sat=0.45,val=0.85,hue_to=0.14,hue_w=0.5)
            elif k in YEL: n=hsv_adj(rgb,sat=0.5,val=0.95)
            else: n=hsv_adj(rgb,sat=petal_sat,val=petal_val)   # petals, flowers, lilac lines
            p[x,y]=n+(255,)
    return out
OPTS=[('ก ปีกฝ้านม',(238,234,238)),('ข ปีกฝ้าม่วง',(226,218,236)),('ค ปีกฝ้าเทา',(218,216,218))]
if __name__=='__main__':
    F=ImageFont.truetype('/usr/share/fonts/opentype/tlwg/Loma-Bold.otf',24)
    K=5; items=[('ปกติ',S)]+[(n,make(m)) for n,m in OPTS]+[('(รอบที่แล้ว C)',Image.open('hsw_3.png'))]
    import hungry_full; items[-1]=('รอบที่แล้ว C',hungry_full.hungry_full(S,mask,(196,184,206)))
    out=Image.new('RGBA',(len(items)*(56*K+16)+16,56*K+60),(246,240,232,255)); d=ImageDraw.Draw(out)
    for i,(n,im) in enumerate(items):
        x=16+i*(56*K+16); d.rectangle([x,8,x+56*K-1,8+56*K-1],fill=(236,228,220,255))
        out.alpha_composite(im.resize((56*K,56*K),Image.NEAREST),(x,8)); d.text((x+56*K//2,16+56*K),n,font=F,fill=(90,40,80),anchor='mt')
        im.save(f'hpart_{i}.png')
    out.save('wingwing_hungry_part_1106.png')
