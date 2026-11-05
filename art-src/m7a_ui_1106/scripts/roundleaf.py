"""Test: swap the folded banana leaf under savory dishes for a round leaf plate (her ref 04:39). 0 credits."""
from PIL import Image, ImageDraw
import json, os, colorsys
D=os.path.dirname(os.path.abspath(__file__))
M=json.load(open(f'{D}/src/art-src/_icons_map_1106.json'))
O=(36,40,22); RIM=(58,92,40); L1=(88,132,52); L2=(104,150,60); V=(150,190,80); HI=(170,206,96)
def leaf_plate(w=46,h=34):
    im=Image.new('RGBA',(w,h)); m=Image.new('L',(w,h)); ImageDraw.Draw(m).ellipse((0,0,w-1,h-1),fill=255)
    px=im.load(); mp=m.load(); cx,cy=(w-1)/2,(h-1)/2
    import math
    for y in range(h):
        for x in range(w):
            if not mp[x,y]: continue
            edge=any(not(0<=x+dx<w and 0<=y+dy<h) or not mp[x+dx,y+dy] for dx,dy in((1,0),(-1,0),(0,1),(0,-1)))
            r=((x-cx)/(w/2))**2+((y-cy)/(h/2))**2
            if edge: c=O
            elif r>0.78: c=RIM
            else:
                # radial veins every ~40 degrees
                ang=math.degrees(math.atan2((y-cy)*w/h,(x-cx)))%40
                c=V if (ang<4 and r>0.15) else (L2 if (x+y)%7 else L1)
            px[x,y]=c+(255,)
    # small highlight bits like the ref
    for (x,y) in [(9,8),(10,8),(12,6),(34,7),(35,8),(38,13),(7,22),(8,23)]:
        if px[x,y][3]: px[x,y]=HI+(255,)
    return im
def is_leaf(c):
    r,g,b=c[:3]; h,l,s=colorsys.rgb_to_hls(r/255,g/255,b/255)
    return 0.15<h<0.42 and s>0.18
def food_only(im, keep_box=None):
    im=im.copy(); px=im.load()
    for y in range(im.height):
        for x in range(im.width):
            p=px[x,y]
            if p[3] and is_leaf(p) and not (keep_box and keep_box[0]<=x<=keep_box[2] and keep_box[1]<=y<=keep_box[3]): px[x,y]=(0,0,0,0)
    return im
if __name__=='__main__':
    tests=['grilled_fish','boiled_egg','corn_egg_fried_rice','home_kaprao']
    K=4; out=Image.new('RGBA',(len(tests)*2*52*K,56*K),(236,210,140,255))
    for i,k in enumerate(tests):
        src=Image.open(f'{D}/src/'+M[k]).convert('RGBA')
        f=food_only(src); f=f.crop(f.getbbox())
        c=Image.new('RGBA',(48,48)); lp=leaf_plate(); c.alpha_composite(lp,(1,48-lp.height-2))
        c.alpha_composite(f,((48-f.width)//2,max(0,48-lp.height//2-f.height-4)))
        out.alpha_composite(src.resize((48*K,48*K),Image.NEAREST),((i*2*52)*K,4*K))
        out.alpha_composite(c.resize((48*K,48*K),Image.NEAREST),((i*2*52+52)*K,4*K))
        c.save(f'{D}/roundleaf_{k}.png')
    out.save(f'{D}/roundleaf_test.png')
