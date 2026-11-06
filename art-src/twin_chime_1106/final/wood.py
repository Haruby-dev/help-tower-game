from PIL import Image, ImageDraw, ImageFont
import sys
src=Image.open('pl_B.png').convert('RGBA')
ORIG=[(0x86,0x44,0x3e),(0x9d,0x5d,0x40),(0xb1,0x70,0x4b)]  # dark mid light
def h(s): return tuple(int(s[i:i+2],16) for i in (0,2,4))
RAMPS={
 'ก':('เดิม',['86443e','9d5d40','b1704b']),
 'ข':('น้ำตาลนวล',['9c6a4a','b9855c','d4a273']),
 'ค':('น้ำผึ้ง (เหมือนโต๊ะ)',['b07a45','d29a5c','eebd7e']),
 'ง':('ไม้ครีม',['ad9480','cbb39c','e6d4bf']),
 'จ':('ไม้อมชมพู',['ad7b78','cc9c92','e7bfae']),
}
def twig(x,y): return y<=40 or (41<=y<=43 and 13<=x<=18)
def make(ramp):
    im=src.copy(); px=im.load(); m={o:h(n) for o,n in zip(ORIG,ramp)}
    for y in range(64):
        for x in range(48):
            r,g,b,a=px[x,y]
            if a and (r,g,b) in m and twig(x,y): px[x,y]=m[(r,g,b)]+(255,)
    return im
out={k:make(v[1]) for k,v in RAMPS.items()}
for i,(k,im) in enumerate(out.items()): im.save(f'B_wood_{i+1}.png')
f=ImageFont.truetype(sys.argv[1],30)
S=6; sh=Image.new('RGBA',(5*(48*S+20)+20,64*S+80),(198,222,186,255)); d=ImageDraw.Draw(sh)
for i,(k,im) in enumerate(out.items()):
    x=20+i*(48*S+20); sh.alpha_composite(im.resize((48*S,64*S),Image.NEAREST),(x,70))
    d.text((x+10,12),f'{k}  {RAMPS[k][0]}',fill=(50,5,51,255),font=f)
sh.save('B_wood_sheet.png')
bg=Image.open('/mnt/user-data/uploads/help-tower-game/docs/previews/code/m6b_arrange_pick.png').convert('RGBA')
crop=bg.crop((980,40,2100,640)); d=ImageDraw.Draw(crop)
f2=ImageFont.truetype(sys.argv[1],34)
for (k,im),x in zip(out.items(),[300,470,640,810,970]):
    im=im.crop(im.getbbox()); im3=im.resize((im.width*3,im.height*3),Image.NEAREST)
    y=540-im3.height; crop.alpha_composite(im3,(x-im3.width//2,y))
    d.text((x-12,y-44),k,fill=(255,255,255,255),font=f2,stroke_width=3,stroke_fill=(50,5,51,255))
crop.save('mock_B_wood.png')
