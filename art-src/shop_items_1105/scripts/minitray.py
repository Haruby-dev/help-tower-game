"""Shop icon: food tray tables 6 / 10, redrawn small (32x32) from the in-game food_tray_6/10 palette. 0 credits."""
from PIL import Image
H=lambda h:tuple(int(h[i:i+2],16) for i in (0,2,4))+(255,)
B=H('3a1b0b'); A=H('7d5634'); F=H('9b714b'); T=H('a1784e'); E=H('573b26'); D=H('4f331f'); M=H('86603e'); P=H('99683c'); J=H('4c3727'); Q=H('735236')
PLATES={'grey':(H('f1f0ed'),H('c1beb8'),H('969895')),'cream':(H('f6f0e1'),H('f0e7d3'),H('e5d9c0')),
        'tan':(H('f0e7d3'),H('dac2a4'),H('d1a674')),'light':(H('f6f0e1'),H('c4c6c8'),H('b2b4b6'))}
def plate(im,x0,y0,kind,w=8):
    hi,rim,cen=PLATES[kind]; px=im.load()
    if w==5:
        rows=['.BBB.','BhLLB','BLccB','.BBB.']
    else:
     rows=['..'+'B'*(w-4)+'..', '.Bh'+'L'*(w-5)+'B.', 'BL'+'c'*(w-4)+'LB', 'BL'+'c'*(w-4)+'LB', '.BL'+'c'*(w-6)+'LB.', '..'+'B'*(w-4)+'..']
    sh=len(rows)
    for dy,r in enumerate(rows):
        for dx,ch in enumerate(r):
            c={'B':B,'h':hi,'L':rim,'c':cen}.get(ch)
            if c: px[x0+dx,y0+dy]=c
    # recess shadow under the plate
    for dx in ([] if w==5 else range(2,w-2)):
        if px[x0+dx,y0+sh]==A: px[x0+dx,y0+sh]=E
def table(cols, kinds, W=32, top=6, pw=8, x1=1, x2=None, wood=None):
    global A,F,M,Q,P,D,E,J
    if wood: A,F,M,Q,P,D,E,J=wood
    im=Image.new('RGBA',(W,32),(0,0,0,0)); px=im.load()
    x2=W-2 if x2 is None else x2; y1=top; ybot=top+19
    for y in range(y1,ybot+1):
        for x in range(x1,x2+1):
            px[x,y]=A
    for x in range(x1+1,x2): px[x,y1]=B; px[x,y1+1]=F
    for y in range(y1+1,ybot): px[x1,y]=B; px[x2,y]=B
    px[x1+1,y1+1]=F; px[x2-1,y1+1]=F
    # left light edge, right dark edge of the board
    for y in range(y1+2,y1+15): px[x1+1,y]=M; px[x2-1,y]=Q
    # faint plank lines
    for yy in (y1+14,):
        for x in range(x1+2,x2-1):
            if (x*7)%11: px[x,yy]=Q
    # plates
    inner=x2-x1-1
    gap=max(1,(inner-cols*pw)//(cols+1)) if pw!=5 else 1
    span=cols*pw+(cols-1)*gap
    off=x1+1+(inner-span)//2
    xs=[off+i*(pw+gap) for i in range(cols)]
    k=0
    for row,yy in enumerate([y1+2,y1+8] if pw!=5 else [y1+3,y1+9]):
        for x in xs:
            plate(im,x,yy,kinds[k],pw); k+=1
    # front apron
    for x in range(x1+1,x2): px[x,y1+15]=P; px[x,y1+16]=D; px[x,y1+17]=D; px[x,ybot-1]=D
    for x in range(x1,x2+1): px[x,ybot]=B
    # legs
    for lx in (x1+2, x2-5):
        for y in range(ybot+1,ybot+4):
            for x in range(lx,lx+4):
                px[x,y]=J if x<lx+3 else E
            px[lx-1,y]=B; px[lx+4,y]=B
        for x in range(lx-1,lx+5): px[x,ybot+4]=B
    return im
if __name__=='__main__':
    t6=table(3,['grey','cream','tan','grey','light','tan']); t6.save('tray6_hand.png')
    W10=(H('c48c4e'),H('d19c60'),H('cc965e'),H('90643b'),H('bc8751'),H('7f5835'),H('90643b'),H('6d533f'))
    t10=table(5,['grey','light','light','cream','cream','grey','light','light','cream','cream'],pw=5,x1=0,x2=31,top=7,wood=W10); t10.save('tray10_hand.png')
