# Prompt to the code side: M7a art to replace the placeholders (her OK 2026-11-06 04:45)

Read `docs/m7a_art_2026-11-06.md` first; it has all the details. Art is on disk, not committed. Source: `art-src/m7a_ui_1106/`.

1. **Tiny food.** Replace `foodMoundKey()` with `public/assets/food/tray_mini/<recipe_id>.png` (32 files, about 9 px) on the tray plates and in the monster tower.
   - Anchor bottom-centre.
   - The tower step must use each image's height.
   - `strawberry_juice` has no art, so keep the mound for it only.
2. **Thought bubble.** For `plan.asks`, draw `public/assets/ui/thought_bubble.png` with `public/assets/food/mini16/<recipe_id>.png` centred at (13,13), instead of the speech-bubble text.
3. **Sulk.** On `monster.pout()`, show `public/assets/fx/fx_sulk_7.png` above the head (float + fade like `fx_heart_5`). Keep the shake.
4. **Place-food icon.** Action icon `tray` = `public/assets/ui/hud_v2/icon_place_food.png`, replacing the "…" box.
5. **Rules:**
   - Register everything in `assets-src/registry.json` (local, `jade_tone: false`).
   - Integer scale only; never resample.
   - Commit the art, `art-src/m7a_ui_1106/` and the doc.
6. **Check:**
   - Run the tests.
   - Phone screenshots in `docs/previews/code/`:
     - a full tray, 6 plates with different dishes
     - a monster carrying a tower of 3–5
     - a pout with the sulk mark
     - the thought bubble
     - the action button near the tray
