from PIL import Image, ImageDraw, ImageFont
import os, sys, json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from tower6 import tower, V, D
M=json.load(open(f'{D}/src/art-src/_icons_map_1106.json'))
keys=list(M)
F=ImageFont.truetype('/mnt/user-data/uploads/help-tower-game/public/assets/fonts/Mali-Bold.ttf',20)
K=3
for vi,(lab,pl) in enumerate(V.items()):
    cols=16; rows=2
    sc=Image.new('RGBA',(cols*28,rows*52),(214,170,110,255))
    for n,k in enumerate(keys):
        f=Image.open(f'{D}/mini9_final/{k}.png'); t=tower(pl,f,3)
        t=t.crop(t.getbbox()); x=(n%cols)*28+14-t.width//2; y=(n//cols)*52+50-t.height
        sc.alpha_composite(t,(x,y))
    big=sc.resize((sc.width*K,sc.height*K),Image.NEAREST)
    out=Image.new('RGBA',(big.width,big.height+40),(255,238,244,255)); d=ImageDraw.Draw(out)
    d.text((8,6),f'{lab} · ทุกเมนู ซ้อน 3 จาน',font=F,fill=(92,48,76)); out.alpha_composite(big,(0,36))
    out.convert('RGB').save(f'{D}/tower_all_{lab[:2]}.png')
