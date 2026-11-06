import sys
from PIL import Image, ImageDraw, ImageFont
R='../../'
def south(f):
    im=Image.open(R+f).convert('RGBA'); h=im.height; return im.crop((0,0,h,h))
pg=Image.open(R+'public/assets/characters/player_girl_stand.png').convert('RGBA')
items=[]
# player south frame: guess layout
w,h=pg.size
items.append(('ตัวเอก',pg.crop((0,0,w,w))))
for name,f in [('ปุยนุ่น','public/assets/monsters/puinun/puinun_sweet_stand.png'),('ป๊อปคอร์น','public/assets/monsters/popcorn/popcorn_sweet_stand.png'),('มุกมิก','art-src/outline_fix_1106/mukmik/mookmik_sweet_stand.png'),('ตุ้มเตี้ย','art-src/outline_fix_1106/tumtia/tumtia_sweet_stand_4dir.png'),('หางกระดิ่ง','art-src/hangkradueng_1106/final/hangkradueng_a_full_stand_4dir.png'),('ยายใบไม้','art-src/yaibaimai_1106/final/yai_sweet_stand_4dir.png'),('วิ้งวิ้ง','art-src/wingwing_1106/final/wingwing_sweet_stand_4dir.png'),('ตุ๊บป่อง','art-src/tubpong_1106/final/tubpong_sweet_stand_4dir.png')]:
    items.append((name,south(f)))
items.append(('ข้าวสาลีทอง',Image.open(R+'public/assets/food/ingredients/golden_wheat.png').convert('RGBA')))
S=4
crops=[(n,im.crop(im.getbbox())) for n,im in items]
gap=10; W=sum(c.width for _,c in crops)+gap*(len(crops)+1)+12; H=max(c.height for _,c in crops)
base=Image.new('RGBA',(W*S,(H+28)*S),(170,205,120,255))
x=gap
for n,c in crops:
    big=c.resize((c.width*S,c.height*S),Image.NEAREST)
    base.alpha_composite(big,(x*S,(H-c.height+4)*S))
    x+=c.width+gap
d=ImageDraw.Draw(base); f=ImageFont.truetype(R+'public/assets/fonts/Mali-Bold.ttf',30)
x=gap
for n,c in crops:
    cx=(x+c.width/2)*S; tw=d.textlength(n,font=f)
    d.text((cx-tw/2,(H+8)*S),n,fill=(74,7,62),font=f)
    x+=c.width+gap
base.convert('RGB').save(sys.argv[1])
print(base.size,[ (n,c.size) for n,c in crops])
