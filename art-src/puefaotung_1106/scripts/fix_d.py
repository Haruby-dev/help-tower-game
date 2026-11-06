from PIL import Image
def hx(s): return tuple(int(s[i:i+2],16) for i in (0,2,4))
OUT=hx('36081e')
BOOT={hx(c) for c in ['473a50','585061','675b69','5e3d53','3a273f','7d7a90','421e38']}
def remove_legs(im):
    im=im.copy(); p=im.load()
    row=51
    xs=[x for x in range(64) if p[x,row][3]]
    # span of the coat skirt on row 51 (first contiguous run that contains the centre)
    xl=min(x for x in xs if x>=15); xr=max(x for x in xs if x<=44)
    # find the coat run: from xl to the last red/outline before the right hand ball (x<=40)
    run=[x for x in range(xl,45) if p[x,row][3]]
    # stop at the right outline that closes the skirt
    xr2=xl
    for x in range(xl+1,45):
        if p[x,row][:3]==OUT and x>xl+5:
            xr2=x
            if not p[x+1,row][3] or p[x+1,row][:3]==OUT: break
    tmpl=[p[x,row] for x in range(xl,xr2+1)]
    for y in range(52,57):
        for i,x in enumerate(range(xl,xr2+1)): p[x,y]=tmpl[i]
    for x in range(xl,xr2+1): p[x,57]=OUT+(255,)
    # leftover boot pixels -> nearest base colour below/right
    for y in range(52,59):
        for x in range(64):
            c=p[x,y]
            if c[3] and c[:3] in BOOT:
                for dy in range(1,5):
                    q=p[x,min(63,y+dy)]
                    if q[3] and q[:3] not in BOOT: p[x,y]=q; break
    return im,(xl,xr2)
FACE=['ebb96d','db9c5a','cc8855','bc7447','b0623c','873329']
OPTS=[('ไม้เดิม (AI)',FACE),
 ('W1 ครีมพีช',['fbe3c8','f2cbaa','e3b08e','cf9677','b97c62','9a5a4a']),
 ('W2 ไม้บีชอ่อน',['f6dcb0','ecc591','dcab78','c79262','b07a50','8c5638']),
 ('W3 ตุ๊กตากระเบื้องชมพู',['fde6dc','f6cfc2','e9b5a6','d79a8c','c18070','9c5a52']),
 ('W4 ไม้ฮันนี่',['eebd7e','e0ab6c','d29a5c','bf8650','b07a45','8a5530']),
 ('W5 ครีมงาช้าง',['fbf0d8','f1dcbc','e2c4a0','cdab86','b8926e','94704f'])]
def face(im,ramp):
    im=im.copy(); p=im.load(); m={hx(a):hx(b) for a,b in zip(FACE,ramp)}
    for y in range(14,36):
        for x in range(10,46):
            c=p[x,y]
            if c[3] and c[:3] in m: p[x,y]=m[c[:3]]+(255,)
    return im
