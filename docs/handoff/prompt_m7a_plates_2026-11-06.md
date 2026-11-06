# Prompt to the code side: blue-grey plates (D1) for tray + tower, flat tanghulu (her OK 2026-11-06 14:18)

Details: `docs/m7a_art_2026-11-06.md` section 5. The art is on disk, not committed.

1. **Tower above the head:** use `public/assets/food/tower_plate.png` (13×6) instead of `miniPlateKey()`, and the `tray_mini_<recipe>` image instead of `foodMoundKey()`. This replaces your 05:35 change; her latest pick is the D1 plate with tiny food.
   - Stacking:
     - The food's bottom sits 3 px up from the plate's bottom, inside the rim.
     - The next plate rests on the top of that food (1 px overlap).
     - The step follows each food image's height.
   - **Keep the current gentle wobble.**
   - `strawberry_juice` still uses the mound.
2. **Trays:** new `world/yard/food_tray_3/6/10.png`. Point their registry `source` to `assets-src/art_2026-11-06/yard/food_tray_*_d1.png` and set `jade_tone: false`. They are already toned, so do not tone them again. Plate positions are unchanged.
3. **Replaced files:**
   - `ui/shop/items/tray_6.png` and `tray_10.png`
   - `ui/hud_v2/icon_place_food.png`
   - `food/tray_mini/strawberry_skewer.png`: now 12×4, lying flat
4. **Commit** the art, `art-src/m7a_ui_1106/plates_d1/` and the doc. Integer scale only.
5. **Check:**
   - Run the tests.
   - Redo `docs/previews/code/m7a_1_tray_6_plates.png` and `m7a_2_tower.png` (with a tanghulu tower of 3–5 and a kaprao tower).
