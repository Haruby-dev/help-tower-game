from PIL import Image, ImageDraw, ImageFont
import sys
SRC='jtt_A.png'
OUT=(0x1a,0x01,0x1f); PLUM=(0x4a,0x07,0x3e)
FUR=[(0xed,0xc3,0x98),(0xe3,0x9a,0x41),(0xd4,0x78,0x3d),(0xbd,0x5c,0x38)]  # L M D S
def hx(s): return tuple(int(s[i:i+2],16) for i in (0,2,4))
OPTS={
 'F1':('ทองน้ำผึ้ง',['f7dfa3','edc26c','dca552','c48647']),
 'F2':('ทองนวลเนย',['faecc0','f3d58a','e4bb6c','c99a58']),
 'F3':('ทองอำพัน',['f6d48d','eab24e','d8963e','b97536']),
 'F4':('ทองพีช',['f9dcb0','f0bd7f','e1a066','c47f52']),
 'F5':('คาราเมลทอง',['f3d0a8','e8ab62','d99052','bd7048']),
}
def base_fix(im):
    im=im.copy(); p=im.load(); w,h=im.size
    for y in range(h):
        for x in range(w):
            c=p[x,y]
            if c[3] and c[:3]==OUT:
                face = 22<=y<=33 and 20<=x<=43 and all(p[a,b][3] for a,b in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)))
                if not face: p[x,y]=PLUM+(255,)
    return im
def recolor(im,ramp):
    im=im.copy(); p=im.load(); m=dict(zip(FUR,[hx(r) for r in ramp]))
    for y in range(17,64):
        for x in range(64):
            c=p[x,y]
            if c[3] and c[:3] in m: p[x,y]=m[c[:3]]+(255,)
    return im
if __name__=='__main__':
    a=Image.open(SRC).convert('RGBA'); b=base_fix(a)
    b.save('jtt_A_plum.png')
    for k,(n,r) in OPTS.items(): recolor(b,r).save(f'jtt_A_{k}.png')
    print('ok')
