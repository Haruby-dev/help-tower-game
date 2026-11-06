from PIL import Image
LIFT=[0,2,3,3,2,0]; BIRD=[0,1,2,3,2,0]
def hx(s): return tuple(int(s[i:i+2],16) for i in (0,2,4))
PLUM=hx('4a073e')
BIRDC={hx(c) for c in ['94bfc9','c5ece8','7392a2','acd4d9','a0c9cf','8ba6b4','81a59c','525d71','485069','324753','33243c','ec8525','f0b950','e38641']}
RECT={'S':(40,51,28,37),'N':(13,23,29,36)}  # W: bird overlaps face/collar, moves with the body (no lag)
def bird_mask(fr,d):
    if d not in RECT: return set()
    x0,x1,y0,y1=RECT[d]; p=fr.load()
    m={(x,y) for y in range(y0,y1+1) for x in range(x0,x1+1) if p[x,y][3] and p[x,y][:3] in BIRDC}
    # keep the biggest connected blob only (drop stray matches like coat buttons)
    seen=set(); best=set()
    for s in m:
        if s in seen: continue
        comp={s}; st=[s]; seen.add(s)
        while st:
            x,y=st.pop()
            for a,b in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)):
                q=(x+a,y+b)
                if q in m and q not in seen: seen.add(q); comp.add(q); st.append(q)
        if len(comp)>len(best): best=comp
    m=best
    ol={(x,y) for y in range(y0,y1+1) for x in range(x0,x1+1) if p[x,y][3] and p[x,y][:3]==PLUM and any((x+a,y+b) in m for a,b in ((1,0),(-1,0),(0,1),(0,-1)))}
    return m|ol
def build(fr,d):
    m=bird_mask(fr,d); p=fr.load()
    body=fr.copy(); bp=body.load()
    for (x,y) in m: bp[x,y]=(0,0,0,0)
    for (x,y) in sorted(m,key=lambda t:-t[1]):
        L=next((bp[x-k,y] for k in range(1,7) if x-k>=0 and (x-k,y) not in m),(0,0,0,0))
        R=next((bp[x+k,y] for k in range(1,7) if x+k<64 and (x+k,y) not in m),(0,0,0,0))
        if L[3] and R[3]:
            Ld=next((k for k in range(1,7) if x-k>=0 and (x-k,y) not in m),9)
            Rd=next((k for k in range(1,7) if x+k<64 and (x+k,y) not in m),9)
            bp[x,y]=L if Ld<=Rd else R
    frames=[]
    for i in range(6):
        f=Image.new('RGBA',(64,64),(0,0,0,0)); f.alpha_composite(body,(0,-LIFT[i]))
        b=Image.new('RGBA',(64,64),(0,0,0,0)); q=b.load()
        for (x,y) in m: q[x,y]=p[x,y]
        f.alpha_composite(b,(0,-BIRD[i])); frames.append(f)
    return frames,m
