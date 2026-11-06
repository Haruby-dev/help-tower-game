import sys
from PIL import Image, ImageDraw, ImageFont
U='/mnt/user-data/uploads/help-tower-game/'
raw=Image.open('sheet_raw.png').convert('RGBA')
off=raw.height-56
sheet=raw.crop((0,off,336,off+56))
px=sheet.load()
for y in range(sheet.height):
    for x in range(sheet.width):
        r,g,b,a=px[x,y]
        if (r,g,b)==(31,37,44): px[x,y]=(0,0,0,0)
cands=[sheet.crop((i*56,0,i*56+56,56)) for i in range(6)]
for i,c in enumerate(cands): c.save(f'cand_{i+1}.png'); print(i+1,c.getbbox())
labels=['ก1','ก2','ก3','ข1','ข2','ข3']
FP='/usr/share/fonts/opentype/tlwg/Loma-Bold.otf'
font=ImageFont.truetype(FP,28)
S=6
# top: candidates at 6x on light background
W=6*56*S+7*16; topH=56*S+60
# bottom: in-game strip at 3x on grass
def south(p,cell):
    im=Image.open(U+p).convert('RGBA'); return im.crop((0,0,cell,cell))
girl=Image.open(U+'public/assets/characters/player_girl_stand.png').convert('RGBA').crop((0,0,64,64))
refs=[('ตัวเอก',girl),('ปุยนุ่น',south('art-src/puinun_1105/final/puinun_sweet_stand.png',40)),
      ('ยายใบไม้',south('art-src/yaibaimai_1106/final/yai_sweet_stand_4dir.png',48)),
      ('หางกระดิ่ง',south('art-src/hangkradueng_1106/final/hangkradueng_a_full_stand_4dir.png',56))]
items=refs+list(zip(labels,cands))
G=3
def bottom(im):
    bb=im.getbbox(); return bb[3]
stripH=72*G+50
out=Image.new('RGBA',(W,topH+stripH),(250,244,236,255))
d=ImageDraw.Draw(out)
for i,c in enumerate(cands):
    x=16+i*(56*S+16)
    d.rectangle([x,8,x+56*S-1,8+56*S-1],fill=(238,230,222,255))
    out.alpha_composite(c.resize((56*S,56*S),Image.NEAREST),(x,8))
    d.text((x+56*S//2,8+56*S+6),labels[i],font=font,fill=(90,50,80,255),anchor='mt')
# grass strip
y0=topH
d.rectangle([0,y0,W,y0+stripH],fill=(170,205,140,255))
ground=y0+70*G
x=24
for name,im in items:
    bb=im.getbbox()
    big=im.resize((im.width*G,im.height*G),Image.NEAREST)
    out.alpha_composite(big,(x,ground-bb[3]*G))
    d.text((x+im.width*G//2,ground+8),name,font=ImageFont.truetype(FP,22),fill=(50,70,40,255),anchor='mt')
    x+=im.width*G+18
out.save('preview_wingwing_pixen_1106.png'); print(out.size)
