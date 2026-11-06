from PIL import Image, ImageDraw, ImageFont

src = Image.open('twin_chime_B_honey.png').convert('RGBA')
W, H = src.size
sp = src.load()
TWIG = {(0xb0, 0x7a, 0x45), (0xd2, 0x9a, 0x5c), (0xee, 0xbd, 0x7e)}


def twig(x, y):
    return y <= 40 or (41 <= y <= 43 and 13 <= x <= 18)


def hanging(x, y):
    r, g, b, a = sp[x, y]
    if not a or x < 19 or y < 9 or y > 46 or (x == 19 and y >= 27):
        return False
    if (r, g, b) in TWIG and twig(x, y):
        return False
    if y >= 35 and x <= 28:  # leaf on the pot
        return False
    if y >= 41 and x <= 30:  # pot rim
        return False
    return True


# bell offset b, ribbon-tip offset r (lags one frame) - 8 frames
B = [0, 1, 1, 1, 0, -1, -1, -1]
R = [-1, 0, 1, 2, 1, 0, -1, -2]


def offset(y, b, r):
    if y <= 13:
        return 0
    if y <= 27:
        return b
    t = (y - 27) / (46 - 27)
    return round(b + (r - b) * t)


static = src.copy()
stp = static.load()
for y in range(H):
    for x in range(W):
        if hanging(x, y):
            stp[x, y] = (0, 0, 0, 0)

frames = []
for b, r in zip(B, R):
    f = static.copy()
    fp = f.load()
    for y in range(H):
        o = offset(y, b, r)
        for x in range(W):
            if hanging(x, y) and 0 <= x + o < W:
                fp[x + o, y] = sp[x, y]
    frames.append(f)

for i, f in enumerate(frames):
    f.save(f'sway_f{i+1}.png')
# sheet strip for the game
strip = Image.new('RGBA', (W * len(frames), H))
for i, f in enumerate(frames):
    strip.alpha_composite(f, (i * W, 0))
strip.save('twin_chime_sway_8f.png')

# preview GIF at 4x on grass colour, 180 ms
S = 4
bgc = (198, 222, 186, 255)
gif = []
for f in frames:
    c = Image.new('RGBA', (W * S, H * S), bgc)
    c.alpha_composite(f.resize((W * S, H * S), Image.NEAREST))
    gif.append(c.convert('P', palette=Image.ADAPTIVE))
gif[0].save('twin_chime_sway.gif', save_all=True, append_images=gif[1:], duration=180, loop=0, disposal=2)

# contact sheet with numbers
font = ImageFont.truetype('/usr/share/fonts/opentype/tlwg/Loma-Bold.otf', 26)
S2 = 5
cs = Image.new('RGBA', (len(frames) * (W * S2 + 12) + 12, H * S2 + 50), bgc)
d = ImageDraw.Draw(cs)
for i, f in enumerate(frames):
    x = 12 + i * (W * S2 + 12)
    cs.alpha_composite(f.resize((W * S2, H * S2), Image.NEAREST), (x, 44))
    d.text((x + W * S2 // 2 - 8, 6), str(i + 1), fill=(50, 5, 51, 255), font=font)
cs.save('twin_chime_sway_frames.png')
