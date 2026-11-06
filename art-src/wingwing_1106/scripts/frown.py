from PIL import Image, ImageDraw, ImageFont
H=Image.open('wingwing_hungry_stand_4dir.png')
S=H.crop((0,0,56,56))
SKIN=(0xf8,0xf5,0xe1); M=(0x63,0x10,0x38)
def frown_mouth(im):
    p=im.load()
    for xy in [(24,30),(28,30),(25,31),(26,31),(27,31)]: p[xy]=SKIN+(255,)
    for xy in [(25,30),(26,30),(27,30),(24,31),(28,31)]: p[xy]=M+(255,)
def brows(im):
    p=im.load()
    for xy in [(19,24),(20,24),(21,25),(22,25),(30,25),(31,25),(32,24),(33,24)]: p[xy]=M+(255,)
def halflid(im):
    p=im.load()
    for x in range(19,23): p[x,26]=M+(255,)
    for x in range(30,34): p[x,26]=M+(255,)
def var(fns):
    im=S.copy()
    for f in fns: f(im)
    return im
V=[('เดิม (ยิ้ม)',S),('A ปากคว่ำ',var([frown_mouth])),('B ปากคว่ำ + คิ้วขมวด',var([frown_mouth,brows])),('C ปากคว่ำ + ตาปรือ',var([frown_mouth,halflid]))]
if __name__=='__main__':
    F=ImageFont.truetype('/usr/share/fonts/opentype/tlwg/Loma-Bold.otf',24)
    K=8; cw=36*K
    out=Image.new('RGBA',(len(V)*(cw+16)+16,24*K+60),(246,240,232,255)); d=ImageDraw.Draw(out)
    for i,(n,im) in enumerate(V):
        x=16+i*(cw+16); crop=im.crop((10,12,46,36))
        bg=Image.new('RGBA',crop.size,(236,228,220,255)); bg.alpha_composite(crop)
        out.alpha_composite(bg.resize((cw,24*K),Image.NEAREST),(x,8)); d.text((x+cw//2,16+24*K),n,font=F,fill=(90,40,80),anchor='mt')
        im.save(f'frown_{i}.png')
    out.save('wingwing_frown_1106.png')
    # small full-size row at 4x
    row=Image.new('RGBA',(4*(56*4+12)+12,56*4+16),(236,228,220,255))
    for i,(n,im) in enumerate(V): row.alpha_composite(im.resize((224,224),Image.NEAREST),(12+i*236,8))
    row.save('frown_full.png')
