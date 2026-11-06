import sys
from PIL import Image, ImageDraw, ImageFont
S=sys.argv[1]; W_=S+"/walk"
dirs=["s","e","n","w"]; names={"s":"S","e":"E","n":"N","w":"W"}
G=3; font=ImageFont.load_default(size=18)
frames=[]
for i in range(1,7):
    can=Image.new("RGBA",(4*56*G+50,56*G+34),(186,222,160,255)); d=ImageDraw.Draw(can)
    for j,k in enumerate(dirs):
        f=Image.open(f"{W_}/{k}_fix_{i}.png")
        can.alpha_composite(f.resize((56*G,56*G),Image.NEAREST),(10+j*(56*G+10),28))
        d.text((10+j*(56*G+10)+70,6),names[k],fill=(60,80,50),font=font)
    frames.append(can.convert("RGB"))
frames[0].save(f"{W_}/hangkradueng_walk_4dir.gif",save_all=True,append_images=frames[1:],duration=110,loop=0)
Z=4;c=56*Z;font=ImageFont.load_default(size=20)
out=Image.new("RGBA",(6*(c+6)+10,4*(c+30)+10),(250,244,236,255)); d=ImageDraw.Draw(out)
for r,k in enumerate(dirs):
    for i in range(1,7):
        f=Image.open(f"{W_}/{k}_fix_{i}.png")
        x=6+(i-1)*(c+6); y=6+r*(c+30)
        d.rectangle([x,y+24,x+c-1,y+24+c-1],fill=(255,251,245,255),outline=(225,210,195,255))
        d.line([x,y+24+46*Z,x+c-1,y+24+46*Z],fill=(255,150,150,255))
        out.alpha_composite(f.resize((c,c),Image.NEAREST),(x,y+24))
        d.text((x+4,y+2),f"{names[k]} {i}",fill=(110,70,60,255),font=font)
out.save(f"{W_}/hangkradueng_walk_4dir_frames.png")
