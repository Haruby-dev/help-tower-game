from PIL import Image
def hx(s): return tuple(int(s[i:i+2],16) for i in (0,2,4))
def M(d): return {hx(k):hx(v) for k,v in d.items()}
FUR=['f7dfa3','edc26c','dca552','c48647']
GOLD=['f5e083','f1cc3c','ebb743','e29e27','cd7e1a','b15b14','923815']
def ramp(src,dst): return M(dict(zip(src,dst)))
DRY_ANT=ramp(GOLD+['f9f0c5'],['e8dcb8','d9c79a','cdb98a','bba377','a38a62','85704f','6e5a44','efe6cc'])
GREEN_ANT=ramp(GOLD+['f9f0c5'],['e3efb0','c9de8a','b5cf78','9fbd66','80a052','5f7f42','4c6638','eef5d2'])
BRASS=ramp(['f5e083','f1cc3c','ebb743','e29e27','cd7e1a','b15b14','f649b6'],['e2cf94','d2b36a','c4a35c','b08d4c','95733d','7a5e34','c78aa8'])
DRY_FUR=ramp(FUR,['e6d6b0','d7c08e','c4a877','a68a5e'])
DULL_FUR=ramp(FUR,['efdcb0','e0c07e','cfa86a','b08a58'])
DRY_CAPE=M({'df1138':'b8505a','a70244':'93404c','842031':'74384a','870540':'70344a','2a4aa1':'56638a','fefffe':'e9e6e0','d9d8e0':'cfcac8','b2afcb':'aaa5b0','ece7fa':'e2ddea','8f86b1':'8a83a0'})
def crown(x,y): return 26<=x<=38 and 10<=y<=21
def apply(im,ant,crw,fur,body):
    im=im.copy(); p=im.load()
    for y in range(64):
        for x in range(64):
            c=p[x,y]
            if not c[3]: continue
            k=c[:3]
            if y<=21 and crown(x,y):
                if crw and k in crw: p[x,y]=crw[k]+(255,)
            elif y<17 or (y<=21 and not (16<=x<=47)):
                if ant and k in ant: p[x,y]=ant[k]+(255,)
            else:
                if fur and k in fur: p[x,y]=fur[k]+(255,)
                elif body and k in body: p[x,y]=body[k]+(255,)
    return im
B=(0x4a,0x07,0x3e,255); F=(0xf9,0xf0,0xc5,255)
def frown(im):
    im=im.copy(); p=im.load()
    for xy in [(28,34),(32,33),(33,32)]: p[xy]=F
    for x in (29,30,31): p[x,34]=B
    p[28,35]=B; p[32,35]=B
    return im
def themes(s):
    return {
     'A':frown(apply(s,DRY_ANT,BRASS,DRY_FUR,{**DRY_CAPE,**BRASS})),
     'B':frown(apply(s,GREEN_ANT,None,DULL_FUR,None)),
     'C':frown(apply(s,DRY_ANT,None,None,None)),
    }
