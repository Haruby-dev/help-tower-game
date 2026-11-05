"""9px tiny food for tray plates + the tower above a monster's head, derived from the real dish icons. 0 credits."""
from PIL import Image
from collections import Counter
import json, os, colorsys
D=os.path.dirname(os.path.abspath(__file__))
M=json.load(open(f'{D}/src/art-src/_icons_map_1106.json'))
def lum(c): return 0.299*c[0]+0.587*c[1]+0.114*c[2]
def reduce(im, W=9, H=8):
    im=im.crop(im.getbbox()); s=min(W/im.width,H/im.height)
    w,h=max(1,round(im.width*s)),max(1,round(im.height*s))
    px=im.load(); sx,sy=im.width/w,im.height/h
    opaque=[p[:3] for p in im.getdata() if p[3]>200]
    pal=[c for c,_ in Counter(opaque).most_common(48) if lum(c)>=55]
    darks=Counter(c for c in opaque if lum(c)<55)
    ol=darks.most_common(1)[0][0] if darks else (60,30,40)
    out=Image.new('RGBA',(w,h),(0,0,0,0)); op=out.load()
    for y in range(h):
        for x in range(w):
            x0,x1=int(x*sx),max(int(x*sx)+1,int(round((x+1)*sx))); y0,y1=int(y*sy),max(int(y*sy)+1,int(round((y+1)*sy)))
            cs=[px[i,j] for j in range(y0,min(y1,im.height)) for i in range(x0,min(x1,im.width))]
            op_=[c for c in cs if c[3]>128]
            if len(op_)<len(cs)*0.4: continue
            li=[c[:3] for c in op_ if lum(c)>=55]
            if not li: op[x,y]=ol+(255,); continue
            # saturated-weighted average then snap to palette (keeps the dish's signature colour)
            r=sum(c[0] for c in li)/len(li); g=sum(c[1] for c in li)/len(li); b=sum(c[2] for c in li)/len(li)
            best=min(pal,key=lambda q:(q[0]-r)**2*0.3+(q[1]-g)**2*0.59+(q[2]-b)**2*0.11)
            op[x,y]=best+(255,)
    # outline: silhouette edge pixels -> outline colour
    o2=out.copy(); p2=o2.load()
    for y in range(h):
        for x in range(w):
            if op[x,y][3] and any(not(0<=x+dx<w and 0<=y+dy<h) or op[x+dx,y+dy][3]==0 for dx,dy in((1,0),(-1,0),(0,1),(0,-1))):
                p2[x,y]=ol+(255,)
    return o2
if __name__=='__main__':
    os.makedirs(f'{D}/mini9',exist_ok=True)
    for k,v in M.items():
        reduce(Image.open(f'{D}/src/{v}').convert('RGBA')).save(f'{D}/mini9/{k}.png')
