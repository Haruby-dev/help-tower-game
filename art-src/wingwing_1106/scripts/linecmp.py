from PIL import Image, ImageDraw, ImageFont
U='/mnt/user-data/uploads/help-tower-game/'
def cell(p,c): return Image.open(U+p).convert('RGBA').crop((0,0,c,c))
items=[('ปุยนุ่น',cell('art-src/puinun_1105/final/puinun_sweet_stand.png',40)),
('มุกมิก',cell('public/assets/monsters/mookmik/mookmik_sweet_stand.png',40)),
('หางกระดิ่ง',cell('art-src/hangkradueng_1106/final/hangkradueng_a_full_stand_4dir.png',56)),
('ยายใบไม้',cell('art-src/yaibaimai_1106/final/yai_sweet_stand_4dir.png',48)),
('ก1 เดิม',Image.open('cand_1.png').convert('RGBA')),
('A เส้นพลัม',Image.open('k1_v1_plum.png')),
('B เส้นตามสี',Image.open('k1_v2_selout.png')),('C เส้นในจาง',Image.open('k1_v3_soft.png'))]
S=6; F='/usr/share/fonts/opentype/tlwg/Loma-Bold.otf'; f=ImageFont.truetype(F,26)
ts=[(n,i.crop(i.getbbox())) for n,i in items]
W=sum(t.width*S+24 for _,t in ts)+24; H=max(t.height for _,t in ts)*S+80
out=Image.new('RGBA',(W,H),(246,240,232,255)); d=ImageDraw.Draw(out)
x=24; base=max(t.height for _,t in ts)*S+16
for i,(n,t) in enumerate(ts):
    if i==4: d.line([x-12,10,x-12,H-10],fill=(200,180,190),width=3)
    out.alpha_composite(t.resize((t.width*S,t.height*S),Image.NEAREST),(x,base-t.height*S))
    d.text((x+t.width*S/2,base+12),n,font=f,fill=(90,40,80),anchor='mt'); x+=t.width*S+24
out.save('wingwing_outline_compare_1106.png'); print(out.size)
