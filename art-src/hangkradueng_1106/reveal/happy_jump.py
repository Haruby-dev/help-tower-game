from PIL import Image
U='/mnt/user-data/uploads/help-tower-game/help-tower-game/'
R=U+'art-src/hangkradueng_1106/reveal/'
HEART=Image.open(U+'public/assets/fx/fx_heart_5.png').convert('RGBA'); SPARK=Image.open(U+'public/assets/fx/fx_sparkle_5.png').convert('RGBA')
EXTRA=[0,1,3,4,2,0]
J=(0x47,0x16,0x34,255); PINK=(0xfe,0xa4,0xaf,255)
FX={1:[('s',3,20)],2:[('s',2,14),('s',49,12),('h',4,22)],3:[('h',2,9),('h',49,7),('s',50,20)],4:[('h',1,4),('h',50,2),('s',3,16)],5:[]}
def mouth(f):
    p=f.load(); js=[(x,y) for y in range(24,36) for x in range(23,33) if p[x,y][3] and p[x,y][:3]==J[:3]]
    if not js: return f
    rows={}
    for x,y in js: rows.setdefault(y,[]).append(x)
    ys=sorted(rows); my=max(ys,key=lambda y:len(rows[y]))
    c=round(sum(rows[my])/len(rows[my]))
    base=p[c,my+2] if p[c,my+2][3] else p[c-3,my]
    for x in rows[my]: p[x,my]=base
    for x in range(c-2,c+3): p[x,my]=J
    p[c-1,my+1]=J; p[c,my+1]=PINK; p[c+1,my+1]=J; p[c,my+2]=J
    return f
def clover_fix(frames):
    # frame index 2 (f3): copy the clover box from frame index 1 (f2), head is 1 px higher in f3
    src=frames[1].load(); dst=frames[2].load()
    for y in range(16,22):
        for x in range(25,32): dst[x,y-1]=src[x,y]
def build(path):
    im=Image.open(path).convert('RGBA')
    frames=[im.crop((i*56,0,i*56+56,56)) for i in range(6)]
    clover_fix(frames)
    out=[]
    for i,f in enumerate(frames):
        f=mouth(f.copy())
        g=Image.new('RGBA',(56,56),(0,0,0,0)); g.alpha_composite(f,(0,-EXTRA[i]))
        for k,x,y in FX.get(i,[]): g.alpha_composite(HEART if k=='h' else SPARK,(x,y))
        out.append(g)
    sheet=Image.new('RGBA',(336,56),(0,0,0,0))
    for i,g in enumerate(out): sheet.paste(g,(i*56,0))
    return sheet
