from PIL import Image

P = {
    'O': '#320533',  # twins outline plum
    'W': '#ffce86', 'w': '#e1a65e', 'd': '#a8743f',  # wood light/mid/dark
    'H': '#fffaf0',  # highlight
    'A': '#f6eedb', 'a': '#ede3ca', 's': '#d8bdad',  # straw bell
    'L': '#e8def0', 'l': '#d5c8da', 'q': '#b8a8c4',  # lilac bell
    'B': '#a3e4fd', 'b': '#69bde8', 'k': '#4592c7',  # blue bow
    'Y': '#ffd65a', 'y': '#e2a030',  # gold
    'G': '#7fd6b0', 'g': '#308b93',  # clover
    'r': '#8b494c',  # string
    'E': '#b8eca0', 'e': '#6cc58a',  # leaf
    'P': '#f7aac4',  # pink paper
}

def hexc(h):
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (255,)

def put(im, x, y, rows):
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch in '. ':
                continue
            if not (0 <= x+i < im.width and 0 <= y+j < im.height):
                continue
            im.putpixel((x+i, y+j), hexc(P[ch]))

def vline(im, x, y0, y1, ch):
    for y in range(y0, y1+1):
        im.putpixel((x, y), hexc(P[ch]))

def hline(im, x0, x1, y, ch):
    for x in range(x0, x1+1):
        im.putpixel((x, y), hexc(P[ch]))

def bell(base, light, shade):
    t = {'1': light, '2': base, '3': shade}
    rows = [
        "...OOO...",
        "..O121O..",
        ".O1H223O.",
        ".O12223O.",
        ".O12223O.",
        "O1222233O",
        "O3333333O",
        ".OOOOOOO.",
        "...OYO...",
        "....O....",
    ]
    return [''.join(t.get(c, c) for c in r) for r in rows]

STRAW = bell('a', 'A', 's')
LILAC = bell('l', 'L', 'q')

BOW = [
    "OO...OO",
    "OBOOObO",
    "ObBkBbO",
    "OkOOOkO",
    "OO.O.OO",
]

CLOVER = [
    ".OO.OO.",
    "OGGOGGO",
    "OGgOgGO",
    ".OOrOO.",
    "OGgOgGO",
    "OGGOGGO",
    ".OO.OO.",
]

def post(im, x, y0, y1):
    # 3px wide wooden post with outline -> 5px
    for y in range(y0, y1+1):
        put(im, x, y, ["OWwdO"])

def foot(im, cx, y):
    put(im, cx-5, y, [
        "..OOOOOOO..",
        ".OWWWWwwdO.",
        "OWwwwwwwwdO",
        "OdddddddddO",
        ".OOOOOOOOO.",
    ])


def bells_from(im, cx, y):
    """bow at (cx,y), two strings, straw left (short), lilac right (long)"""
    put(im, cx-3, y, BOW)
    # strings fan out
    put(im, cx-4, y+5, ["r.......r"])
    vline(im, cx-5, y+6, y+7, 'r'); put(im, cx-9, y+8, STRAW)
    vline(im, cx+5, y+6, y+11, 'r'); put(im, cx+1, y+12, LILAC)


CW = 38

def variant_a():
    im = Image.new('RGBA', (CW, 56), (0, 0, 0, 0))
    ox = 4
    put(im, ox+1, 1, [
        ".....OOOOOOOOO.......",
        "...OOWWWWWWWWWOO.....",
        "..OWWwwwwwwwwwwWO....",
        ".OWwwOOOOOOOOOOwwO...",
        ".OWwO.........OwwO...",
        "OWwO...........OrO...",
        "OWdO..........",
    ])
    post(im, ox, 8, 50)
    foot(im, ox+2, 50)
    vline(im, ox+16, 7, 9, 'r')
    bells_from(im, ox+16, 10)
    return im


EAR_L = ["..OO...", ".OaaO..", ".OaPaO.", "OaPPasO", "OaPPasO"]
EAR_R = ["...OO..", "..OllO.", ".OlPlO.", "OqlPPlO", "OqlPPlO"]

def variant_b():
    im = Image.new('RGBA', (CW, 56), (0, 0, 0, 0))
    put(im, 2, 1, EAR_L)
    put(im, 28, 1, EAR_R)
    put(im, 1, 6, [
        "O" * 34,
        "O" + "W" * 32 + "O",
        "O" + "w" * 32 + "O",
        "O" + "d" * 32 + "O",
        "O" * 34,
    ])
    put(im, 15, 3, CLOVER)
    post(im, 4, 11, 49)
    post(im, 29, 11, 49)
    foot(im, 6, 49); foot(im, 31, 49)
    vline(im, 18, 11, 11, 'r')
    bells_from(im, 18, 12)
    return im


def variant_c():
    im = Image.new('RGBA', (CW, 56), (0, 0, 0, 0))
    ox = 4
    put(im, ox+2, 2, [
        ".......OOOOOOOOOO.......",
        "....OOOWWWWWWWWWWOOO....",
        "..OOWWWwwwwwwwwwwwwWO...",
        ".OWWwwOOOOOOOOOOOOOwwO..",
        ".OWwOO............OOrO..",
        "OWwO..............",
        "OWdO..............",
    ])
    # leaves on the branch
    put(im, ox+19, 0, [".OO...", "OEEO..", "OEeEO.", ".OOeO.", "...O.."])
    put(im, ox+9, 0, ["..OO.", ".OEEO", "OEeEO", ".OOO."])
    put(im, ox-3, 10, ["..OO.", ".OEEO", "OEeEO", "OeOO.", ".O..."])
    # round stump (drawn first, post comes out of its top)
    put(im, ox-4, 44, [
        "....OOOOOOOO....",
        "..OOWWWWWWWWOO..",
        ".OWWwwwwwwwwWWO.",
        ".OWWWwwwwwwWWWO.",
        ".OdWWWWWWWWWWdO.",
        ".OwdwddwddwdwdO.",
        "OOwdwddwddwdwdOO",
        "OddOOdOOOOdOOddO",
        ".OO..O....O..OO.",
    ])
    post(im, ox+2, 9, 46)
    put(im, ox+11, 50, [".OO.", "OEEO", "OEeO", ".OO."])
    vline(im, ox+21, 8, 9, 'r')
    bells_from(im, ox+21, 10)
    return im


if __name__ == '__main__':
    out = {'A': variant_a(), 'B': variant_b(), 'C': variant_c()}
    for k, v in out.items():
        v.save(f'chime_{k}.png')
    W = CW*3 + 8*4
    sheet = Image.new('RGBA', (W, 60), (198, 222, 186, 255))
    for i, k in enumerate('ABC'):
        sheet.alpha_composite(out[k], (8 + i*(CW+8), 2))
    sheet.resize((W*8, 60*8), Image.NEAREST).save('sheet8.png')
