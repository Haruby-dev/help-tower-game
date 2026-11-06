# ตุ๊บป่อง (floor 8, zone 1) — art spec 2026-11-06

Status: ART APPROVED by her 2026-11-06 22:03 ("Ok"). Not in `public/` yet, no code prompt yet (zone 1 is sent all at once after floors 9–10).

## Look (her picks)
Lazy chubby creature in a **mint frog-costume hood**: white mochi face with closed sleepy eyes (yellow, half-lidded) and pink blush,
frog eye bumps on the hood, pink/white striped scarf with a tail, holds a green (ribbed) leaf umbrella in the right hand,
an orange umbrella hook at the belly, sits on a round lily pad. Used AS THE AI MADE IT (pixen 82b87ec8, her pick B1).
Outline #3e072b (dark wine plum, within the gang rule). Canvas 56x56; **bottom line y=55** (lily pad touches the last row; others use 51).

## Movement (her pick)
He does not walk ("ไม่อยากเดิน…อ๊บ"): he **sits and slides on the lily pad**. Hand-made 0 cr: the whole sprite incl. the pad bobs up
0,0,1,1,1,0 px, 6 frames, 180 ms. The code moves his position; this loop plays while moving. Umbrella sway not done.

## Files — `art-src/tubpong_1106/final/` (56x56 cells)
| File | Size | Layout | Timing |
|---|---|---|---|
| `tubpong_sweet_stand_4dir.png` / `tubpong_hungry_stand_4dir.png` | 224x56 | S, E, N, W | — |
| `tubpong_sweet_slide_4dir.png` / `tubpong_hungry_slide_4dir.png` | 336x224 | rows S, E, N, W × 6 frames | 180 ms |
| `tubpong_sweet_eat_south.png` / `tubpong_hungry_eat_south.png` | 448x56 | 8 frames, south only | 150 ms |
| `*.gif` | — | previews only, do not ship | |

E = AI (a 3/4 view, face visible); **W = mirror of E** (her pick ค; the umbrella switches hand on W, accepted). N = as the AI made it.
Eat = AI frames as made: umbrella stays in hand, happy sleepy chewing, no visible snack (the tray in front shows the food); the scarf tail
gets bigger/darker red in f2–8 (accepted).

## Hungry state (her picks ก + 1 + H1) — theme "dry pond"
Part-by-part recolour (script `frog_hungry.py`, classify by hue + row): hood olive-grey **H1 (150,162,128)**, umbrella dried olive-brown,
lily pad dry yellow, scarf + cheeks faded, face stays white, sleepy yellow eyes kept. **Frown**: S 3-px inverted-V mouth, side 2-px pout,
W mirror, N no face. Eat frames keep their eating faces (recolour only).

## Source / history
- Her AI reference: white mochi face in a mint frog hood, sleepy eyes, striped scarf, big leaf umbrella, lily pad, rain.
- Picks before generation: medium umbrella, canvas 56, no raindrops.
- Pixen round 1 (3 cr: 05f0c510 / 27053a9a / 824e9118) = real frogs, rejected ("better face"). Round 2 (1 cr, frog-costume prompt) 82b87ec8 = B1.
- PixelLab character `f258cf58-ea29-488d-841a-db62ff70c554` "tubpong v1 (rotate)" (1 cr). Eat v3 custom group 0b504087 (1 cr).
- Total 6 cr.
