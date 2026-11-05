from PIL import Image, ImageDraw, ImageFont
import json, os
from mini9 import reduce, M
D=os.path.dirname(os.path.abspath(__file__)); S=D+'/src/'
PLUM=(92,48,76); CREAM=(255,250,244)
def grid(rows, pal):
    h=len(rows); w=max(len(r) for r in rows); im=Image.new('RGBA',(w,h))
    for y,r in enumerate(rows):
        for x,c in enumerate(r):
            if c in pal: im.putpixel((x,y),pal[c]+(255,))
    return im
# --- sulk emotes
EA=grid(["..P.P..",".PpPpP.","PP...PP",".......","PP...PP",".PpPpP.","..P.P.."],{'P':(232,84,120),'p':(250,150,175)})
EA=grid([".P...P.","PPp.pPP",".p...p.",".......",".p...p.","PPp.pPP",".P...P."],{'P':(232,84,120),'p':(250,160,185)})
EB=grid(["..OOO.OO.",".OLLLOLLO","OLLLLLLLO","OLLLLLLLO",".OOOOOOO.","...z.z...","..z.z...."],{'O':(120,104,140),'L':(206,198,222),'z':(150,130,200)})
EC=grid([".OO....","OWWO.OO","OWWOOWWO",".OO.OWWO","....OOO."],{'O':(150,150,170),'W':(255,255,255)})
# --- 16px minis for the thought bubble
def mini16(k): return reduce(Image.open(S+M[k]).convert('RGBA'),16,14)
def bubble(icon):
    iw,ih=icon.size; w,h=max(iw+8,22),max(ih+7,19)
    im=Image.new('RGBA',(w,h+7)); d=ImageDraw.Draw(im)
    d.rounded_rectangle((0,0,w-1,h-1),radius=7,fill=CREAM+(255,),outline=PLUM+(255,))
    # scallop bumps on top
    for bx in range(4,w-4,6):
        d.ellipse((bx-3,-2,bx+3,4),fill=CREAM+(255,),outline=PLUM+(255,))
    d.rectangle((1,1,w-2,4),fill=CREAM+(255,))
    d.rounded_rectangle((0,1,w-1,h-1),radius=7,outline=PLUM+(255,))
    for bx in range(4,w-4,6): d.arc((bx-3,-2,bx+3,4),180,360,fill=PLUM+(255,))
    # trail dots toward lower-left (head)
    d.ellipse((5,h,9,h+4),fill=CREAM+(255,),outline=PLUM+(255,)); d.ellipse((2,h+4,4,h+6),fill=CREAM+(255,),outline=PLUM+(255,))
    im.alpha_composite(icon,((w-iw)//2,(h-ih)//2+1))
    return im
if __name__=='__main__':
    F=ImageFont.truetype(S+'../../stars/../../../../../../mnt/user-data/uploads/help-tower-game/public/assets/fonts/Mali-Bold.ttf',22) if False else ImageFont.truetype('/mnt/user-data/uploads/help-tower-game/public/assets/fonts/Mali-Bold.ttf',22)
    pu=Image.open(S+'art-src/puinun_1105/final/puinun_hungry_stand.png').convert('RGBA').crop((0,0,40,40))
    grass=(150,200,120)
    K=5
    out=Image.new('RGBA',(1500,820),(255,238,244,255)); d=ImageDraw.Draw(out)
    d.text((20,8),'หน้างอน 3 แบบ (ลอยเหนือหัว)',font=F,fill=PLUM)
    for i,(lab,e) in enumerate([('A เส้นเลือดงอน',EA),('B เมฆฝนจิ๋ว',EB),('C พ่นลมฮึ่ม',EC)]):
        sc=Image.new('RGBA',(52,48),grass+(255,)); sc.alpha_composite(pu,(6,6))
        if lab[0]=='C': sc.alpha_composite(e,(30,14))
        else: sc.alpha_composite(e,(26-e.width//2+4,1))
        out.alpha_composite(sc.resize((52*K,48*K),Image.NEAREST),(20+i*290,44)); d.text((20+i*290,290),lab,font=F,fill=PLUM)
    # thought bubble
    d.text((20,350),'ฟองความคิด: อยากกินเมนูนี้ (ไอคอนอาหาร 16px ย่อจากภาพจริง)',font=F,fill=PLUM)
    for i,k in enumerate(['home_kaprao','strawberry_skewer','caramel_pudding']):
        b=bubble(mini16(k)); sc=Image.new('RGBA',(60,76),grass+(255,)); sc.alpha_composite(pu,(4,34)); sc.alpha_composite(b,(22,2))
        out.alpha_composite(sc.resize((60*K,76*K),Image.NEAREST),(20+i*320,390))
    out.convert('RGB').save(D+'/draft_emote_bubble.png')
