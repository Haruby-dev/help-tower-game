Read docs/handoff/00_rules.md, 01_status.md and docs/m5_art_2026-11-04.md first. The M5 art doc is the source of truth for every art file, frame range and coordinate below. Where it has an older note and a newer "fix (approved 2026-11-04)" note for the same file, the newer note wins.

Build M5 (fishing, bait, weather, bath, chests) from your M5 plan, with her 4 decisions (all approved):
1. Fishing = cast → wait for a nibble → "!" → tap within ~1 s. A miss loses the fish but keeps the bait. Add a Settings toggle "Auto-fish".
2. The bamboo rod is owned from the start (crafting comes in M9).
3. TEMP starting items: 5 corn bait + 5 cloud-lettuce bait (swap for gate rewards in M8).
4. Chests are in M5. Items with no system yet are stored as save flags.

Art is finished and approved. Use the real files instead of the coloured-box placeholders:
- Fish: public/assets/fish/fish_<id>.png (32×32, 8 fish). 16 px minis for the recipe strip: food/ingredients_mini/ing_fish_<id>.png. Minis are trimmed, so centre each one in its 16×16 slot (the catfish mini is 16×12).
- Items: items/bait_normal, bait_corn, bait_cloud_lettuce, chest_wooden, chest_silver, chest_golden, toy_* (5), salt_tower_pink.
- Cosmetics: cosmetics/charm_* (6), clip_* (4), watering_can_* (5, drop-in replacements for farm/tools/watering_can.png; pink is shop-only).
- **The outfit set cosmetics/outfit_* (5 files) is ON HOLD. Do NOT put it in any chest loot table yet.** The outfit-skin design is parked and the set may be replaced.

Girl poses (farm/anims/, 792×88, 9 frames of 88×88, same pivot as the farm anims; west = mirror of east):
- fish_east: play 1→8 once, then loop 7–8 at ~3 fps while waiting.
- fish_south: play 4→8 once (frames 3 and 4 are identical), then loop 7–8.
- fish_north: play 3→8 once, then loop 7–8.
- The rod is baked into the frames. Don't draw the old code rod. Draw only the fishing line, from the per-frame rod-tip coordinates in the art doc (for west, mirror x → 87−x) to the bobber's antenna tip.
- wash_south (bath at the pond, any facing): play 0→8 once, then loop 2→8 for the whole 30 game-min bath. Draw the code bubbles and sparkles on top.

Bobber (fx/bobber_idle_4f, _nibble_4f, _bite_4f, 16×16 frames):
- Put the water-line point (8,11) on the water surface at the cast spot.
- The antenna tip moves each frame. Attach the line to the tip of the current frame (list in the art doc).
- Playback: idle loop ~4 fps; nibble 1–2 times at 6 fps before the "!"; bite once at 8 fps, then hold its last frame. On catch or escape, hide the bobber and reel the line in with a short tween.

Chest opening:
- The chest shakes ±1 px for 0.4 s.
- Then fx/chest_open_burst_6f.png plays once (now 6 frames of 44×44, ~12 fps), centred on the chest.
- Then the items pop out one by one.
- There is no lid-open sprite.

Same rules as always: native pixel size, nearest-neighbour, integer zoom only, no scaling of single sprites. Run the tests, then commit locally and wait for her "ส่งขึ้นเลย" before pushing. Report back in Thai: what you built, what still uses placeholders, and anything that didn't match the art doc.
