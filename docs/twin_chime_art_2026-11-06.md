# Twin wind chime (floor-5 quiz reward decoration) — art spec 2026-11-06

Status: ART APPROVED by her 2026-11-06 14:42. Not in `public/` yet, no code prompt yet.

## What it is
Reward for guessing the twins correctly in the floor-5 reveal scene (see GDD "แฝดขี้แกล้ง").
In-game name (Thai): **กระดิ่งลมแฝด**. A placeable yard decoration: pink pastel flower pot with tiny daisies,
a curved honey-coloured twig, light blue ribbon bow, two round jingle bells (straw = older twin A, lilac = younger twin B),
two ribbon tails and a four-leaf-clover charm. Happiness bonus per day: TBD (decoration range +1..+10).

File names are neutral (`deco_bell_chime`) so the twin secret does not leak from game files.

## Files — `art-src/twin_chime_1106/final/`
| File | Size | Notes |
|---|---|---|
| `deco_bell_chime.png` | 48x64 | still / rest pose. Content bbox x6–45, y3–59. Anchor = pot bottom centre ≈ (18, 59) |
| `deco_bell_chime_sway_8f.png` | 384x64 (8 × 48x64, left→right) | idle sway loop, **180 ms per frame**, loops forever. Pot, twig and bow are static; bells swing ±1 px, ribbon tails/clover follow one frame later ±2 px |
| `preview_sway_scene.gif`, `preview_sway_frames.png` | — | previews only, do not ship |
| `sway.py`, `wood.py` | — | scripts (sway frames; twig recolour) |

Scale: integer nearest-neighbour only, same scale as other yard decor (restaurant decor is ~40x55).

## Source / history
- Base: PixelLab pixen job `ed749415-06dd-49e1-9611-72296ee2a512` (design "B" of 5, her pick).
- Twig recoloured to honey (her pick ค) = same family as the yard table: dark `#b07a45`, mid `#d29a5c`, light `#eebd7e`.
- Drafts (hand-drawn A/B/C, arch pixen c2c67761, 5 pixen designs, 5 wood swatches): `art-src/twin_chime_1106/`.
- Cost: 6 PixelLab credits (1 arch + 5 designs), sway + recolour 0.
