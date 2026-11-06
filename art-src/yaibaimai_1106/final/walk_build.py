from PIL import Image, ImageDraw, ImageFont
raw=Image.open('walk_raw_64.png')
stand=Image.open('yai_sweet_stand_4dir.png')
cells=[[None]*6 for _ in range(4)]
for r in range(4):
    for c in range(6):
        fr=raw.crop((c*64,r*64,c*64+64,r*64+64)); dy=53-fr.getbbox()[3]
        al=Image.new('RGBA',(64,64)); al.alpha_composite(fr,(0,dy))
        cells[r][c]=al.crop((8,8,56,56))
sheet=Image.new('RGBA',(288,192))
for r in range(4):
    for c in range(6): sheet.alpha_composite(cells[r][c],(c*48,r*48))
sheet.save('yai_sweet_walk_4dir.png')
# contact sheet: stand + 6 frames per row, numbered
F=ImageFont.truetype('/usr/share/fonts/opentype/tlwg/Loma-Bold.otf',24)
S=5; G=(198,222,186,255); names=['หน้า','ขวา','หลัง','ซ้าย']
cs=Image.new('RGBA',(110+7*(48*S+10),4*(48*S+10)+50),G); d=ImageDraw.Draw(cs)
for c in range(7): d.text((110+c*(48*S+10)+48*S//2-20,10),'ยืน' if c==0 else str(c),fill=(50,5,51,255),font=F)
for r in range(4):
    y=44+r*(48*S+10); d.text((10,y+100),names[r],fill=(50,5,51,255),font=F)
    imgs=[stand.crop((r*48,0,r*48+48,48))]+cells[r]
    for c,im in enumerate(imgs):
        x=110+c*(48*S+10); cs.alpha_composite(im.resize((48*S,48*S),Image.NEAREST),(x,y))
        d.line([(x,y+45*S),(x+48*S,y+45*S)],fill=(220,80,80,255),width=1)
cs.save('yai_walk_frames.png')
# GIF, palette locked to sprite colours, 4 dirs side by side at 4x, 160ms
cols=sorted({p[:3] for p in sheet.getdata() if p[3]}); print('colours',len(cols))
bgc=(198,222,186)
pal=[v for c in cols for v in c]+list(bgc); pal+=[0]*(768-len(pal)); pimg=Image.new('P',(1,1)); pimg.putpalette(pal)
fr=[]
for c in range(6):
    f=Image.new('RGBA',(4*48*4+30,48*4),bgc+(255,))
    for r in range(4): f.alpha_composite(cells[r][c].resize((192,192),Image.NEAREST),(r*(192+10),0))
    rgb=f.convert('RGB'); idx={c:i for i,c in enumerate(cols+[bgc])}
    P=Image.new('P',rgb.size); P.putpalette(pal)
    P.putdata([idx[p] for p in rgb.getdata()])
    fr.append(P)
fr[0].save('yai_walk.gif',save_all=True,append_images=fr[1:],duration=160,loop=0)
# verify
g=Image.open('yai_walk.gif'); bad=0
for c in range(6):
    g.seek(c); gg=g.convert('RGB')
    for r in range(4):
        for y in range(48):
            for x in range(48):
                p=cells[r][c].getpixel((x,y))
                if p[3]==255 and gg.getpixel((r*202+x*4+1,y*4+1))!=p[:3]: bad+=1
print('gif mismatches',bad)
