from PIL import Image
PLUM=(0x4a,0x07,0x3e,255); MAIN=(0x3c,0x0f,0x2c)
def lum(c): return 0.3*c[0]+0.59*c[1]+0.11*c[2]
def plumify(im):
    im=im.copy(); p=im.load(); src=im.copy().load(); n=0
    for y in range(64):
        for x in range(64):
            c=src[x,y]
            if not c[3] or lum(c)>=60: continue
            edge=any(not(0<=a<64 and 0<=b<64) or src[a,b][3]==0 for a,b in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)))
            face=(20<=x<=42 and 16<=y<=27) and not edge
            if edge or (c[:3]==MAIN and not face): p[x,y]=PLUM; n+=1
    return im,n
