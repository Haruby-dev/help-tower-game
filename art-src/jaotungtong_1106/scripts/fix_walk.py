from PIL import Image
I=(0xf9,0xf0,0xc5,255); A=(0x4a,0x07,0x3e,255)
def fix(sheet):
    sh=sheet.copy(); px=sh.load(); R=3*64
    def P(i,x,y,c): px[i*64+x,R+y]=c
    # W f1: open-mouth interior -> cream
    for x in (15,16,17): P(1,x,33,I)
    P(1,18,32,A); P(1,15,34,I)
    # W f2: close mouth, outline at the edge, smirk corner
    P(2,14,34,A); P(2,15,34,I); P(2,15,35,I); P(2,16,35,I); P(2,17,32,A)
    # W f3: magenta mouth end -> plum
    P(3,17,32,A)
    # W f5: open-mouth interior -> cream
    for x in (15,16,17): P(5,x,33,I)
    P(5,15,34,I)
    # W f4: face box from the stand (head offset 0,0)
    for y in range(22,37):
        for x in range(4,26 if y<=32 else (26 if y==33 else 18)):
            px[4*64+x,R+y]=px[0*64+x,R+y]
    return sh
if __name__=='__main__':
    s=fix(Image.open('walk_crop_7f.png').convert('RGBA')); s.save('walk_fixed_7f.png')
