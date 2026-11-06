# Hungry eat frames for jaotungtong (south). Input: eat_raw_9f.png (f0 = stand, f1-f8 = AI eat), stand + hungry stand sheets.
from PIL import Image
import hungry_all as H, colorsys
CR=(0xf9,0xf0,0xc5,255); FL=(0xe6,0xdc,0xc6,255)
sh=Image.open('eat_raw_9f.png').convert('RGBA')
sp=Image.open('jtt_stand_H3_4dir.png').convert('RGBA').crop((0,0,64,64)).load()
def hungry_frame(f):
    dx,dy=H.head_offset(sp,f.load()); g=H.recolor(f,'S',dx,dy); q=g.load()
    for y in range(29+dy,38+dy):
        for x in range(64):
            c=q[x,y]
            if not c[3]: continue
            h,s,v=colorsys.rgb_to_hsv(*[a/255 for a in c[:3]]); h*=360
            if (h>=335 or h<=20) and 0.3<=s<=0.7 and v>0.8: q[x,y]=H.CHEEK+(255,)
    cx0,cx1,cy0,cy1=H.GEO['S'][1]
    for y in range(0,H.HEADMAX['S']+dy+1):
        for x in range(64):
            c=q[x,y]
            if c[3] and c[:3] in [(0xf6,0xf3,0xa9),(0xf8,0xf4,0x9a),(0xf6,0xf6,0xaa),(0xf5,0xe0,0x83)] and not (cx0+dx<=x<=cx1+dx and cy0+dy<=y<=cy1+dy):
                q[x,y]=CR if y>H.GEO['S'][0]+dy+4 else FL
    return g
out=Image.new('RGBA',(8*64,64),(0,0,0,0))
for i in range(1,9): out.paste(hungry_frame(sh.crop((i*64,0,i*64+64,64))),((i-1)*64,0))
p=out.load(); p[4*64+31,33]=CR; p[6*64+37,24]=FL; p[6*64+39,25]=FL; p[7*64+39,24]=FL   # hand cleanup of 4 leftover highlights
out.save('jtt_hungry_eat_south.png')
