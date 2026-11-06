from PIL import Image
import face
CR=(0xf9,0xf0,0xc5,255); U=(0x1a,0x01,0x1f,255); B=(0x4a,0x07,0x3e,255)
DARKS={(0x1a,0x01,0x1f),(0xfe,0xff,0xfe),(0xec,0xe7,0xfa)}
def clear(p,x0,x1,y0,y1):
    for y in range(y0,y1+1):
        for x in range(x0,x1+1):
            if p[x,y][3] and p[x,y][:3] in DARKS: p[x,y]=CR
def E_face(fr):
    fr=fr.copy(); p=fr.load()
    clear(p,38,40,26,30)
    for x in (38,39,40): p[x,29]=U
    p[37,28]=U
    p[44,31]=CR; p[45,31]=CR
    p[43,32]=B; p[44,32]=B; p[42,31]=B
    return fr
def W_face(fr):
    fr=fr.copy(); p=fr.load()
    clear(p,20,22,26,30)
    for x in (20,21,22): p[x,29]=U
    p[23,28]=U
    p[17,31]=CR
    p[17,32]=B; p[18,32]=B; p[19,31]=B
    return fr
def build(sheet):
    s=sheet.copy()
    S=face.H3(s.crop((0,0,64,64))); E=E_face(s.crop((64,0,128,64))); W=W_face(s.crop((192,0,256,64)))
    s.paste(S,(0,0)); s.paste(E,(64,0)); s.paste(W,(192,0)); return s
if __name__=='__main__':
    s=build(Image.open('rot_raw_SENW.png').convert('RGBA')); s.save('jtt_stand_H3_4dir.png')
