import sys
from PIL import Image, ImageDraw, ImageFont
U='/mnt/user-data/uploads/help-tower-game/'
blob, tag, labels = sys.argv[1], sys.argv[2], sys.argv[3]
F=ImageFont.truetype('/usr/share/fonts/opentype/tlwg/Loma-Bold.otf',30)
im=Image.open(blob).convert('RGBA'); n=len(labels); off=im.height-48; im=im.crop((0,off,48*n,off+48)); px=im.load()
for y in range(48):
  for x in range(48*n):
    r,g,b,a=px[x,y]
    if abs(r-31)<4 and abs(g-37)<4 and abs(b-44)<4: px[x,y]=(0,0,0,0)
c=[im.crop((i*48,0,i*48+48,48)) for i in range(n)]
for k,ci in zip(labels,c): ci.save(f'yai_{tag}_{k}.png')
girl=Image.open(U+'public/assets/characters/player_girl_stand.png').convert('RGBA').crop((0,0,64,64))
pui=Image.open(U+'public/assets/monsters/puinun/puinun_sweet_stand.png').convert('RGBA').crop((0,0,40,40))
tum=Image.open(U+'art-src/tumtia_1106/final/tumtia_sweet_stand_4dir.png').convert('RGBA').crop((0,0,48,48))
S=8; G=(198,222,186,255)
top=Image.new('RGBA',(n*(48*S+30)+30,48*S+60),G); d=ImageDraw.Draw(top)
for i,(k,ci) in enumerate(zip(labels,c)):
    x=30+i*(48*S+30); top.alpha_composite(ci.resize((48*S,48*S),Image.NEAREST),(x,50)); d.text((x+48*S//2-10,8),k,fill=(50,5,51,255),font=F)
S2=3; items=[('ตัวเอก',girl),('ปุยนุ่น',pui),('ตุ้มเตี้ย',tum)]+list(zip(labels,c))
W=sum(i.width*S2+30 for _,i in items)+30; base=70+64*S2
strip=Image.new('RGBA',(W,base+20),(120,170,100,255)); d2=ImageDraw.Draw(strip); x=30
for name,i in items:
    bb=i.getbbox(); s=i.resize((i.width*S2,i.height*S2),Image.NEAREST)
    strip.alpha_composite(s,(x,base-bb[3]*S2)); d2.text((x+10,10),name,fill=(255,255,255,255),font=F,stroke_width=2,stroke_fill=(50,5,51,255)); x+=i.width*S2+30
out=Image.new('RGBA',(max(top.width,strip.width),top.height+strip.height),G); out.alpha_composite(top,(0,0)); out.alpha_composite(strip,(0,top.height)); out.save(f'yai_{tag}.png')
