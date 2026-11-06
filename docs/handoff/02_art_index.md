# 02 — Art index (where things are and how they were made)

All paths are relative to the project root. Each delivery has a doc in `docs/`; read that doc for details.

## Farm
| Asset | Location | Doc |
|---|---|---|
| Crops 48×64 | `public/assets/farm/crops48/` | `farm_crops48_2026-11-02.md` |
| Farm UI | `farm/ui`, `ui/toolbar`, `ui/bag`, `farm/icons_bag`, `farm/fx` | `farm_ui_art_2026-11-02c.md` |
| Player anims | `farm/anims/{till,water,plant,harvest,cook}_{south,east,north}.png` (792×88, 9 frames of 88; west = mirror) | — |

## World
- Pond v6 + trees style C: `docs/water_and_trees_2026-11-03.md`; tree masks in `public/assets/world/fx/trees/`.

## Phone UI
- `public/assets/ui/phone_v3/`. Doc: `art_final_phone_v3_withered_2026-11-02.md`.

## Food
| Asset | Location | Notes |
|---|---|---|
| Dishes | `public/assets/food/dishes/<recipe_id>.png` (48) and `dishes_bag/` (≤32, bag size) | — |
| Desserts | `food/desserts/` (48) and `desserts_bag/` | Chest/dessert design: `chest_and_desserts_2026-11-02.md` |
| Ingredients | `food/ingredients/<id>.png` (32) and `ingredients_mini/<item_id>.png` (16) | — |
| Economy | `docs/economy_balance_2026-11-02.md/.json` | — |

## Recipe book v4
- `public/assets/ui/book/*_{savory,sweet,drink}.png` + `book_light_16f.png` + `book_dish_*_8f.png` + deco `_8f` sheets.
- Doc: `m4_recipe_book_v4_2026-11-03.md`. Steps: `src/data/recipe_steps.json`.

## Title
- Logo: `public/assets/ui/title/logo_floor_flavor(_8f).png`, `logo_tagline_th.png`.

## Source and art files (`art-src/`)
- `art-src/book/`: Krita `.kra` files plus older book drafts. The kaprao painting layers (unused) are in `kaprao_bg/`.
- `art-src/gio_v2/`: new Gio sprites (see `01_status`).
- `art-src/scripts/`: the Python scripts that made the procedural art. Re-run them to tweak colours or sizes.

| Script | Makes |
|---|---|
| `theme.py` + `mock6.py` + `anim_deco.py` + `dish_fx.py` | Recipe book v4 |
| `logo3.py` | Logo |
| `bagdown.py` | Downscaling to bag-icon size (area resample + palette snap + re-outline) |
| `light.py` + `paint.py` | Sunlight animation + kaprao painting |

Fonts for mocks: `public/assets/fonts/Mali-*.ttf`.

## Added 2026-11-05 (planning/art chat)
| Asset | Location | Doc |
|---|---|---|
| Gio v2 consistent body (stand4, walk4 ×4 dirs, sit with bigger bag), lick animation, heart/sparkle fx | `characters/gio_v2/`, `fx/` | `docs/m6_art_2026-11-05.md` |
| Talk icon, paw coin, Gio talk dialog parts, receipt parts | `ui/hud_v2/`, `ui/coin_paw_12.png`, `ui/gio/` | `gio_talk_dialog_*`, `gio_sales_summary_*` |
| Shop shelf icons (17) | `ui/shop/items/` | `m6_art_2026-11-05.md` §7 |
| Pet homes (real, from 10-31) | `art-src/pet_homes_1031/` (+README with PixelLab gallery ids) | — (M8) |
| Pets (characters) | PixelLab: kai_pok, nueb_nub, boom_boom, bubble, mumu_mek | `docs/art_update_2026-11-01.md` §6 |
| Star badge, fertilizer twinkles, fertilizer bags | `ui/badges/`, `farm/fx/fx_fert*`, `farm/fertilizer/`, `ui/shop/items/fertilizer_*` | `docs/star_system_2026-11-05.md` §6 |

## Monsters (M7)
- Puinun: art-src/puinun_1105/final/ (sweet+hungry, stand/walk 4 dir, eat S), PixelLab char a96f8797. Spec docs/puinun_art_2026-11-05.md
- Popcorn: art-src/popcorn_1105/final/ (sweet+hungry, stand/hop 4 dir, eat S), PixelLab char 2f9e4f81. Spec docs/popcorn_art_2026-11-05.md
- Mukmik: art-src/mukmik_1106/final/ (sweet+hungry, stand/hop 4 dir, eat S), PixelLab char cc900415. Spec docs/mukmik_art_2026-11-06.md
- Tumtia: art-src/tumtia_1106/final/ (48x48 canvas; sweet+hungry, stand/walk 4 dir (asymmetric, no mirror), eat S), PixelLab char 546bf680. Spec docs/tumtia_art_2026-11-06.md
- Hangkradueng (TWINS): art-src/hangkradueng_1106/final/ (56x56 cells; a_full / b_full / hungry × stand+walk 4 dir, eat S), PixelLab char 5cca140c. Spec docs/hangkradueng_art_2026-11-06.md
- Hangkradueng reveal/tease: art-src/hangkradueng_1106/reveal/ (shake-off reveal 20f, twin A giggle+run, happy jump a/b)
- Twin wind chime (floor-5 quiz reward deco, neutral name deco_bell_chime): art-src/twin_chime_1106/final/ (48x64 still + 8f sway 180 ms). Spec docs/twin_chime_art_2026-11-06.md
- Yai Bai Mai (floor 6): art-src/yaibaimai_1106/final/ (48x48; sweet+hungry × stand/walk 4 dir (asymmetric, no mirror), eat S), PixelLab char bedda946. Spec docs/yaibaimai_art_2026-11-06.md
- Wingwing (floor 7): art-src/wingwing_1106/final/ (56x56; sweet+hungry × stand/hover 4 dir (W = mirror of E), eat S), PixelLab char f90aaacc. Spec docs/wingwing_art_2026-11-06.md
- Outline fix (gang rule = plum outline): art-src/outline_fix_1106/ (Mukmik + Tumtia, drop-in replacements)
- Tubpong (floor 8): art-src/tubpong_1106/final/ (56x56, bottom y=55; sweet+hungry × stand/slide 4 dir (W = mirror of E), eat S), PixelLab char f258cf58. Spec docs/tubpong_art_2026-11-06.md
- Jaotungtong (floor 9): art-src/jaotungtong_1106/final/ (64x64, last row y=59; sweet+hungry × stand/walk 4 dir (E and W both AI, no mirror), eat S 8f), PixelLab char f368f9fa (H3 face). Spec docs/jaotungtong_art_2026-11-06.md
- Puefaotung (floor 10): art-src/puefaotung_1106/final/ (64x64, last row y=60; sweet+hungry × stand/hop 4 dir (no mirror, bird on one shoulder; hungry = no bird), eat S 8f), PixelLab char 3ee5b78a. Spec docs/puefaotung_art_2026-11-07.md
- Compost bin (ถังหมักปุ๋ย, Yai Bai Mai 100% reward): art-src/compost_1107/final/ (48x48; compost_bin.png repaired + compost_bin_broken.png). Spec docs/compost_art_2026-11-07.md
