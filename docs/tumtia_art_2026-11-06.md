# Tumtia ตุ้มเตี้ย (floor 4 monster) art — 2026-11-06

Approved by her. Files: `art-src/tumtia_1106/final/` (not in `public/` yet, not sent to the code side).

## Look
- Lazy sleepy walking mushroom. Sprite ~45x44 on a **48x48 canvas** (bigger than Puinun/Popcorn/Mukmik's 40x40 because of the nightcap + pompom), feet line y=45. Display 1:1.
- Ref = her AI image (green mushroom, striped nightcap + pompom, star charm, leaf sprouts, striped pajamas, hugs a mushroom plush, sleeping + drool).
- Base sprite = pixen `e8fc3cd9` (48px detailed prompt), shape kept as the AI made it. Her recolour (0 cr, `tumrecolor.py` + a nightcap pass): cap RED `#ee7a72 #d95a5a #c04a52 #8e3346` with cream spots (matches GDD "red cap, white dots"), gills PEACH, pajamas + nightcap blue `#9fd0f5 #84b8e6 #6f9fd6 #5a84c4 #3f5f99` with yellow stripes `#fbe08a #f2cc5e`, red buttons `#e05a5a`, plush and leaf sprouts stay green. Eyes always closed.
- Hungry (0 cr, `tum_hungry_D.py`): cap GREY-PURPLE (her pick D, hue 0.78), spots faded lilac, gills duller. Eyes stay closed (no red eyes: she approved it as is). Pajamas, nightcap, plush, face unchanged.
- The sprite is ASYMMETRIC (pompom + star on its left, plush in its right arm): east and west are separate AI drawings, never a mirror.

## Sheets
| File | Layout |
|---|---|
| `tumtia_sweet_stand_4dir.png` / `tumtia_hungry_stand_4dir.png` | 192x48, S E N W |
| `tumtia_sweet_walk_4dir.png` / `tumtia_hungry_walk_4dir.png` | 288x192, rows S E N W, 6 frames, 140 ms. Slow sleepy waddle (body sways, dips on 4-6). |
| `tumtia_sweet_eat_s.png` / `tumtia_hungry_eat_s.png` | 384x48, 8 frames south, 150 ms, loop 1-8: 1 smile, 2-4 dips (the plush comes up near the mouth), 5-8 happy ^^ open smile. |

## PixelLab
Character `546bf680` "tumtia v1 (rotate)" (4 dirs, AI as made, no import needed). Walk = v3 custom group `27aaf2c3` (S,E,N,W). Eat = v3 custom group `07ba5b8f` (S).
Credits: 12 (pixen 6: 40dd3554 / 63871e17 / d3ef1162 / 7146d1a8 rejected + e8fc3cd9 picked; image_to_pixelart `b9bd6507` failed 1; rotate 1; walk 4; eat 1).

## Fixes by hand
- The green -> red recolour left ~65 olive-green specks on the cap (stand + walk): removed by `fix_specks.py` (plush greens protected).
- Walk: feet aligned to the stand line; W frame 6 shifted +1 px (loop jump).

## Lessons
- image_to_pixelart (faithful) on a soft pastel AI painting = washed out, no outline. Don't use it for her refs.
- A detailed pixen prompt that lists every element got her pick; then recolour by hand (cheap, she likes swatches).
- Recolour masks: protect the outline colours (`#682215`, `#703224`), the cheek/mouth pink `#fd8c80` and the plush greens before mapping "reds" or "greens".
- I slipped into English several times late at night: always reply in Thai.
