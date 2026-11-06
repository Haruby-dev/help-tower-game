import colorsys, numpy as np
from PIL import Image
def hsv(p): return colorsys.rgb_to_hsv(*(np.array(p[:3])/255))
def capred(p):
    h,s,v=hsv(p); return p[3] and (h<0.03 or h>0.94) and s>0.38 and v>0.47
def fix(img):
    a=np.array(img.convert('RGBA')).astype(int); o=a.copy(); H,W=a.shape[:2]; n=0
    red=np.array([[bool(capred(a[y,x])) for x in range(W)] for y in range(H)])
    for y in range(H):
        for x in range(W):
            if not a[y,x,3]: continue
            h,s,v=hsv(a[y,x])
            if 0.15<h<0.45 and 0.12<s<0.4 and red[max(0,y-2):y+3,max(0,x-2):x+3].sum()>=6:
                o[y,x,:3]=[0xf0,0xb4,0x9c] if v>0.6 else [0x8e,0x33,0x46]; n+=1
    return Image.fromarray(o.astype(np.uint8)),n
for f,cols,rows in [('tumtia_sweet_stand_4dir.png',4,1),('tumtia_sweet_walk_4dir.png',6,4)]:
    im=Image.open(f); out=Image.new('RGBA',im.size); tot=0
    for r in range(rows):
        for c in range(cols):
            g,n=fix(im.crop((c*48,r*48,c*48+48,r*48+48))); out.alpha_composite(g,(c*48,r*48)); tot+=n
    out.save(f); print(f,tot)
