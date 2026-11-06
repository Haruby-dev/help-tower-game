# Mukmik (floor 3 monster) art — 2026-11-06

Approved by her. Files: `art-src/mukmik_1106/final/` (not in `public/` yet, not sent to the code side).

## Look
- Proud white long-eared bunny, ~24x36 px sprite on a 40x40 canvas (same canvas as Puinun/Popcorn), feet line y=37. Display 1:1.
- Ref = her AI image (smug half-lidded eyes, mint inner ears, leaf scarf). In-game sprite = pixen candidate D `ce8af27c` kept AS THE AI MADE IT (her rule): light-blue inner ears, cream fur, half-lidded brown eyes, pink blush, green leaf bow.
- Ear glitter (hand, her pick v1): 3 dots per ear, white `#ffffff`, pink `#f7aac4`, yellow `#fce28c`. Front + side views only (north shows no inner ear).
- Hungry (0 cr, `hungry.py` + `earstraw.py`): fur oatmeal (option A), leaf scarf dried brown, red eyes `#c2364a` (front: iris; side: under the lid), cheeks faded `#d9aab0`, inner ears STRAW `#c2ad7a #cdb98a #e0d1a6 #e3d4aa` (her pick 5), glitter kept.

## Sheets
| File | Layout |
|---|---|
| `mukmik_sweet_stand_4dir.png` / `mukmik_hungry_stand_4dir.png` | 160x40, S E N W |
| `mukmik_sweet_hop_4dir.png` / `mukmik_hungry_hop_4dir.png` | 240x160, rows S E N W, 6 frames, 110 ms. Walk = a hop. |
| `mukmik_sweet_eat_s.png` / `mukmik_hungry_eat_s.png` | 320x40, 8 frames south, 150 ms, play 1-8 in a loop: 1-5 chewing (mouth opens on 2 and 4-5), 6-8 head up, happy (deeper blush). Eyes go round while eating (AI as made, her OK). |

Hop rows (her choice, "use as is"):
- S and N = AI raw frames as made (ears flap, front eyes alternate round / half-lid, no glitter). Only S frame 6 was lifted 2 px to the feet line.
- E = fixed: stand head + scarf locked every frame, glitter, feet on the stand line, hop lift 0,2,1,0,2,1 px by hand. W = mirror of E.

## PixelLab
Character `cc900415` "mukmik v2 (import)" (humanoid body, 4 dirs imported: south with glitter, east fixed by hand (long hind-foot bar cut, tail puff added), west = mirror of fixed east, north as AI). Rotation source `4078a481`. Hop = v3 custom group `3973b4ad` (S,E,N). Eat = v3 custom group `697c1e99` (S).
Credits: 9.25 (pixen 4: A/B/C rejected + D, rotate 1, import 0.25, hop 3, eat 1).

## Lessons
- A detailed pixen prompt (ears = half the height, small body, exact face/scarf) got her pick in one extra try after 3 misses.
- She liked the AI's ear flap on the front/back hop more than my locked version: offer "AI as made" as an option for motion.
- I sent two GIFs with similar names (raw vs fix) and she got confused: send ONE latest file per review.
- Reply in Thai even after long tool runs (I slipped into English once).
- Large base64 through device_bash got corrupted: deliver binaries as zip -> device_commit_files -> unzip, then check the pixel hash.
