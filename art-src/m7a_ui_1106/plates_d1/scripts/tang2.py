"""Tanghulu lying flat on the plate (stacks nicely in the tower). 0 credits."""
from PIL import Image, ImageDraw, ImageFont
import os, sys
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from tower2 import tower, pu, D
from tower3 import V
O=(46,28,24); R=(220,56,76); r=(168,30,58); H=(255,214,214); S=(222,176,112)
def flat(n=3, size=4):
    BALL=[".OO.","OHRO","ORrO",".OO."] if size==4 else [".OOO.","OHRRO","ORRrO","OrrrO",".OOO."]
    bw=len(BALL[0]); step=bw-1; w=step*n+1+2; h=len(BALL)
    im=Image.new('RGBA',(w,h)); px=im.load()
    my=h//2
    px[0,my]=S+(255,); px[w-1,my]=S+(255,)
    for i in range(n):
        bx=1+i*step
        for yy,row in enumerate(BALL):
            for xx,c in enumerate(row):
                if c!='.': px[bx+xx,yy]={'O':O,'H':H,'R':R,'r':r}[c]+(255,)
    return im
F1=flat(3,4); F2=flat(3,5)
F1.save(f'{D}/tang_flat4.png'); F2.save(f'{D}/tang_flat5.png')
A=Image.open(f'{D}/tang_A.png')
t6=Image.open(f'{D}/src/public/assets/world/yard/food_tray_6.png').convert('RGBA')
plate=V['A2 ขอบชัดขึ้นนิด'][0]
dirt=(214,170,110)
sc=Image.new('RGBA',(3*110,100),dirt+(255,))
for i,m in enumerate([A,F1,F2]):
    x0=i*110
    t=Image.new('RGBA',(66,44)); t.alpha_composite(t6,(3,4))
    for (cx,cy) in [(13,6),(30,6),(46,6),(13,18),(30,18),(46,18)]: t.alpha_composite(m,(3+cx-m.width//2,4+cy+2-m.height))
    sc.alpha_composite(t,(x0,52))
    sc.alpha_composite(pu,(x0+64,58)); tw=tower(plate,m,4,True); sc.alpha_composite(tw,(x0+72,58-70+8))
K=3; big=sc.resize((sc.width*K,sc.height*K),Image.NEAREST)
Fnt=ImageFont.truetype('/mnt/user-data/uploads/help-tower-game/public/assets/fonts/Mali-Bold.ttf',20)
out=Image.new('RGBA',(big.width,big.height+44),(255,238,244,255)); d=ImageDraw.Draw(out)
for i,l in enumerate(['เดิม A (เฉียง)','ใหม่ วางนอน ลูกเล็ก','ใหม่ วางนอน ลูกใหญ่']): d.text((i*110*K+8,8),l,font=Fnt,fill=(92,48,76))
out.alpha_composite(big,(0,40)); out.convert('RGB').save(f'{D}/tang_flat_compare.png'); print(F1.size,F2.size)
