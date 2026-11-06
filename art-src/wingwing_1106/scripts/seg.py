from PIL import Image
PL=(0x4a,0x07,0x3e)
def segment(im, seeds):
    p=im.load(); w,h=im.size
    inside=set(); st=list(seeds)
    while st:
        x,y=st.pop()
        if (x,y) in inside or not(0<=x<w and 0<=y<h): continue
        c=p[x,y]
        if not c[3] or c[:3]==PL: continue
        inside.add((x,y))
        st+= [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]
    body=set(inside)
    for x,y in inside:
        for dx in(-1,0,1):
            for dy in(-1,0,1):
                a,b=x+dx,y+dy
                if 0<=a<w and 0<=b<h and p[a,b][3] and p[a,b][:3]==PL: body.add((a,b))
    return body
if __name__=='__main__':
    S=Image.open('wingwing_sweet_stand_4dir.png').crop((0,0,56,56))
    body=segment(S,[(28,28),(17,7),(36,7)])
    p=S.load()
    for y in range(4,52):
        print('%02d '%y+''.join('.' if not p[x,y][3] else ('B' if (x,y) in body else 'w') for x in range(56)))
