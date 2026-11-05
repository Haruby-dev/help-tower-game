"""Hand-cleaned 9px minis for the savory dishes on banana leaf (auto version was a green mush). 0 credits."""
from PIL import Image
import os
D=os.path.dirname(os.path.abspath(__file__))
P={'O':(46,28,24),'L':(126,150,56),'l':(98,120,46),'d':(64,86,50),
   'F':(240,176,64),'f':(222,132,40),'H':(252,218,146),'W':(252,250,244),'w':(226,220,200),'Y':(250,192,56),
   'B':(156,104,70),'C':(242,236,192),'r':(190,92,36),'g':(96,162,62),'c':(226,218,190),'E':(240,178,82),'e':(208,112,40),
   'R':(170,28,64),'K':(236,222,176),'h':(226,172,82),'b':(150,92,44),'G':(170,92,40),'y':(244,186,60)}
LEAF=["OLLLLLLLO",".OlllllOd","..OOOOO.."]
T={
'grilled_fish':[".OOOOO.OO","OHHFFFOFO","OFOFFFFFO","OfffffOfO",".OOOOO.OO"]+LEAF,
'boiled_egg':[".........",".OOO.OOO.","OYYYOYYYO","OWWWOWWWO","OWWwOWWwO"]+LEAF,
'baked_potato':[".........","..OOOOO..",".OBBBBBO.","OBCCYCCBO","OBBCCCBBO"]+LEAF,
'grilled_corn':["......OO.",".....OyYO","....OYGYO","..OOYGYO.",".OYGYYOO."]+LEAF,
'home_kaprao':[".........","....OOOO.","..OOWWYWO",".OrgOWWWO","OrrgrcccO"]+LEAF,
'scallion_omelet':[".........",".OOOOOOO.","OEEgEEEeO","OEgEEgEeO","OeEEgEeeO"]+LEAF,
'corn_egg_fried_rice':[".........","..OOOOO..",".OcYcgcO.","OcgcccYcO","OcccYcgcO"]+LEAF,
'honey_apple_grill':[".........","..OOOOO..",".ORRKRRO.","ORKKRKKRO","OhhhhhhhO",".ObbbbbO.","..OOOOO..","........."],
}
def draw(rows):
    im=Image.new('RGBA',(9,len(rows)))
    for y,r in enumerate(rows):
        for x,ch in enumerate(r):
            if ch in P: im.putpixel((x,y),P[ch]+(255,))
    return im.crop(im.getbbox())
if __name__=='__main__':
    os.makedirs(f'{D}/mini9_hand',exist_ok=True)
    for k,r in T.items(): draw(r).save(f'{D}/mini9_hand/{k}.png')
    K=8; out=Image.new('RGBA',(len(T)*12*K,2*12*K),(255,238,244,255))
    for i,k in enumerate(T):
        a=Image.open(f'{D}/mini9/{k}.png'); b=Image.open(f'{D}/mini9_hand/{k}.png')
        out.alpha_composite(a.resize((a.width*K,a.height*K),Image.NEAREST),((i*12+1)*K,1*K))
        out.alpha_composite(b.resize((b.width*K,b.height*K),Image.NEAREST),((i*12+1)*K,13*K))
    out.save(f'{D}/savory9_compare.png')
