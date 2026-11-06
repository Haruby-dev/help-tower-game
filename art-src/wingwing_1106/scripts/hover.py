from PIL import Image
from seg import segment
SKIRT={37:(15,38),38:(15,38),39:(14,39),40:(13,40),41:(13,41),42:(12,41),43:(11,42),44:(12,41),45:(14,39),46:(15,38)}
def south_body_mask(S):
    B=segment(S,[(28,28),(17,7),(36,7)])
    m=set()
    for y in range(56):
        for x in range(56):
            if y<=10: inb=12<=x<=43
            elif y==11: inb=13<=x<=41
            elif y==12: inb=15<=x<=39
            elif y==13: inb=16<=x<=38
            elif y<=15: inb=18<=x<=36
            elif y<=36: inb=(x,y) in B
            elif y in SKIRT: inb=SKIRT[y][0]<=x<=SKIRT[y][1]
            elif y==47: inb=17<=x<=35
            else: inb=y>=48
            if inb: m.add((x,y))
    return m
def layers(S,mask,cx):
    body=Image.new('RGBA',S.size); L=Image.new('RGBA',S.size); R=Image.new('RGBA',S.size)
    p=S.load()
    for y in range(56):
        for x in range(56):
            c=p[x,y]
            if not c[3]: continue
            ((body if (x,y) in mask else (L if x<cx else R))).putpixel((x,y),c)
    return body,L,R
WING=[(0,0),(1,0),(2,-1),(2,-1),(1,0),(0,0)]
BOB=[0,-1,-2,-2,-1,0]
def frames(S,mask,cx):
    body,L,R=layers(S,mask,cx); out=[]
    for (dx,dy),b in zip(WING,BOB):
        f=Image.new('RGBA',(56,56))
        f.alpha_composite(L,(dx,dy+b)); f.alpha_composite(R,(-dx,dy+b)); f.alpha_composite(body,(0,b))
        out.append(f)
    return out
if __name__=='__main__':
    S=Image.open('wingwing_sweet_stand_4dir.png').crop((0,0,56,56))
    fr=frames(S,south_body_mask(S),28)
    strip=Image.new('RGBA',(56*6,56))
    for i,f in enumerate(fr): strip.alpha_composite(f,(i*56,0))
    strip.save('hover_S_v1.png')
    # check pixel conservation: body unchanged and no orphan
    print([f.getbbox() for f in fr])
