from PIL import Image, ImageDraw, ImageFont
import os
from drafts import EA, EB, EC, PLUM, CREAM
from m16 import mini16, D
S=D+'/src/'; A=S+'public/assets/'
F=ImageFont.truetype('/mnt/user-data/uploads/help-tower-game/public/assets/fonts/Mali-Bold.ttf',22)
def cloud(w,h):
    """cloud bubble: union of circles, plum outline"""
    m=Image.new('L',(w,h)); d=ImageDraw.Draw(m)
    d.rounded_rectangle((1,3,w-2,h-2),radius=6,fill=255)
    for cx in range(5,w-4,6): d.ellipse((cx-4,0,cx+4,8),fill=255)
    for cx in range(5,w-4,7): d.ellipse((cx-4,h-8,cx+4,h-1),fill=255)
    im=Image.new('RGBA',(w,h)); px=im.load(); mp=m.load()
    for y in range(h):
        for x in range(w):
            if mp[x,y]:
                edge=any(not(0<=x+dx<w and 0<=y+dy<h) or not mp[x+dx,y+dy] for dx,dy in((1,0),(-1,0),(0,1),(0,-1)))
                px[x,y]=(PLUM if edge else CREAM)+(255,)
    return im
def bubble(icon):
    iw,ih=icon.size; w,h=iw+8,ih+8
    b=cloud(w,h); out=Image.new('RGBA',(w,h+7)); out.alpha_composite(b,(0,0))
    d=ImageDraw.Draw(out)
    d.ellipse((4,h-1,8,h+3),fill=CREAM+(255,),outline=PLUM+(255,)); d.rectangle((2,h+4,3,h+5),fill=PLUM+(255,))
    out.alpha_composite(icon,((w-iw)//2,(h-ih)//2)); return out
if __name__=='__main__':
    pu=Image.open(S+'art-src/puinun_1105/final/puinun_hungry_stand.png').convert('RGBA').crop((0,0,40,40))
    grass=(150,200,120); K=5
    out=Image.new('RGBA',(1560,900),(255,238,244,255)); d=ImageDraw.Draw(out)
    d.text((20,8),'1) หน้างอน 3 แบบ (ลอยเหนือหัว ขนาดเท่าหัวใจที่มีอยู่)',font=F,fill=PLUM)
    for i,(lab,e) in enumerate([('A เส้นเลือดงอน',EA),('B เมฆฝนจิ๋ว',EB),('C พ่นลมฮึ่ม',EC)]):
        sc=Image.new('RGBA',(52,48),grass+(255,)); sc.alpha_composite(pu,(6,6))
        sc.alpha_composite(e,(30,14) if lab[0]=='C' else (26-e.width//2+4,1))
        out.alpha_composite(sc.resize((52*K,48*K),Image.NEAREST),(20+i*290,44)); d.text((30+i*290,290),lab,font=F,fill=PLUM)
    d.text((900,8),'2) ปุ่มวางอาหาร',font=F,fill=PLUM)
    frame=Image.open(A+'ui/hud_v2/action_button_frame.png').convert('RGBA')
    tray=Image.open(A+'ui/shop/items/tray_6.png').convert('RGBA'); tray=tray.crop(tray.getbbox())
    ic=Image.new('RGBA',(30,30)); ic.alpha_composite(tray,(0,30-tray.height))
    dish=mini16('home_kaprao'); ic.alpha_composite(dish,((30-dish.width)//2,0))
    fr=frame.copy(); fr.alpha_composite(ic,((48-30)//2,(48-30)//2+1))
    cook=Image.open(A+'ui/hud_v2/icon_cook.png').convert('RGBA'); fc=frame.copy(); fc.alpha_composite(cook,((48-cook.width)//2,(48-cook.height)//2))
    out.alpha_composite(fr.resize((48*5,48*5),Image.NEAREST),(900,44)); out.alpha_composite(fc.resize((48*3,48*3),Image.NEAREST),(1170,92))
    d.text((1170,250),'(ปุ่มทำอาหารเดิม)',font=F,fill=PLUM)
    d.text((20,350),'3) ฟองความคิด: อยากกินเมนูนี้ (ไอคอน 16px ย่อจากไอคอนกระเป๋า)',font=F,fill=PLUM)
    for i,k in enumerate(['home_kaprao','strawberry_skewer','caramel_pudding','warm_honey_milk']):
        b=bubble(mini16(k)); sc=Image.new('RGBA',(56,74),grass+(255,)); sc.alpha_composite(pu,(2,34)); sc.alpha_composite(b,(20,4))
        out.alpha_composite(sc.resize((56*K,74*K),Image.NEAREST),(20+i*300,390))
    out.convert('RGB').save(D+'/draft_m7a_1.png')
    # tray mock with auto 9px
    import json
    from mini9 import M
    t6=Image.open(A+'world/yard/food_tray_6.png').convert('RGBA')
    sheet=Image.new('RGBA',(4*70,2*48),(150,200,120,255))
    centers=[(13,6),(30,6),(46,6),(13,18),(30,18),(46,18)]
    groups=[['grilled_fish','boiled_egg','home_kaprao','tomato_soup','fish_congee','strawberry_skewer'],['honey_pancake','strawberry_milk_pudding','caramel_pudding','soda_jelly_dessert','honey_macaron','choco_parfait'],
            ['grilled_corn','scallion_omelet','corn_egg_fried_rice','potato_carrot_stew','warm_honey_milk','basil_tea'],['cream_puff','choco_donut','swiss_roll','berry_pudding','soda_ice_cream','whip_cream_mumu']]
    for gi,g in enumerate(groups):
        sc=Image.new('RGBA',(66,44)); sc.alpha_composite(t6,(3,4))
        for (cx,cy),k in zip(centers,g):
            m=Image.open(f'{D}/mini9/{k}.png'); sc.alpha_composite(m,(3+cx-m.width//2,4+cy+2-m.height))
        sheet.alpha_composite(sc,((gi%4)*70,0))
    sheet.crop((0,0,280,48)).resize((280*5,48*5),Image.NEAREST).save(D+'/draft_tray9_auto.png')
