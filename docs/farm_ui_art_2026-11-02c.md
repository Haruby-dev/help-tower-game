# M3 farm UI + effects art (planning side, 2026-11-02 evening, 0 credits)

The planning side looked at the M3 build (commit 167d32b) and made final art for the placeholders. All PNGs are 1x; integer nearest-neighbour scaling only. Previews: `docs/level/2026-11-02/` (opt_B_cursor.png, tb3_zoom.png, bag_unfold_crop.png, fx_demo.gif).

## 1. Plot soil — user picked "option B"
Files in `public/assets/farm/ui/`:
| file | use |
|---|---|
| soil_tilled.png 32×32 | tilled plot with NO crop, dry. Replaces the code-drawn furrows. |
| soil_tilled_wet.png 32×32 | tilled plot with NO crop, watered. |
| soil_damp.png 32×32 | planted AND watered: wet patch drawn under the crop (crop mound sits on it). |
| plot_cursor.png 64×32 | target cursor, 2 frames (32×32 each), loop ~2 fps. Replaces the 1px white rect. |
Rules:
- Planted plot: hide the tilled bed; show only the crop sprite (its own mound) on the yard soil. Planted + watered → also show soil_damp under it.
- Stop tinting the ground tile for wet soil.
- Unwatered growing crops keep the Zzz (now a sprite, see 4).
- The 4×4 plot grid is not centred in the yard soil: there is a spare column on the left. Please shift `plotOrigin` so the grid sits in the middle of the soil area (check visually).

## 2. Toolbar — `public/assets/ui/toolbar/`
- tool_tray.png 16×16, 9-slice 6px: pink cushion tray behind the slots (same feel as the joystick cushion).
- tool_slot.png / tool_slot_selected.png 16×16, 9-slice 5px. Selected slot is pink and lifted up by 3 px-units.
- key_badge.png 9×9: number badge 1–4 at the top-left of each slot (Mali, plum text).
- count_pill.png 10×10, 9-slice 4px: yellow count pill at the bottom-right of the seed slot.
- Tool icons are drawn at **2×** inside the slots (they were too small).
- The seed slot shows the **selected seed bag** (`farm/seeds/seed_<crop>.png`) instead of the generic bag, with its count.

## 3. Bag app — `public/assets/ui/bag/`
- **The bag opens the phone UNFOLDED** (like other big apps). Layout: 6 columns × 5 rows = all 30 slots, no scrolling; slot 36 px-units; a detail card on the right (item at 2×, name, count, short flavour text, buttons "แปลงเป็นเมล็ด" and a disabled "ใส่ถาดขาย" placeholder for M6).
- Header: back, "กระเป๋า", tabs ทั้งหมด / เมล็ด / ผัก / ของ, and a used/total count pill (e.g. 11/30).
- bag_slot.png, bag_slot_selected.png, bag_slot_empty.png 12×12, 9-slice 4px. tab.png / tab_active.png 12×12, 9-slice 5px.
- Count number: bottom-right, Mali, plum with a 2px white stroke.
- **Bag icons:** use `public/assets/farm/icons_bag/<crop>.png` (sparkles removed so they fit the slot). Keep the sparkly `farm/icons/` for the detail card, harvest arc and other places.
- Bug seen while testing the build: tapping the กระเป๋า icon on the phone home screen did not open the app (phone.dataset.app stayed empty). Please check.

## 4. Effects — `public/assets/farm/fx/` (replace the 2px rectangles)
| file | frames | use |
|---|---|---|
| fx_dirt.png 16×4 | 4 clods, 4×4 each | dirt puff on till/plant |
| fx_water.png | drop 3×5 at x0; splash frames 7×5 at x5 and x12 | drops fall from the can; 2-frame splash on the soil |
| fx_sparkle.png 28×7 | 4 frames 7×7 | twinkle on wake-up, harvest trail, ready crops |
| fx_zzz.png 44×18 | 2 frames 22×18 | sleeping crop (replaces the "Zzz" text), alternate ~3 fps |
| fx_pop_pill.png 12×12 | 9-slice 5px | "+1 <name>" popup: white pill with the item icon on its left, text inside, floats up and fades |
