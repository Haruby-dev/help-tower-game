"""Plates like her Kairosoft ref: wide round plate seen at an angle, food sits inside the rim. 0 credits."""
from PIL import Image, ImageDraw, ImageFont
import os, sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from tower2 import grid, pu, D
SHAPE=["...bbbbbbb...",".bbWWWWWWWbb.","bWWWWWWWWWWWb",".bssWWWWWssb.","..bbsssssbb..","....bbbbb...."]
SHAPE=["..bbbbbbbbb..",".bWWWWWWWWWb.","bWWWWWWWWWWWb","bsWWWWWWWWWsb",".bsssssssssb.","..bbbbbbbbb.."]
def plate(edge, shade=(214,222,236), top=(255,255,255)):
    return grid(SHAPE,{'b':edge,'W':top,'s':shade})
def tower(pl, food, n, sway=False, sink=3):
    W,H=26,90; im=Image.new('RGBA',(W,H)); y=H
    for i in range(n):
        dx=(0,1,0,-1)[i%4] if sway else 0; cx=W//2+dx
        im.alpha_composite(pl,(cx-pl.width//2,y-pl.height))
        base=y-pl.height+sink+1          # food bottom rests inside the rim
        im.alpha_composite(food,(cx-food.width//2,base-food.height))
        y=min(base-food.height+2, y-pl.height+1)   # next plate sits on the food top
    return im
V={'D1 แบบในรูป (ขอบเทาฟ้า)':plate((132,142,176)),
   'D2 ทรงเดียวกัน ขอบน้ำตาลเข้ม':plate((96,58,40),(236,214,196),(255,250,244)),
   'D3 ขอบน้ำตาลกลาง':plate((140,92,60),(236,214,196),(255,250,244))}
foods=[Image.open(f'{D}/tang_flat4.png'),Image.open(f'{D}/mini9_final/home_kaprao.png'),Image.open(f'{D}/mini9_final/caramel_pudding.png')]
sc=Image.new('RGBA',(len(V)*150,112),(214,170,110,255))
for i,(lab,pl) in enumerate(V.items()):
    pl.save(f'{D}/tower_plate_{lab[:2]}.png')
    for j,f in enumerate(foods):
        x0=i*150+j*48; sc.alpha_composite(pu,(x0+3,70)); t=tower(pl,f,4); sc.alpha_composite(t,(x0+10,70-90+8))
K=3; big=sc.resize((sc.width*K,sc.height*K),Image.NEAREST)
F=ImageFont.truetype('/mnt/user-data/uploads/help-tower-game/public/assets/fonts/Mali-Bold.ttf',20)
out=Image.new('RGBA',(big.width,big.height+110),(255,238,244,255)); d=ImageDraw.Draw(out)
for i,l in enumerate(V): d.text((i*150*K+8,8),l,font=F,fill=(92,48,76))
out.alpha_composite(big,(0,40))
for i,(l,pl) in enumerate(V.items()): out.alpha_composite(pl.resize((pl.width*8,pl.height*8),Image.NEAREST),(i*150*K+150,big.height+50))
out.convert('RGB').save(f'{D}/tower_ref_plates.png')
