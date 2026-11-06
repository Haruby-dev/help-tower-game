from PIL import Image
from collections import Counter
U='/mnt/user-data/uploads/help-tower-game/'
PLUM=(0x4a,0x07,0x3e)
def lum(c): return 0.3*c[0]+0.59*c[1]+0.11*c[2]
def edge_colours(im):
    px=im.load(); w,h=im.size; c=Counter()
    for y in range(h):
        for x in range(w):
            if px[x,y][3]==0: continue
            if any(not(0<=a<w and 0<=b<h) or px[a,b][3]==0 for a,b in((x+1,y),(x-1,y),(x,y+1),(x,y-1))):
                c[px[x,y][:3]]+=1
    return c
def plumify(im, maxlum):
    ec=edge_colours(im); tot=sum(ec.values())
    line=[c for c,n in ec.items() if lum(c)<maxlum and n>=2]
    base=min(lum(c) for c in line)
    out=im.copy(); p=out.load(); w,h=im.size; n=0
    for y in range(h):
        for x in range(w):
            c=p[x,y]
            if c[3] and c[:3] in line:
                # keep small shade differences: lighter line shades stay a bit lighter
                d=lum(c[:3])-base; t=min(d/120,0.35)
                p[x,y]=tuple(round(PLUM[i]*(1-t)+c[i]*t) for i in range(3))+(255,); n+=1
    return out, line, n
if __name__=='__main__':
    for name,path,cell,ml in [('mukmik','public/assets/monsters/mookmik/mookmik_sweet_stand.png',40,140),
                              ('tumtia','art-src/tumtia_1106/final/tumtia_sweet_stand_4dir.png',48,125)]:
        im=Image.open(U+path).convert('RGBA').crop((0,0,cell,cell))
        out,line,n=plumify(im,ml)
        print(name,'line colours',['#%02x%02x%02x'%c for c in line],'px',n)
        out.save(f'{name}_plum.png')
