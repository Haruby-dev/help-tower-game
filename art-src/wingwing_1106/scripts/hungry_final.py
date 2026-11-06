from PIL import Image, ImageOps
from hungry_part import hsv_adj, mix, hx, FUR, SKIN, GREEN, YEL, FACE
from hover import south_body_mask
import os; os.environ.setdefault('STATE','sweet')
from hover_all import east_mask, north_mask
PL=(0x4a,0x07,0x3e)
PINKS={'#f179b2','#fa9cc7','#e8458e','#fbd8e1','#fdbed8','#eb4d6f'}
BLUES={'#81bdf6','#8ff1fc','#bdfffc','#8ed3f8'}
G1=(196,212,188); DARK=tuple(round(v*0.8) for v in G1)
def body_col(rgb):
    k=hx(rgb)
    if k in FACE: return rgb
    if k in FUR: return hsv_adj(rgb,sat=0.75,val=0.98)
    if k in SKIN: return hsv_adj(rgb,sat=0.55,val=0.97)
    if k in GREEN: return hsv_adj(rgb,sat=0.45,val=0.85,hue_to=0.14,hue_w=0.5)
    if k in YEL: return hsv_adj(rgb,sat=0.5,val=0.95)
    return hsv_adj(rgb,sat=0.45,val=0.93)
def wing_col(rgb): return mix(hsv_adj(rgb,sat=0.3),G1,0.5)
def crown_col(rgb):
    L=(0.3*rgb[0]+0.59*rgb[1]+0.11*rgb[2])/255; return mix(DARK,G1,min(1,L*1.1))
import colorsys
def is_lilac(rgb):
    h,sat,v=colorsys.rgb_to_hsv(*[c/255 for c in rgb]); return 0.62<=h<=0.80
def hungry(img,mask,crown_rows,top_wing_rows=None):
    out=img.copy(); p=out.load(); o=img.load()
    for y in range(56):
        for x in range(56):
            c=o[x,y]
            if not c[3] or c[:3]==PL: continue
            rgb=c[:3]; k=hx(rgb)
            if (x,y) not in mask or (top_wing_rows and y in top_wing_rows and k in BLUES|{'#f9aadc','#fdffff','#a12a7f','#c558b2'} and x<=29):
                n=wing_col(rgb)
            elif y in crown_rows and k not in FUR|SKIN|GREEN|YEL|FACE and is_lilac(rgb):
                n=crown_col(rgb)
            else: n=body_col(rgb)
            p[x,y]=n+(255,)
    return out
sh=Image.open('wingwing_sweet_stand_4dir.png')
S,E,N=[sh.crop((i*56,0,i*56+56,56)) for i in range(3)]
HS=hungry(S,south_body_mask(S),range(12,22))
HE=hungry(E,east_mask(),range(4,22),top_wing_rows=range(4,13))
HN=hungry(N,north_mask(),range(6,24))
HW=ImageOps.mirror(HE)
st=Image.new('RGBA',(224,56))
for i,c in enumerate([HS,HE,HN,HW]): st.alpha_composite(c,(i*56,0))
st.save('wingwing_hungry_stand_4dir.png')
