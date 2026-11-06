import sys, colorsys, numpy as np
from PIL import Image
D=sys.argv[1]
STRAW=[[0xc2,0xad,0x7a],[0xcd,0xb9,0x8a],[0xe0,0xd1,0xa6],[0xe3,0xd4,0xaa]]
def apply(sweet, hungry, out):
    s=np.array(Image.open(sweet).convert('RGBA')); h=np.array(Image.open(hungry).convert('RGBA')); n=0
    H_,W_=s.shape[:2]
    for y in range(H_):
        if (y%40)>=20: continue
        for x in range(W_):
            if not s[y,x,3]: continue
            r,g,b=s[y,x,:3]/255; hh,ss,vv=colorsys.rgb_to_hsv(r,g,b)
            if 0.38<hh<0.56 and ss>0.08:
                k=0 if vv<0.78 else 1 if vv<0.85 else 2 if vv<0.95 else 3
                h[y,x,:3]=STRAW[k]; n+=1
    Image.fromarray(h).save(out); return n
print(apply(D+'/mukmik_sweet_stand_4dir.png',D+'/furv/stand_A.png',D+'/mukmik_hungry_stand_4dir.png'))
print(apply(D+'/mukmik_sweet_hop_4dir.png',D+'/furv/hop_A.png',D+'/mukmik_hungry_hop_4dir.png'))
