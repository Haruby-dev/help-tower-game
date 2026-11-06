Read docs/handoff/00_rules.md and 01_status.md first (the 2026-11-04 notes at the end explain everything below). Two parts: (A) the new HUD art she approved, (B) her bug list. Do NOT push; commit locally and wait for her "ส่งขึ้นเลย". Report back in Thai.

Before you start: also run the skin-source fix from docs/handoff/prompt_skin_sources_2026-11-04.md if you have not done it yet.

## A. New HUD art (approved, all in art-src/ui_buttons_1104/)
Copy what you need into public/assets/ui/hud_v2/ and register it. Native size, nearest-neighbour, integer zoom only, never scale a single sprite. Mocks of the target look are in art-src/ui_buttons_1104/mocks/ and approved_full_mock.png.

1. Run button: replace with run_button_off.png / run_button_on.png (64x64, same place and size as now). "on" = while running. No animation.
2. ONE context action button (replaces the white "ตกปลา" box and the big "ริมบ่อ" popup):
   - Frame action_button_frame.png (48x48), pressed state action_button_frame_pressed.png. Place it left of the run button, bottom-aligned with it, ~6 px gap.
   - Icon = action_icons/icon_<x>.png centred in the frame (or use the ready-made action_icons/action_<x>.png). x = fish, bath, water, till, plant, harvest, cook, sleep, chest.
   - Label: a pink pill under the button (plum #5c304c outline, fill #f8789a, white Thai text, e.g. "ตกปลา"), overlapping the frame bottom by ~6 px like the mock.
   - The icon depends on where she stands AND what she holds. At the pond: holding the rod → fish; otherwise → bath. Nothing to do → hide the button.
3. Fishing rod goes into toolbar slot 5 (key 5). When the rod is selected, a small bait strip pops up above the toolbar (mock ui_rod_slot_bait_strip_1104.png): one slot per bait type (tool_slot / tool_slot_selected style), the bait's real item icon (items/bait_*.png), a count "x5" bottom-right, empty baits greyed out. Tap a bait to choose it; remember the choice. Bug to fix here: the current popup shows the corn CROP icon for corn bait instead of items/bait_corn.png.
4. Toolbar: tool_tray_5slots.png (230x48, or build it from tool_tray_9slice.png), tool_slot.png / tool_slot_selected.png (42x37), key_badge.png (10x10 coin, draw the number with code). Tool icons: draw farm/tools/*.png at NATIVE size, centred. Right now the toolbar shrinks them by a non-integer factor (watering_can 38 px drawn at ~25 px) which breaks our pixel rule. If an icon does not fit a slot at native size, tell me which one instead of scaling it.
5. Portrait frame (top-left): portrait_frame_empty.png (46x46, SAME size and position as the old frame). Clip the 41x30 portrait with portrait_frame_inner_mask.png, bottom-aligned ~6 px above the frame bottom. Her rule: the frame must NOT cover the gauge dots. Keep the dots exactly where they are (measured gap frame→dots = 2 px).

## B. Her bug list
1. Watering: water looks like it comes out of her mouth. Cause: BaseScene.ts ~line 669 spawns code drops from feetY − PLAYER_HEAD_PX/2 for every direction. The water_east / water_north / water_south art already has the water pouring from the can baked in (west = mirror of east). Remove the travelling code drops; keep at most the small splash on the plot.
2. Fishing (her decision): auto-fish must be slower and able to miss. Manual fishing stays the best way.
   - Auto-fish: wait about 1.5x longer than manual, and catch about 65% of bites (a miss = fish escapes, bait kept, same as a manual miss).
   - Add a toggle "ใช้เหยื่อเดิมต่ออัตโนมัติ" (shown when Auto-fish is on): after each cast, re-bait with the same bait until it runs out, then stop and show a short message.
   - Bobber rhythm must be the same every time, manual and auto: nibble 1-2 times (6 fps), then bite (8 fps, hold the last frame). Right now the timing varies and looks jumpy.
3. Gio is still the old version. The new Gio v2 art is finished and approved: see 01_status.md "Gio v2 final" (PixelLab character dd58cae2-…, local files in art-src/gio_v2/: walk4s/walk4n/walk4e sheets 480x76 = 8 frames of 60x76 bottom-aligned, idle_blink_sheet, faces, sleep poses). Switch the game to it and tell me anything missing.
4. Opening the phone apps, the recipe book and other UI is not smooth: pieces appear one by one and lag. Preload all UI textures at boot (many registry entries are "lazy": true) and show a panel only when all its pieces are ready (or fade the whole panel in at once).
5. (Covered by part A.)
6. Actions do not lock movement: pressing move cancels the action, and for the bath she has to stand still by herself. For EVERY action: lock movement while it runs; to cancel, press the same action button again.
7. PC only (not on her phone): walking to the right area below the restaurant, a thin white line appears. Probably a texture seam / sub-pixel gap at the PC zoom. Find and fix it.
8. (Covered by part A, item 3.)

9. Seeds (her decision, replaces the old convert system):
   - Remove "convert produce to seeds" from the bag. Keep it ONLY as a one-time day-1 tutorial step: Gio shows her how to turn the starter market produce into seeds so she can start planting. After that step the convert option is gone for good.
   - IMPORTANT: the shop is M6. If the seed shop does not exist yet, keep the convert option working until it does (otherwise she cannot get seeds at all), and say so in your report.
   - Starter crops (scallion, chili, basil, tomato, garlic, rice) are sold in the shop EVERY day (staples, outside the random daily picks). TEMP seed prices, same rule as the current shop crops (single harvest = 1x the produce price, regrow = about 3.5x): scallion 8, garlic 8, rice 10, chili 30, basil 30, tomato 35. Balance pass in M10 (she likes an expensive, slow economy like SoS Grand Bazaar; note it, do not change other prices now).
   - Shop crops: seeds from the shop only (as now).
   - Gate crops (M8): first seeds from the gate reward, then the shop sells them once that gate is open.
   - Harvest seed drop: each harvest has a 10% chance to also give 1 seed of that crop. Put the chance in balance.json. Later the gardener rank C skill raises it to about 33% plus a chance of a quality seed (skills are not built yet, just keep the number configurable).

Run the tests, commit locally, wait for "ส่งขึ้นเลย". Report in Thai: what you changed, anything that did not fit at native size, and anything that did not match the art or this prompt.
