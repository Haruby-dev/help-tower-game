# Prompt for the code side — phone update 2026-11-07c (written 7 Nov 16:4x; she sends it after OK)

```
Phone update from the planning/art side (2026-11-07c). The user approved it. Read docs/phone_update_2026-11-07c.md.
Mocks: art-src/phone_ui_1106/shots/phone_top_margin_after_full.png and phone_noflip.png.

1. Card paper: replace the dotted CSS paper (phone.css .pl-card ~line 313 and .pz ~line 423:
   "#fffaf4 radial-gradient(circle, #f0dfe8 1.6px, transparent 2px) 0 0 / 24px 24px") with the NEW tile
   public/assets/ui/phone_v3/paper_glass.png (40x40, white with alpha = frosted glass). No solid colour under it:
   the phone's sky gradient must show through. Tile it at the same scale as the app icons (1 art px = 2 css px
   inside the zoom-1.5 window -> background-size 80px 80px there; use the equivalent UI px scale elsewhere),
   image-rendering: pixelated. Register the asset as usual.

2. Medium phone window: make both cards reach up over the top band so the top margin equals the side/bottom
   margin (in the mock: window 1860x896, cards top 66 -> 26, height 804 -> 844). The paper covers the whole card.
   Keep every app's content where it is now (offset the content down by the same amount; only the paper grows up).
   The status strip (game time left, no-signal + battery right) stays where it is, now drawn on top of the cards.

3. Remove the flip button (↻ 'phone-flip') and the phone back side (createBack, flipSide, FLIP_MS, related CSS and
   texts). The right card keeps only ⇆ (fold) and ✕ (close).

4. Remove phone cases as items: cosmetics case_pink_cat / case_mint / case_gio, equipped.case and owned.cases in the
   state + schema (old saves must still load: drop the fields quietly), the 'cases' slot in the bag/inventory.
   Do not delete the case art files.

5. Chests (src/data/chests.json): remove the cosmetics rows case_mint, case_gio, wallpaper_gio, all charm_* (6) and
   all clip_* (4). Keep can_mint, can_lavender, can_yellow, can_peach. Halve the cosmetics category chance:
   wooden 0.08 -> 0.04, silver 0.15 -> 0.08, golden 0.35 -> 0.18, and give the freed share to the other categories
   proportionally (totals unchanged). Make sure the rarity roll still works now that the cosmetics pool has no
   "common" or "rare" items. Keep the charm/clip/wallpaper entries in cosmetics.json (phone decorating is only on hold).

Do not change any art yourself. When done, tell me the commit hash and send screenshots of the phone home
(medium window), the lock screen and the bag (no case slot).
```

What it changes (for her): the phone cards become frosted glass with a soft gingham, reaching up to the top with even margins; no flip button and no phone back; no phone cases; chests only drop watering-can colours as cosmetics, half as often.
