from PIL import Image
import numpy as np, math
G='/tmp/claude-0/-home-claude/43511920-8d67-587e-845f-cb6c9537c86a/scratchpad/game/public/assets/tiles/'
def prep(i):
    im=Image.open(G+f'tree_big_{i}.png').convert('RGBA'); a=np.array(im); H,W=a.shape[:2]
    alpha=a[...,3]>0; ys,_=np.nonzero(alpha); top,bot=ys.min(),ys.max(); cut=int(top+(bot-top)*0.68)
    canopy=alpha.copy(); canopy[cut:]=False
    green=canopy&(a[...,1]>=a[...,0])
    lum=0.3*a[...,0]+0.59*a[...,1]+0.11*a[...,2]
    light=green&(lum>np.percentile(lum[green],80))
    return im,a,canopy,light
def fC(d,t,ph):
    im,a,canopy,light=d; H,W=a.shape[:2]
    out=Image.new('RGBA',(W+4,H+4)); dx=round(0.8*math.sin(t+ph))
    out.alpha_composite(im,(2,2)); l=np.zeros_like(a); l[canopy]=a[canopy]; out.alpha_composite(Image.fromarray(l),(2+dx,2))
    o=np.array(out); yy,xx=np.nonzero(light)
    for y,x in zip(yy,xx):
        if math.sin(t*2+x*0.7+y*0.5+ph)>0.6:
            o[y+2,x+2+dx,:3]=np.minimum(255,o[y+2,x+2+dx,:3].astype(int)+40)
    return Image.fromarray(o)
D=[prep(i) for i in range(4)]
fr=[]
for f in range(32):
    t=f/32*2*math.pi
    S=Image.new('RGBA',(4*136,132),(70,150,80,255))
    for i,d in enumerate(D): S.alpha_composite(fC(d,t,i*0.9),(i*136,0))
    fr.append(S.resize((S.width*2,S.height*2),Image.NEAREST).convert('RGB'))
fr[0].save('trees_C.gif',save_all=True,append_images=fr[1:],duration=80,loop=0)
