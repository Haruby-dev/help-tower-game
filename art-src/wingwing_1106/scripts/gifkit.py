from PIL import Image, ImageDraw, ImageFont
BG=(170,205,140)
def exact_gif(frames, path, scale=4, ms=140):
    big=[]
    for f in frames:
        c=Image.new('RGBA',f.size,BG+(255,)); c.alpha_composite(f); big.append(c.convert('RGB').resize((f.width*scale,f.height*scale),Image.NEAREST))
    cols=sorted({px for b in big for px in b.get_flattened_data()})
    assert len(cols)<=256, len(cols)
    idx={c:i for i,c in enumerate(cols)}
    pal=[v for c in cols for v in c]+[0]*(768-3*len(cols))
    ims=[]
    for b in big:
        p=Image.new('P',b.size); p.putpalette(pal); p.putdata([idx[c] for c in b.get_flattened_data()]); ims.append(p)
    ims[0].save(path,save_all=True,append_images=ims[1:],duration=ms,loop=0,optimize=False,disposal=1)
    g=Image.open(path); bad=0; n=0; ref=[list(b.get_flattened_data()) for b in big]
    try:
        while True:
            fr=list(g.convert('RGB').get_flattened_data())
            bad+=min(sum(1 for a,c in zip(fr,r) if a!=c) for r in ref); n+=1; g.seek(g.tell()+1)
    except EOFError: pass
    return len(cols),n,bad
def contact(frames,path,scale=8,label=''):
    F=ImageFont.truetype('/usr/share/fonts/opentype/tlwg/Loma-Bold.otf',24)
    w=frames[0].width*scale; out=Image.new('RGBA',(len(frames)*(w+12)+12,frames[0].height*scale+50),(246,240,232,255)); d=ImageDraw.Draw(out)
    for i,f in enumerate(frames):
        x=12+i*(w+12); d.rectangle([x,8,x+w-1,8+w-1],fill=(236,228,220,255))
        d.line([x,8+51*scale,x+w-1,8+51*scale],fill=(200,170,180),width=2)
        out.alpha_composite(f.resize((w,w),Image.NEAREST),(x,8)); d.text((x+w//2,14+w),f'{label}{i+1}',font=F,fill=(90,40,80),anchor='mt')
    out.save(path)
