from PIL import Image
def h(s): s=s.lstrip('#'); return tuple(int(s[i:i+2],16) for i in (0,2,4))+(255,)
src=Image.open('yai_round2_D.png').convert('RGBA')
def fix(im):
    px=im.load()
    f,l,V=h('a29597')[:3],h('c4bab6')[:3],h('3e3b5c')[:3]
    for y in range(48):
        for x in range(48):
            c=px[x,y][:3]
            if c==f: px[x,y]=h('b65e39')
            elif c==l: px[x,y]=h('d7864d')
            elif c==V and 17<=y<=21: px[x,y]=h('4a073e')
    # ladle bowl at the bottom of the cane (x7..13)
    P={'#':'4a073e','F':'eaae65','L':'fbcc8c','O':'c97241','A':'9f432b'}
    rows={41:".#FOA#.",42:"#FLOAA#",43:"#FOOAA#",44:".#####."}
    for y,r in rows.items():
        for i,ch in enumerate(r):
            if ch!='.': px[7+i,y]=h(P[ch])
    return im
a=fix(src.copy()); a.save('yai_D_fix1.png')
# cocoa + bark lines
b=a.copy(); px=b.load()
ramp={'fbcc8c':'e3ab7e','eaae65':'cc8e5e','e69e55':'bd7f52','d7864d':'ab6d47','c97241':'995c3e','b65e39':'834a34','9f432b':'703c2d','933526':'5f3028'}
R={h(k)[:3]:h(v) for k,v in ramp.items()}
for y in range(48):
    for x in range(48):
        c=px[x,y][:3]
        if c in R and y>=17: px[x,y]=R[c]
for x,ys in [(14,range(31,37)),(32,range(31,37)),(16,range(37,40)),(30,range(37,40))]:
    for y in ys:
        if px[x,y][3] and px[x,y][:3]!=h('4a073e')[:3]: px[x,y]=h('5f3028')
b.save('yai_D_fix2.png')
