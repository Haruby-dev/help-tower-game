from PIL import Image, ImageDraw, ImageFont
import os, json, shutil
D=os.path.dirname(os.path.abspath(__file__)); A=D+'/src/public/assets/'
M=json.load(open(f'{D}/src/art-src/_icons_map_1106.json'))
os.makedirs(f'{D}/mini9_final',exist_ok=True)
for k in M:
    src=f'{D}/mini9_hand/{k}.png' if os.path.exists(f'{D}/mini9_hand/{k}.png') else f'{D}/mini9/{k}.png'
    shutil.copy(src,f'{D}/mini9_final/{k}.png')
t6=Image.open(A+'world/yard/food_tray_6.png').convert('RGBA')
centers=[(13,6),(30,6),(46,6),(13,18),(30,18),(46,18)]
keys=list(M)
rows=(len(keys)+5)//6
sheet=Image.new('RGBA',(3*68,((rows+2)//3)*46),(150,200,120,255))
for gi in range(rows):
    g=keys[gi*6:gi*6+6]; sc=Image.new('RGBA',(66,44)); sc.alpha_composite(t6,(3,4))
    for (cx,cy),k in zip(centers,g):
        m=Image.open(f'{D}/mini9_final/{k}.png'); sc.alpha_composite(m,(3+cx-m.width//2,4+cy+2-m.height))
    sheet.alpha_composite(sc,((gi%3)*68,(gi//3)*46))
sheet.resize((sheet.width*5,sheet.height*5),Image.NEAREST).save(f'{D}/tray9_final.png')
# tower above head mock
pu=Image.open(D+'/src/art-src/puinun_1105/final/puinun_sweet_stand.png').convert('RGBA').crop((0,0,40,40))
sc=Image.new('RGBA',(150,80),(150,200,120,255))
plate=Image.new('RGBA',(11,4)); dp=ImageDraw.Draw(plate); dp.rectangle((1,0,9,0),fill=(92,48,76)); dp.rectangle((0,1,0,2),fill=(92,48,76)); dp.rectangle((10,1,10,2),fill=(92,48,76)); dp.rectangle((1,3,9,3),fill=(92,48,76)); dp.rectangle((1,1,9,2),fill=(255,246,240))
for j,tower in enumerate([['home_kaprao']*3,['strawberry_skewer']*4,['caramel_pudding']*5]):
    x0=5+j*50; sc.alpha_composite(pu,(x0,38)); y=40
    for k in tower:
        sc.alpha_composite(plate,(x0+15,y-4)); m=Image.open(f'{D}/mini9_final/{k}.png'); sc.alpha_composite(m,(x0+20-m.width//2,y-3-m.height)); y-=m.height+2
sc.resize((150*5,80*5),Image.NEAREST).save(f'{D}/tower9_mock.png')
