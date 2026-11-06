from PIL import Image
import hungry_all as H, colorsys
st=Image.open('jtt_stand_H3_4dir.png').convert('RGBA'); wk=Image.open('jtt_sweet_walk_4dir.png').convert('RGBA')
hs=Image.open('jtt_hungry_stand_4dir.png').convert('RGBA')
wo=Image.new('RGBA',wk.size,(0,0,0,0))
CR=(0xf9,0xf0,0xc5,255); FL=(0xe6,0xdc,0xc6,255)
for r,d in enumerate('SENW'):
    sp=st.crop((r*64,0,r*64+64,64)).load()
    for i in range(6):
        f=wk.crop((i*64,r*64,i*64+64,r*64+64)); dx,dy=H.head_offset(sp,f.load())
        g=H.recolor(f,d,dx,dy); q=g.load()
        # cheeks (AI variants)
        for y in range(29+dy,38+dy):
            for x in range(64):
                c=q[x,y]
                if not c[3]: continue
                h,s,v=colorsys.rgb_to_hsv(*[a/255 for a in c[:3]]); h*=360
                if (h>=335 or h<=20) and 0.3<=s<=0.7 and v>0.8: q[x,y]=H.CHEEK+(255,)
        # leftover AI highlights
        for y in range(0,H.HEADMAX[d]+dy+1):
            for x in range(64):
                c=q[x,y]
                if c[3] and c[:3] in [(0xf6,0xf3,0xa9),(0xf8,0xf4,0x9a),(0xf6,0xf6,0xaa),(0xf5,0xe0,0x83)]:
                    cx0,cx1,cy0,cy1=H.GEO[d][1]
                    if cx0+dx<=x<=cx1+dx and cy0+dy<=y<=cy1+dy: continue
                    q[x,y]= (CR if y>H.GEO[d][0]+dy+4 else FL) if d!='E' or y>H.GEO[d][0]+dy else H.ant_map(c[:3])+(255,)
        if d=='S':
            hp=hs.load()
            for y in range(26,37):
                for x in range(19,42):
                    q[x+dx,y+dy]=hp[x,y]
        wo.paste(g,(i*64,r*64))
wo.save('jtt_hungry_walk_4dir.png')
