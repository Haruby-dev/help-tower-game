# วิ้งวิ้ง (floor 7, zone 1) — art spec 2026-11-06

Status: ART APPROVED by her 2026-11-06 20:07 ("ok"). Not in `public/` yet, no code prompt yet (zone 1 is sent all at once after floors 7–10).

## Look (her picks)
Shy fluffy moth-butterfly fairy: round cream fluffy body, paws pressed to the cheeks (shy), big round black eyes with a shine, pink blush,
tiny smile, two antennae made of green flower stems with pink flowers, a flower crown (lilac flowers + one pink centre flower),
yellow/pink petal collar, pink/lilac petal skirt, big **stained-glass wings** (3–4 flat pastel panes per wing: pink, sky blue, butter yellow, lilac).
Outline = gang rule: **dark plum #4a073e**, not black (pixen candidate ก1 was near-black #2b0023 -> recoloured, her pick A).
Size: 56x56 canvas (same as the twins), visible 52x46; she knows it is bigger than the others and accepted it.

## Movement
She is a flyer: **hover/flap instead of walking**, hand-made (0 cr). 6 frames, 140 ms, the whole sprite bobs up 0,1,2,2,1,0 px,
wings are split from the body and move inward 2 px + up 1 px at the top of the bob (sides: 1 px). Frame 6 = frame 1 (small rest, intended).
Use this sheet for walking in every direction.

## Files — `art-src/wingwing_1106/final/` (56x56 cells, feet/bottom line y=51 (last opaque row 50) on the stand)
| File | Size | Layout | Timing |
|---|---|---|---|
| `wingwing_sweet_stand_4dir.png` / `wingwing_hungry_stand_4dir.png` | 224x56 | S, E, N, W | — |
| `wingwing_sweet_hover_4dir.png` / `wingwing_hungry_hover_4dir.png` | 336x224 | rows S, E, N, W × 6 frames | 140 ms |
| `wingwing_sweet_eat_south.png` / `wingwing_hungry_eat_south.png` | 448x56 | 8 frames, south only | 150 ms |
| `*.gif` | — | previews only, do not ship | |

W = mirror of E (her pick; the AI west had an ear-like wing tip). N = as the AI made it (busier back wing panes, her pick).
Eat = AI frames as made (her pick): paws at the mouth, happy closed eyes f2–3, open-mouth bites f5–6, a pink snack appears only in f7–8.

## Hungry state (her picks)
Part-by-part recolour (her note: one tint over everything "looks like paint poured on"):
wings + lilac crown flowers = muted **sage green G1 (196,212,188)** frosted glass (panes still faintly visible);
petals/collar/skirt dusty pink; stems dry olive; fur and face almost unchanged; crown centre pink flower stays dusty pink.
**Grumpy face (her pick C)**: frown mouth + half-lidded eyes (flat lid line) on S; sides: lid line + small down-slanting pout; N has no face.
Eat frames keep their eating faces in hungry (recolour only). Matches the draft line "(ปีกขุ่น…)".

## Source / history
- Her AI reference: fluffy cream moth fairy with flower antennae, crown, petal collar/skirt, stained-glass wings, paws on cheeks.
- Pixen 6 cr: flowers ก (all layers) 0ca1fbe1 / 466f4239 / 13dd7d68, ข (reduced) 30537a0e / e3a1eb29 / 7ac05ed6 -> her pick ก1 (0ca1fbe1).
- PixelLab character `f90aaacc-4ef5-404c-b8ac-7b551a8580b9` "wingwing v1 (rotate)" (1 cr, 4 dirs; south = ก1 plum exactly).
- Eat: v3 custom group a658d6c0 (1 cr), 76x76 frames -> feet aligned, cropped (10,10,66,66).
- Total 8 cr (pixen 6 + rotate 1 + eat 1). Scripts in `art-src/wingwing_1106/scripts/` (seg/hover/hover_all, hungry_final, eat_hungry, frown, gifkit).

## Related change the same day: gang outline rule
Outline for all zone-1 monsters = dark plum (#4a073e family). Fixed outliers 0 cr: Mukmik (too light; outer silhouette only, face kept)
and Tumtia (brown-red, all line pixels) -> `art-src/outline_fix_1106/` (drop-in replacements, same file names). Send with the zone-1 delivery.
