import sys
from PIL import Image, ImageDraw, ImageFont
S=sys.argv[1]
st=Image.open(f"{S}/out/rot_S.png").convert("RGBA")
off={2:(8,8),3:(9,7),4:(9,7),5:(9,8)}
mouth=st.crop((16,20,23,26))     # x16..22, y20..25 : muzzle with nose + small mouth
fr=[Image.open(f"{S}/walk/s_{i}.png").convert("RGBA") for i in range(7)]
fixed=[f.copy() for f in fr]
for i,(dx,dy) in off.items():
    fixed[i].paste(mouth,(16+dx,20+dy))
for i,f in enumerate(fixed): f.save(f"{S}/walk/s_fix_{i}.png")
# GIF at game speed (110 ms), frames 1-6 loop (frame 0 = ref stand, not part of the walk loop), 3x, raw left | fixed right
G=3; frames=[]
for i in range(1,7):
    can=Image.new("RGBA",(56*G*2+30,56*G+40),(186,222,160,255)); d=ImageDraw.Draw(can)
    can.alpha_composite(fr[i].resize((56*G,56*G),Image.NEAREST),(10,30))
    can.alpha_composite(fixed[i].resize((56*G,56*G),Image.NEAREST),(56*G+20,30))
    font=ImageFont.load_default(size=18)
    d.text((14,6),"AI as made",fill=(60,80,50),font=font); d.text((56*G+24,6),"mouth locked",fill=(60,80,50),font=font)
    frames.append(can.convert("RGB"))
frames[0].save(f"{S}/walk/hangkradueng_walk_south_test.gif",save_all=True,append_images=frames[1:],duration=110,loop=0)
# contact sheet of fixed frames 1-6 with numbers + red feet line
Z=5;c=56*Z;font=ImageFont.load_default(size=22)
out=Image.new("RGBA",(3*c+40,2*(c+34)+10),(250,244,236,255)); d=ImageDraw.Draw(out)
for k,i in enumerate(range(1,7)):
    x=10+(k%3)*(c+10); y=10+(k//3)*(c+34)
    d.rectangle([x,y+28,x+c-1,y+28+c-1],fill=(255,251,245,255),outline=(225,210,195,255))
    d.line([x,y+28+46*Z,x+c-1,y+28+46*Z],fill=(255,150,150,255))
    out.alpha_composite(fixed[i].resize((c,c),Image.NEAREST),(x,y+28))
    d.text((x+4,y+2),f"frame {i}"+(" (mouth fixed)" if i in off else ""),fill=(110,70,60,255),font=font)
out.save(f"{S}/walk/hangkradueng_walk_south_frames.png")
