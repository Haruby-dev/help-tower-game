import sys
from PIL import Image, ImageDraw, ImageFont
R='../../'
F=ImageFont.truetype(R+'public/assets/fonts/Mali-Bold.ttf',28)
def south(f):
    im=Image.open(R+f).convert('RGBA'); h=im.height; return im.crop((0,0,h,h))
cands=[(n,Image.open(f).convert('RGBA')) for n,f in [('A','jtt_A_dc6785cf.png'),('B','jtt_B_3c2794d1.png'),('C','jtt_C_1041e36f.png')]]
pg=Image.open(R+'public/assets/characters/player_girl_stand.png').convert('RGBA'); pg=pg.crop((0,0,pg.width,pg.width))
gang=[('ตัวเอก',pg),('มุกมิก',south('art-src/outline_fix_1106/mukmik/mookmik_sweet_stand.png')),('วิ้งวิ้ง',south('art-src/wingwing_1106/final/wingwing_sweet_stand_4dir.png')),('ตุ๊บป่อง',south('art-src/tubpong_1106/final/tubpong_sweet_stand_4dir.png'))]
# top: zoom 6x
Z=6; pad=24
top=Image.new('RGBA',(3*64*Z+4*pad,64*Z+60),(236,230,244,255)); d=ImageDraw.Draw(top)
for i,(n,c) in enumerate(cands):
    x=pad+i*(64*Z+pad); top.alpha_composite(c.resize((64*Z,64*Z),Image.NEAREST),(x,10))
    d.text((x+64*Z/2-8,64*Z+14),n,fill=(74,7,62),font=F)
# bottom: in-game 3x on grass, bottom-aligned
S=3; items=gang+[(n,c) for n,c in cands]
crops=[(n,c.crop(c.getbbox())) for n,c in items]
H=max(c.height for _,c in crops); gap=10
W=sum(c.width for _,c in crops)+gap*(len(crops)+1)
bot=Image.new('RGBA',(W*S,(H+20)*S),(170,205,120,255)); d2=ImageDraw.Draw(bot)
x=gap
for n,c in crops:
    bot.alpha_composite(c.resize((c.width*S,c.height*S),Image.NEAREST),(x*S,(H-c.height+3)*S))
    tw=d2.textlength(n,font=F); d2.text(((x+c.width/2)*S-tw/2,(H+5)*S),n,fill=(74,7,62),font=F)
    x+=c.width+gap
Wt=max(top.width,bot.width)
out=Image.new('RGBA',(Wt,top.height+bot.height+20),(236,230,244,255))
out.alpha_composite(top,((Wt-top.width)//2,0)); out.alpha_composite(bot,((Wt-bot.width)//2,top.height+20))
out.convert('RGB').save(sys.argv[1]); print(out.size)
