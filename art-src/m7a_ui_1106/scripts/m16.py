from PIL import Image
from collections import Counter
import json, os, sys
sys.path.insert(0,'/tmp/claude-0/-home-claude/2fdc073d-3a9e-55e8-a817-5b2ba50a762e/scratchpad/realhomes')
from half import half
D=os.path.dirname(os.path.abspath(__file__))
M=json.load(open(f'{D}/src/art-src/_icons_map_1106.json'))
def bagpath(k): return f'{D}/bag/'+M[k].replace('/dishes/','/dishes_bag/').replace('/desserts/','/desserts_bag/')
def outer(im,col=(40,26,22)):
    W,H=im.size; o=Image.new('RGBA',(W+2,H+2)); o.alpha_composite(im,(1,1)); src=o.copy()
    for y in range(H+2):
        for x in range(W+2):
            if src.getpixel((x,y))[3]==0 and any(0<=x+dx<W+2 and 0<=y+dy<H+2 and src.getpixel((x+dx,y+dy))[3] for dx,dy in((1,0),(-1,0),(0,1),(0,-1))):
                o.putpixel((x,y),col+(255,))
    return o.crop(o.getbbox())
def mini16(k):
    h=half(bagpath(k)); return outer(h)
if __name__=='__main__':
    os.makedirs(f'{D}/mini16',exist_ok=True)
    W=8;cell=22;K=5
    out=Image.new('RGBA',(W*cell*K,4*cell*K),(255,238,244,255))
    for n,k in enumerate(M):
        m=mini16(k); m.save(f'{D}/mini16/{k}.png')
        out.alpha_composite(m.resize((m.width*K,m.height*K),Image.NEAREST),(((n%W)*cell+2)*K,((n//W)*cell+2)*K))
    out.save(f'{D}/mini16_sheet.png')
