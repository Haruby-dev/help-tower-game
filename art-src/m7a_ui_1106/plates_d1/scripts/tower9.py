from PIL import Image, ImageDraw, ImageFont
import os, sys, json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from tower6 import tower, plate, D
from tower2 import pu
V={'D1 เทาฟ้า':plate((132,142,176))}
# E3: plum outline + pink inner rim line
from tower2 import grid
V['F1 เทาฟ้า + ขอบชมพูด้านใน']=grid(["..bbbbbbbbb..",".bpWWWWWWWpb.","bpWWWWWWWWWpb","bsWWWWWWWWWsb",".bsssssssssb.","..bbbbbbbbb.."],{'b':(132,142,176),'p':(246,184,206),'W':(255,255,255),'s':(214,222,236)})
V['F2 ฟ้าพาสเทล (ฟ้าขึ้น เทาน้อยลง)']=plate((120,150,200),(206,224,244),(255,255,255))
V['F3 ฟ้ามิ้นต์']=plate((110,160,170),(206,232,232),(255,255,255))
keys=['strawberry_skewer','home_kaprao','caramel_pudding','choco_donut','honey_macaron','basil_tea','grilled_fish','strawberry_parfait']
F=ImageFont.truetype('/mnt/user-data/uploads/help-tower-game/public/assets/fonts/Mali-Bold.ttf',20)
K=3; blocks=[]
for lab,pl in V.items():
    pl.save(f'{D}/tower_plate_{lab[:2]}.png')
    sc=Image.new('RGBA',(len(keys)*26+50,64),(214,170,110,255))
    sc.alpha_composite(pu,(2,22))
    for n,k in enumerate(keys):
        f=Image.open(f'{D}/tang_flat4.png') if k=='strawberry_skewer' else Image.open(f'{D}/mini9_final/{k}.png')
        t=tower(pl,f,3); t=t.crop(t.getbbox()); sc.alpha_composite(t,(50+n*26+13-t.width//2,60-t.height))
    big=sc.resize((sc.width*K,sc.height*K),Image.NEAREST)
    b=Image.new('RGBA',(big.width,big.height+34),(255,238,244,255)); ImageDraw.Draw(b).text((8,4),lab,font=F,fill=(92,48,76)); b.alpha_composite(big,(0,32)); blocks.append(b)
out=Image.new('RGB',(blocks[0].width,sum(b.height for b in blocks)),(255,238,244)); y=0
for b in blocks: out.paste(b,(0,y),b); y+=b.height
out.save(f'{D}/tower_blue_variants.png')
