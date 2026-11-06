import sys
from PIL import Image, ImageDraw, ImageFont
S=sys.argv[1]
cfg={
 "e":(f"{S}/out/hk_E_final.png",(22,15,30,24),{1:(8,8),2:(9,9),3:(9,9),4:(9,8),5:(9,8),6:(9,9)}),
 "w":(f"{S}/out/hk_W_final.png",(9,15,17,24),{1:(7,8),2:(6,8),3:(7,8),4:(8,8),5:(7,8),6:(6,8)}),
}
for k,(stp,box,offs) in cfg.items():
    st=Image.open(stp).convert("RGBA"); face=st.crop(box)
    for i in range(7):
        f=Image.open(f"{S}/walk/{k}_{i}.png").convert("RGBA")
        if i in offs:
            dx,dy=offs[i]; f.paste(face,(box[0]+dx,box[1]+dy))
        f.save(f"{S}/walk/{k}_fix_{i}.png")
for i in range(7):
    Image.open(f"{S}/walk/n_{i}.png").save(f"{S}/walk/n_fix_{i}.png")
Z=4;c=56*Z;font=ImageFont.load_default(size=20)
out=Image.new("RGBA",(7*(c+6)+10,2*(c+30)+10),(250,244,236,255)); d=ImageDraw.Draw(out)
for r,k in enumerate("ew"):
    for i in range(7):
        f=Image.open(f"{S}/walk/{k}_fix_{i}.png")
        x=6+i*(c+6); y=6+r*(c+30)
        d.rectangle([x,y+24,x+c-1,y+24+c-1],fill=(255,251,245,255),outline=(225,210,195,255))
        out.alpha_composite(f.resize((c,c),Image.NEAREST),(x,y+24))
        d.text((x+4,y+2),f"{k.upper()} {i}",fill=(110,70,60,255),font=font)
out.save(f"{S}/walk/contact_ew_fix.png")
