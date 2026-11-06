from PIL import Image, ImageDraw, ImageFont
from hungry_part import make, hsv_adj, mix, hx, FUR, SKIN, GREEN, YEL, FACE
from hungry_sw import S, mask, PL
def crown_px():
    p=S.load(); out=[]
    for y in range(12,22):
        for x in range(56):
            c=p[x,y]
            if c[3] and (x,y) in mask and c[:3]!=PL:
                k=hx(c[:3])
                if k not in FUR|SKIN|GREEN|YEL|FACE|PINKS: out.append((x,y))
    return out
PINKS={'#f179b2','#fa9cc7','#e8458e','#fbd8e1','#fdbed8','#eb4d6f'}
CROWN=crown_px()
def green(target, wing_mix=0.5):
    base=make((238,234,238))          # option ก for body
    p=base.load(); o=S.load()
    for y in range(56):
        for x in range(56):
            c=o[x,y]
            if not c[3] or c[:3]==PL: continue
            if (x,y) not in mask:
                p[x,y]=mix(hsv_adj(c[:3],sat=0.3),target,wing_mix)+(255,)
    dark=tuple(round(v*0.80) for v in target)
    for x,y in CROWN:
        c=o[x,y]; L=(0.3*c[0]+0.59*c[1]+0.11*c[2])/255
        p[x,y]=mix(dark,target,min(1,L*1.1))+(255,)
    return base
SW=[('G1 เซจ',(196,212,188)),('G2 มอส',(178,192,160)),('G3 มิ้นต์เทา',(190,214,200)),('G4 มะกอกซีด',(206,204,168)),('G5 เขียวเทา',(168,182,166))]
if __name__=='__main__':
    print('crown px',len(CROWN))
    F=ImageFont.truetype('/usr/share/fonts/opentype/tlwg/Loma-Bold.otf',24)
    K=5; items=[('ปกติ',S),('ก (ก่อน)',make((238,234,238)))]+[(n,green(t)) for n,t in SW]
    out=Image.new('RGBA',(len(items)*(56*K+16)+16,56*K+110),(246,240,232,255)); d=ImageDraw.Draw(out)
    for i,(n,im) in enumerate(items):
        x=16+i*(56*K+16); d.rectangle([x,8,x+56*K-1,8+56*K-1],fill=(236,228,220,255))
        out.alpha_composite(im.resize((56*K,56*K),Image.NEAREST),(x,8)); d.text((x+56*K//2,16+56*K),n,font=F,fill=(90,40,80),anchor='mt')
        if i>=2: d.rounded_rectangle([x+56*K//2-40,56*K+52,x+56*K//2+40,56*K+92],8,fill=SW[i-2][1],outline=(120,90,110))
        im.save(f'hgreen_{i}.png')
    out.save('wingwing_hungry_green_1106.png')
