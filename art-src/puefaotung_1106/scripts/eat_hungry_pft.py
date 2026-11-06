from PIL import Image
import hungry_pft as H, hop
raw=Image.open('pft_eat_raw_9f.png').convert('RGBA')
st=Image.open('pft_rot_ai_SENW.png').convert('RGBA').crop((0,0,64,64))
hs=Image.open('pft_hungry_stand_4dir.png').convert('RGBA').crop((0,0,64,64))
mask=H.dilate(hop.bird_mask(st,'S'),1)
def best_dy(f):
    sp=st.load(); fp=f.load(); best=None
    for dy in range(-2,3):
        s=0
        for y in range(20,60):
            for x in range(32,64):
                yy=y+dy
                b=fp[x,yy] if 0<=yy<64 else (0,0,0,0)
                if (sp[x,y][3]>0)!=(b[3]>0) or (sp[x,y][3] and sp[x,y][:3]!=b[:3]): s+=1
        if best is None or s<best[0]: best=(s,dy)
    return best[1]
sweet=Image.new('RGBA',(8*64,64),(0,0,0,0)); hung=Image.new('RGBA',(8*64,64),(0,0,0,0))
for i in range(1,9):
    f=raw.crop((i*64,0,i*64+64,64)); sweet.paste(f,((i-1)*64,0))
    dy=best_dy(f); g=H.straw(H.coat(f,'C1')); q=g.load(); hp=hs.load()
    for (x,y) in mask:
        yy=y+dy
        if 0<=x<64 and 0<=yy<64 and 0<=y<64: q[x,yy]=hp[x,y]
    hung.paste(g,((i-1)*64,0)); print(i,'dy',dy)
sweet.save('pft_sweet_eat_south.png'); hung.save('pft_hungry_eat_south.png')
# frame0 check: recolour of the stand == approved hungry stand except the eyes
g0=H.straw(H.coat(raw.crop((0,0,64,64)),'C1')); q=g0.load(); hp=hs.load()
for (x,y) in mask: q[x,y]=hp[x,y]
print('f0 vs hungry stand diff (excl eye rows 20-23)',sum(1 for y in range(64) for x in range(64) if g0.getpixel((x,y))!=hs.getpixel((x,y)) and not 20<=y<=23))
