import sys, colorsys, numpy as np
from PIL import Image, ImageDraw
def hsv(p): return colorsys.rgb_to_hsv(*(np.array(p[:3])/255))
def is_capred(p):
    h,s,v=hsv(p); return (h<0.03 or h>0.94) and s>0.38 and 0.47<v<0.97
def to_rgb(h,s,v): return [round(c*255) for c in colorsys.hsv_to_rgb(h,s,v)]
BRICK=lambda h,s,v: to_rgb(0.78, s*0.25, min(1,v*0.85))   # dull brick
def hungry(img):
    a=np.array(img.convert('RGBA')).astype(int); o=a.copy(); H,W=a.shape[:2]
    red=np.zeros((H,W),bool)
    for y in range(H):
        for x in range(W):
            if a[y,x,3] and is_capred(a[y,x]) and tuple(a[y,x,:3])!=(0xe0,0x5a,0x5a): red[y,x]=True
    for y in range(H):
        for x in range(W):
            if not a[y,x,3]: continue
            h,s,v=hsv(a[y,x])
            if red[y,x]: o[y,x,:3]=BRICK(h,s,v); continue
            # cream spots: cream pixel mostly surrounded by cap red
            if 0.06<h<0.22 and s<0.62 and v>0.75:
                win=red[max(0,y-2):y+3,max(0,x-2):x+3]
                if win.sum()>=7: o[y,x,:3]=to_rgb(0.78, 0.1, 0.86); continue
            # peach gills -> duller
            if 0.03<h<0.09 and 0.15<s<0.5 and v>0.7:
                o[y,x,:3]=to_rgb(h,s*0.8,v*0.95)
    return Image.fromarray(o.astype(np.uint8))

