"""Rod tiers for the shop, built from the APPROVED action-button rod icon (icon_fish.png). 0 credits."""
from PIL import Image
H=lambda h:tuple(int(h[i:i+2],16) for i in (0,2,4))+(255,)
BASE='/mnt/user-data/uploads/help-tower-game/art-src/ui_buttons_1104/action_icons/icon_fish.png'
POLE=[H('e2c068'),H('b28a42'),H('967032')]; GRIP=[H('96563a'),H('6e3c2c')]
OL=H('4a2828'); PL=H('5c304c')
TIERS={
 'bamboo':None,
 'iron':  ([H('d2d8e0'),H('969eae'),H('6e7486')],[H('6e4a3c'),H('50342c')],H('5c6272')),
 'silver':([H('f6f8fc'),H('c4cce0'),H('94a0bc')],[H('5a78b4'),H('3c548c')],H('c4cce0')),
 'star':  ([H('ffe878'),H('f0be46'),H('c88c28')],[H('f078a0'),H('c85078')],H('ffd25a')),
}
def make(tier):
    b=Image.open(BASE).convert('RGBA'); im=Image.new('RGBA',(32,32),(0,0,0,0)); im.alpha_composite(b,(2,2)); px=im.load()
    if TIERS[tier] is None: return im
    pole,grip,reel=TIERS[tier]
    m={POLE[0]:pole[0],POLE[1]:pole[1],POLE[2]:pole[2],GRIP[0]:grip[0],GRIP[1]:grip[1]}
    for y in range(32):
        for x in range(32):
            if px[x,y][3] and px[x,y] in m: px[x,y]=m[px[x,y]]
    # small reel just above the grip (grip top ~ (9..10, 22) after the +2 offset)
    rx,ry=11,20
    pat=[".OOO.","ORRRO","ORDRO","ORRRO",".OOO."]
    for dy,r in enumerate(pat):
        for dx,c in enumerate(r):
            if c=='.': continue
            col={'O':OL,'R':reel,'D':pole[2]}[c]
            px[rx+dx-2,ry+dy-2]=col
    if tier=='star':
        star=["..Y..",".YWY.","YWWWY",".YWY.","..Y.."]
        for dy,r in enumerate(star):
            for dx,c in enumerate(r):
                if c!='.': px[23+dx,1+dy]={'Y':H('ffcc40'),'W':H('fffbe6')}[c]
        for (sx,sy) in [(5,6),(28,12)]:
            px[sx,sy]=H('fff6c0'); px[sx-1,sy]=H('ffd25a'); px[sx+1,sy]=H('ffd25a'); px[sx,sy-1]=H('ffd25a'); px[sx,sy+1]=H('ffd25a')
    if tier=='silver':
        for (x,y) in [(17,10),(18,9)]: px[x,y]=H('ffffff')
    return im
if __name__=='__main__':
    for t in TIERS: make(t).save(f'rod_{t}.png')
