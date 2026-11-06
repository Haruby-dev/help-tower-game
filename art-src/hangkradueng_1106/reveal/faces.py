from PIL import Image
def hx(s): return tuple(int(s[i:i+2],16) for i in (0,2,4))
J=hx('471634')+(255,); PINK=hx('fea4af')+(255,); TONG=hx('f27c94')+(255,); LINE=hx('4a0a16')+(255,)
EYECOL={hx(c) for c in ['4a0a16','7a1626','ffffff','9c2234','d0606a','faa2d8','b4596a']}
def find_eyes(f):
    p=f.load(); pts=[(x,y) for y in range(16,36) for x in range(12,44) if p[x,y][3] and p[x,y][:3] in {hx('7a1626'),hx('4a0a16'),hx('9c2234')}]
    L=[q for q in pts if q[0]<28]; R=[q for q in pts if q[0]>=28]
    box=lambda s:(min(x for x,_ in s),max(x for x,_ in s),min(y for _,y in s),max(y for _,y in s))
    return box(L),box(R)
def happy_eyes(f):
    f=f.copy(); p=f.load()
    for (x0,x1,y0,y1) in find_eyes(f):
        # fill eye with surrounding fur (sample above the eye)
        fur=p[(x0+x1)//2,y0-2]; cheek=p[x0-1,y1]
        for y in range(y0,y1+1):
            for x in range(x0,x1+1):
                if p[x,y][3] and p[x,y][:3] in EYECOL|{hx('d0606a')}: p[x,y]=fur
        cx=(x0+x1)/2; cy=y0+(y1-y0)//2
        w=x1-x0+1
        pts=[(x0,cy+1),(x0+1,cy),(x0+2,cy-1),(x1-2,cy-1),(x1-1,cy),(x1,cy+1)]
        if w>=6: pts+= [(x0+3,cy-1)] if w==7 else []
        for x,y in pts: p[int(x),int(y)]=LINE
    return f
def big_mouth(f):
    f=f.copy(); p=f.load()
    js=[(x,y) for y in range(24,38) for x in range(22,34) if p[x,y][3] and p[x,y][:3]==J[:3]]
    rows={}
    for x,y in js: rows.setdefault(y,[]).append(x)
    my=max(rows,key=lambda y:len(rows[y])); c=round(sum(rows[my])/len(rows[my]))
    for x in range(c-2,c+3): p[x,my]=J
    p[c-2,my+1]=J; p[c-1,my+1]=PINK; p[c,my+1]=TONG; p[c+1,my+1]=PINK; p[c+2,my+1]=J
    p[c-1,my+2]=J; p[c,my+2]=TONG; p[c+1,my+2]=J
    p[c,my+3]=J
    return f
