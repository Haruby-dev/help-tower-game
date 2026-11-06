from PIL import Image, ImageDraw, ImageFont
import numpy as np
U='/mnt/user-data/uploads/help-tower-game/'
sc=np.array(Image.open(U+'art-src/phone_ui_1106/mock_src/scene_nohud.png').convert('RGB')).astype(int)
best=None
for ox in range(4):
  for oy in range(4):
    a=sc[oy:oy+1200, ox:ox+1200]
    h=a.shape[0]//4*4; w=a.shape[1]//4*4; a=a[:h,:w]
    b=a.reshape(h//4,4,w//4,4,3)
    v=((b-b[:,:1,:,:1])**2).sum()
    if best is None or v<best[0]: best=(v,ox,oy)
print('phase',best)
_,ox,oy=best
nat=Image.fromarray(sc[oy::4, ox::4].astype('uint8'))
print(nat.size)
bg=nat.crop((40,140,296,322)).convert('RGBA')   # dirt yard area, native px
def cell(p,c,row=0): return Image.open(U+p).convert('RGBA').crop((0,row*c,c,row*c+c))
def tight(im):
    bb=im.getbbox(); return im.crop(bb)
girl=Image.open(U+'public/assets/characters/player_girl_stand.png').convert('RGBA').crop((0,0,64,64))
spr={
 'ตัวเอก':girl,
 'ปุยนุ่น':cell('art-src/puinun_1105/final/puinun_sweet_stand.png',40),
 'ป๊อปคอร์น':cell('public/assets/monsters/popcorn/popcorn_sweet_stand.png',40),
 'มุกมิก':cell('public/assets/monsters/mookmik/mookmik_sweet_stand.png',40),
 'ตุ้มเตี้ย':cell('art-src/tumtia_1106/final/tumtia_sweet_stand_4dir.png',48),
 'หางกระดิ่ง':cell('art-src/hangkradueng_1106/final/hangkradueng_a_full_stand_4dir.png',56),
 'ยายใบไม้':cell('art-src/yaibaimai_1106/final/yai_sweet_stand_4dir.png',48),
 'ข1':Image.open('cand_4.png'),
 'ก1':Image.open('cand_1.png'),
}
rows=[(100,['ปุยนุ่น','ป๊อปคอร์น','มุกมิก','ตุ้มเตี้ย','หางกระดิ่ง','ยายใบไม้']),
      (172,['ตัวเอก','ข1','ก1'])]
G=4
out=bg.resize((bg.width*G,bg.height*G),Image.NEAREST)
labels=[]
for feet,names in rows:
    ts=[tight(spr[n]) for n in names]
    total=sum(t.width for t in ts); gap=(bg.width-total)//(len(ts)+1)
    x=gap
    for n,t in zip(names,ts):
        out.alpha_composite(t.resize((t.width*G,t.height*G),Image.NEAREST),(x*G,(feet-t.height)*G))
        labels.append((n,(x+t.width/2)*G,feet*G+4,n in('ข1','ก1')))
        x+=t.width+gap
F='/usr/share/fonts/opentype/tlwg/Loma-Bold.otf'
d=ImageDraw.Draw(out); f=ImageFont.truetype(F,26)
for n,cx,y,hl in labels:
    tw=d.textlength(n,font=f)
    d.rounded_rectangle([cx-tw/2-8,y,cx+tw/2+8,y+34],8,fill=(255,236,244,235) if hl else (255,255,255,210))
    d.text((cx,y+4),n,font=f,fill=(110,40,80) if hl else (60,60,60),anchor='mt')
out.save('wingwing_compare_scene_1106.png'); print(out.size)
