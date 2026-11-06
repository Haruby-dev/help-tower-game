import sys
from PIL import Image, ImageDraw, ImageFont
sheetf, standf, out_png, out_gif, ms = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], int(sys.argv[5])
sheet=Image.open(sheetf).convert('RGBA'); stand=Image.open(standf).convert('RGBA')
rows=sheet.height//48; n=sheet.width//48
cells=[[sheet.crop((c*48,r*48,c*48+48,r*48+48)) for c in range(n)] for r in range(rows)]
F=ImageFont.truetype('/usr/share/fonts/opentype/tlwg/Loma-Bold.otf',24)
S=5; G=(198,222,186,255); names=['หน้า','ขวา','หลัง','ซ้าย'][:rows]
cs=Image.new('RGBA',(110+(n+1)*(48*S+10),rows*(48*S+10)+50),G); d=ImageDraw.Draw(cs)
for c in range(n+1): d.text((110+c*(48*S+10)+48*S//2-20,10),'ยืน' if c==0 else str(c),fill=(50,5,51,255),font=F)
for r in range(rows):
    y=44+r*(48*S+10); d.text((10,y+100),names[r],fill=(50,5,51,255),font=F)
    for c,im in enumerate([stand.crop((r*48,0,r*48+48,48))]+cells[r]):
        x=110+c*(48*S+10); cs.alpha_composite(im.resize((48*S,48*S),Image.NEAREST),(x,y))
        d.line([(x,y+45*S),(x+48*S,y+45*S)],fill=(220,80,80,255),width=1)
cs.save(out_png)
bgc=(198,222,186)
cols=sorted({p[:3] for r in cells for im in r for p in im.getdata() if p[3]})
pal=[v for c in cols+[bgc] for v in c]; pal+=[0]*(768-len(pal)); idx={c:i for i,c in enumerate(cols+[bgc])}
frames=[]
for c in range(n):
    f=Image.new('RGBA',(rows*202,192),bgc+(255,))
    for r in range(rows): f.alpha_composite(cells[r][c].resize((192,192),Image.NEAREST),(r*202,0))
    P=Image.new('P',f.size); P.putpalette(pal); P.putdata([idx[p] for p in f.convert('RGB').getdata()]); frames.append(P)
frames[0].save(out_gif,save_all=True,append_images=frames[1:],duration=ms,loop=0)
print('colours',len(cols))
