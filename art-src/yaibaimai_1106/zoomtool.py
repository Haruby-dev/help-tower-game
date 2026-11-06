import sys
from PIL import Image, ImageDraw, ImageFont
def zoom(sheetfile,row,cols,x0,x1,y0,y1,out,S=18):
    sh=Image.open(sheetfile).convert('RGBA')
    F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',10)
    w=x1-x0; h=y1-y0
    o=Image.new('RGBA',(len(cols)*(w*S+30)+24,h*S+40),(198,222,186,255)); d=ImageDraw.Draw(o)
    for i,c in enumerate(cols):
        ox=24+i*(w*S+30); o.alpha_composite(sh.crop((c*48+x0,row*48+y0,c*48+x1,row*48+y1)).resize((w*S,h*S),Image.NEAREST),(ox,20))
        d.text((ox,2),f'f{c+1}',fill=(0,0,0,255),font=F)
        for gx in range(w): d.text((ox+gx*S+5,h*S+22),str((x0+gx)%10),fill=(0,0,0,255),font=F)
        for gy in range(h+1): d.line([(ox,20+gy*S),(ox+w*S,20+gy*S)],fill=(0,0,0,50))
        for gx in range(w+1): d.line([(ox+gx*S,20),(ox+gx*S,20+h*S)],fill=(0,0,0,50))
    for gy in range(h): d.text((2,20+gy*S+4),str(y0+gy),fill=(0,0,0,255),font=F)
    o.save(out)
if __name__=='__main__':
    a=sys.argv; zoom(a[1],int(a[2]),[int(x) for x in a[3].split(',')],int(a[4]),int(a[5]),int(a[6]),int(a[7]),a[8])
