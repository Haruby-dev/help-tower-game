# ยายใบไม้ (floor 6, zone 1) — art spec 2026-11-06

Status: ART APPROVED by her 2026-11-06 17:34. Not in `public/` yet, no code prompt yet (zone 1 is sent all at once after floors 6–10).

## Look (her picks)
Kind granny tree spirit: round chubby light-caramel body, cream belly, **small sleepy closed eyes**, rosy cheeks, small wooden-knot nose,
**mint moss shawl** on the shoulders (NO beard, NO moustache — she rejected those as "not grandma"),
leaf crown (green + orange leaves, peach flowers, 3 blue berries). Holds a wooden cane with a **ladle bowl at the bottom**
in her RIGHT hand (quiet clue: the heroine's grandma was the previous chef).
Asymmetric sprite: cane visible S/E/N, hidden behind the body facing W. Keep all 4 directions, never mirror.

## Files — `art-src/yaibaimai_1106/final/` (48x48 cells, feet line y=45 (last opaque row 44), same canvas as Tumtia)
| File | Size | Layout | Timing |
|---|---|---|---|
| `yai_sweet_stand_4dir.png` / `yai_hungry_stand_4dir.png` | 192x48 | S, E, N, W | — |
| `yai_sweet_walk_4dir.png` / `yai_hungry_walk_4dir.png` | 288x192 | rows S, E, N, W × 6 frames | 160 ms |
| `yai_sweet_eat_south.png` / `yai_hungry_eat_south.png` | 384x48 | 8 frames, south only | 150 ms |
| `preview_*.gif` | — | previews only, do not ship | |

Hungry state = theme "dry autumn": crown leaves grey-dry, flowers/orange leaves faded, berries shrivelled plum, moss shawl grey-sage.
Eyes stay closed in both states. Script `hungry.py` (crown/shawl split by per-direction row threshold).

## Source / history
- Her reference: round owl-like elder with beard, leaf crown, blue berries, twig staff ("like this, but change the face").
- Pixen round 1 (3 cr) rejected (beard + moustache = grandpa). Round 2 (3 cr) moss shawl → candidate D (job dbead105) picked.
- D1 hand fix (0 cr): grey forehead band removed, ladle bowl added at the cane foot.
- PixelLab character `bedda946-9ca7-4ef5-b2ff-98ae8eb23067` "yai bai mai v1 (rotate)" (1 cr, 4 dirs; south = D1 exactly).
- Walk: v3 custom group 339cac5d (4 cr). Hand fixes: east f3–6 open eye → closed lid; west f5–6 popping cane removed.
- Eat: v3 custom group 49c153c8 (1 cr), used as AI made (nose missing in f2–8, f6 odd wink face: accepted).
- Total 12 cr (round1 3 + round2 3 + rotate 1 + walk 4 + eat 1).
