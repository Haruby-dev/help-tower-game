from PIL import Image, ImageDraw, ImageFont
U='/mnt/user-data/uploads/help-tower-game/'
def cell(p,c): return Image.open(U+p).convert('RGBA').crop((0,0,c,c))
mk=cell('public/assets/monsters/mookmik/mookmik_sweet_stand.png',40)
tm=cell('art-src/tumtia_1106/final/tumtia_sweet_stand_4dir.png',48)
rows=[('ก่อนแก้',[('ปุยนุ่น',cell('art-src/puinun_1105/final/puinun_sweet_stand.png',40)),('ป๊อปคอร์น',cell('public/assets/monsters/popcorn/popcorn_sweet_stand.png',40)),('มุกมิก',mk),('ตุ้มเตี้ย',tm),('หางกระดิ่ง',cell('art-src/hangkradueng_1106/final/hangkradueng_a_full_stand_4dir.png',56)),('ยายใบไม้',cell('art-src/yaibaimai_1106/final/yai_sweet_stand_4dir.png',48)),('วิ้งวิ้ง ก1',Image.open('cand_1.png').convert('RGBA'))]),
      ('หลังแก้',[('ปุยนุ่น',cell('art-src/puinun_1105/final/puinun_sweet_stand.png',40)),('ป๊อปคอร์น',cell('public/assets/monsters/popcorn/popcorn_sweet_stand.png',40)),('มุกมิก (แก้)',Image.open('mukmik_plum.png')),('ตุ้มเตี้ย (แก้)',Image.open('tumtia_plum.png')),('หางกระดิ่ง',cell('art-src/hangkradueng_1106/final/hangkradueng_a_full_stand_4dir.png',56)),('ยายใบไม้',cell('art-src/yaibaimai_1106/final/yai_sweet_stand_4dir.png',48)),('วิ้งวิ้ง A (แก้)',Image.open('k1_v1_plum.png'))])]
S=5; F='/usr/share/fonts/opentype/tlwg/Loma-Bold.otf'; f=ImageFont.truetype(F,24); fb=ImageFont.truetype(F,30)
mh=56*S
W=150+sum(56*S+20 for _ in range(7)); H=2*(mh+70)+10
out=Image.new('RGBA',(W,H),(246,240,232,255)); d=ImageDraw.Draw(out)
for r,(title,items) in enumerate(rows):
    y0=r*(mh+70)+10; base=y0+mh
    d.text((20,y0+mh//2),title,font=fb,fill=(90,40,80),anchor='lm')
    x=150
    for n,im in items:
        t=im.crop(im.getbbox())
        cx=x+56*S//2
        out.alpha_composite(t.resize((t.width*S,t.height*S),Image.NEAREST),(cx-t.width*S//2,base-t.height*S))
        d.text((cx,base+10),n,font=f,fill=(140,40,90) if '(แก้)' in n else (90,70,80),anchor='mt')
        x+=56*S+20
out.save('gang_outline_plum_1106.png'); print(out.size)
