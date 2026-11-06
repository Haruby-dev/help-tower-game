# เจ้าทุ่งทอง (floor 9, zone 1) — art spec 2026-11-06

Status: ART APPROVED by her 2026-11-06 23:39 (pick "1"). Not in `public/` yet, no code prompt yet (zone 1 is sent all at once after floor 10).

## Look (her picks)
Proud **deer king**, upright 2-legged chibi (pick A). Honey-gold fur (F1: f7dfa3 edc26c dca552 c48647), cream belly + muzzle,
**antlers = golden wheat ears** (plump wheat tips, bright gold), small gold crown with a pink gem between the antlers (M1),
fluffy white fur collar, red cape with gold trim over a blue lining, one gold chain necklace with a pink gem, gold foot hooves,
dark mauve hand hooves (kept as AI made, her pick H2). Cut from her ref: quill, anklets, extra necklaces, throne, treasure.
Face (her pick H3, asked "ขอหยิ่งๆ"): **proud closed eyes** (flat line + outer lash) + **one-sided smirk**; pride comes from the face,
not half-lid eyes (differs from Mukmik). Outline = gang plum #4a073e (eyes/nose/mouth lines stay dark #1a011f like Mukmik).
Canvas **64x64** (Z2, taller than the gang "as a lord"). Stand bbox S (5,1)-(57,60): **last opaque row y=59**.

## Movement
Walk W1 "royal walk": slow dignified steps, chin up, cape sways. AI v3 frames as made, feet bob up to 3 px below the stand line kept (K1).
West mouth fixes (her pick F2): W f1/f2/f4/f5 had an open laughing mouth -> closed; W f4 face box (eye slash) replaced from the stand face.

## Files — `art-src/jaotungtong_1106/final/` (64x64 cells)
| File | Size | Layout | Timing |
|---|---|---|---|
| `jtt_sweet_stand_4dir.png` / `jtt_hungry_stand_4dir.png` | 256x64 | S, E, N, W | — |
| `jtt_sweet_walk_4dir.png` / `jtt_hungry_walk_4dir.png` | 384x256 | rows S, E, N, W × 6 frames | 160 ms |
| `jtt_sweet_eat_south.png` / `jtt_hungry_eat_south.png` | 512x64 | 8 frames, south only | 150 ms |

E and W = both AI true profiles (her pick ก, **no mirror**). N = AI as made (all-red cape back; the small mauve blob mid-cape kept, her T3;
E keeps the blue lining patch at the front foot, her P2). Eat = all 8 AI frames as made (her E3): raises snack, bites (snack visible f3–f4),
chews, **eyes open round in f7–f8** ("so tasty", like Mukmik) — loop shows an eye pop f8 -> f1, accepted.
Preview PNGs (`jtt_*_preview.png`) are animated PNGs (colour exact, >256 colours so not GIF); previews only, do not ship.

## Hungry state (her picks ข + P2 + faded cheeks) — theme "unripe wheat"
Story: hungry = his wheat antlers are not ripe yet (green); fed = they ripen back to gold. Part-by-part recolour:
antlers **green** (e3efb0 c9de8a b5cf78 9fbd66 80a052 5f7f42 4c6638, highlight eef5d2), fur **P2 pale beige** (e6dcc6 d4c6a6 bfae8e 9e8c70),
cheeks faded e3a69b, crown / cape / collar / trims / hooves / snack unchanged. Face: **frown** (S stand + all S walk frames get the same
locked hungry face; E/W stand corner down; side walk + eat frames keep their own mouths).
Scripts `art-src/jaotungtong_1106/scripts/`: `hungry_all.py` (per-direction antler zone + crown box, head offset per frame, hue-based maps
for AI colour variants), `build_hungry_walk.py`, `eat_hungry.py` (verified: frame 0 reproduces the approved hungry stand, 0 px diff outside the mouth).
Other scripts: `fix_a.py` (plum outline + fur swatches), `face.py` / `side_face.py` (H3 face), `fix_walk.py` (west mouth fixes).

## Source / history
- Her AI reference: golden deer king on a throne (wheat-ear antlers, gem crown, ermine collar, red/blue cape, necklaces, quill, treasure).
- Pixen 64x64 ×3 (3 cr): A dc6785cf (her pick) / B 3c2794d1 / C 1041e36f.
- PixelLab characters: `345db92a` "jaotungtong v1 (rotate)" (1 cr); `f368f9fa-b518-4b87-a514-df5d24978e5d` "jaotungtong v2 (import H3)" (0.25 cr, the one with the H3 face — use this for any future animation).
- Walk v3 group 9af44caa (4 cr), eat v3 group db991681 (1 cr). **Total 9.25 cr.**
