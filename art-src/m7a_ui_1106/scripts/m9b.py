from PIL import Image
import os, sys, json
from m16 import M, bagpath, outer, D
sys.path.insert(0,'/tmp/claude-0/-home-claude/2fdc073d-3a9e-55e8-a817-5b2ba50a762e/scratchpad/realhomes')
from half import half
def mini9(k):
    h=half(bagpath(k)); tmp=f'{D}/_t.png'; h.save(tmp); q=half(tmp)
    return outer(q)
if __name__=='__main__':
    os.makedirs(f'{D}/mini9b',exist_ok=True)
    W=8;cell=14;K=6
    out=Image.new('RGBA',(W*cell*K,4*cell*K),(255,238,244,255))
    sizes=[]
    for n,k in enumerate(M):
        m=mini9(k); m.save(f'{D}/mini9b/{k}.png'); sizes.append(m.size)
        out.alpha_composite(m.resize((m.width*K,m.height*K),Image.NEAREST),(((n%W)*cell+2)*K,((n//W)*cell+2)*K))
    out.save(f'{D}/mini9b_sheet.png'); print(sizes)
