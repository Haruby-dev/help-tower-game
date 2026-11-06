from PIL import Image
import colorsys
from hungry_final import wing_col, crown_col, body_col, is_lilac, hx, PL, FUR, SKIN, GREEN, YEL, FACE
BLUE_H=(0.45,0.62)
def regions(im):
    p=im.load(); w,h=im.size; lab={}; regs=[]
    for y in range(h):
        for x in range(w):
            if (x,y) in lab or not p[x,y][3] or p[x,y][:3]==PL: continue
            st=[(x,y)]; cur=[]; lab[(x,y)]=len(regs)
            while st:
                a,b=st.pop(); cur.append((a,b))
                for c,d in((a+1,b),(a-1,b),(a,b+1),(a,b-1)):
                    if 0<=c<w and 0<=d<h and (c,d) not in lab and p[c,d][3] and p[c,d][:3]!=PL:
                        lab[(c,d)]=len(regs); st.append((c,d))
            regs.append(cur)
    return regs
def is_blue(rgb):
    h,s,v=colorsys.rgb_to_hsv(*[c/255 for c in rgb]); return BLUE_H[0]<=h<=BLUE_H[1] and s>0.15
from hover import south_body_mask
_st=Image.open('wingwing_sweet_stand_4dir.png').crop((0,0,56,56))
SMASK=south_body_mask(_st)
def hungry_frame(im, crown_rows=range(10,24)):
    out=im.copy(); p=out.load(); o=im.load()
    for reg in regions(im):
        cx=sum(x for x,_ in reg)/len(reg); cy=sum(y for _,y in reg)/len(reg)
        has_blue=any(is_blue(o[x,y][:3]) for x,y in reg)
        has_fur=any(hx(o[x,y][:3]) in FUR|FACE for x,y in reg)
        leaky=has_blue and has_fur
        wing = has_blue or cx<15 or cx>41
        for x,y in reg:
            rgb=o[x,y][:3]; k=hx(rgb)
            if leaky:
                if k in FUR|SKIN|FACE|GREEN: w=False
                elif is_blue(rgb): w=True
                else: w=(x,y) not in SMASK
            else: w=wing
            if w: n=wing_col(rgb)
            elif y in crown_rows and k not in FUR|SKIN|GREEN|YEL|FACE and is_lilac(rgb): n=crown_col(rgb)
            else: n=body_col(rgb)
            p[x,y]=n+(255,)
    return out
if __name__=='__main__':
    s=Image.open('eat_S_aligned_9.png')
    fr=[s.crop((i*56,0,i*56+56,56)) for i in range(1,9)]
    hf=[hungry_frame(f) for f in fr]
    sh=Image.new('RGBA',(56*8,56)); ss=Image.new('RGBA',(56*8,56))
    for i,(a,b) in enumerate(zip(fr,hf)): ss.alpha_composite(a,(i*56,0)); sh.alpha_composite(b,(i*56,0))
    ss.save('wingwing_sweet_eat_south.png'); sh.save('wingwing_hungry_eat_south.png')
    # check the stand-equivalent: apply to stand and compare against approved hungry stand (before face edit)
    st=Image.open('wingwing_sweet_stand_4dir.png').crop((0,0,56,56)); ref=Image.open('wingwing_hungry_stand_4dir_smile.png').crop((0,0,56,56))
    t=hungry_frame(st); diff=sum(1 for a,b in zip(t.get_flattened_data(),ref.get_flattened_data()) if a!=b); print('stand diff vs approved',diff)
