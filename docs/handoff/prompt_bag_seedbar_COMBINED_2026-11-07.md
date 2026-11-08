# Combined prompt (bag outside + no labels + seed bar), given to her 2026-11-07 21:5x

```
Two changes from the planning side (both approved by her 2026-11-07). Do A, then B, one commit each.

=== A ===
Fix 2026-11-07 (planning side). Two of her decisions were lost in prompt_phone_ui_2026-11-07.md; this puts them back.
Mock (real game capture): art-src/bag_outside_1107/bag_outside_mock.png (+ yard_bag_after.png, home_8apps_after.png).

1. BAG BUTTON OUTSIDE THE PHONE (her decision 2026-11-06 19:35, spot B picked 19:40; the 07 Nov phone prompt
   wrongly kept the bag as a phone app).
   - New HUD button #bag-button at the RIGHT END of the tool bar, just after the tray, in BOTH tool mode and food mode
     (in food mode it sits after the › page tab). Icon = ui_app_bag as a die-cut sticker, built exactly like
     #settings-button / #arrange-button (same stickerIcon, same white cut line and shadow, same visual size as the
     settings sticker). Add it to the phone-wide HUD list in phone.css line 9 like the others.
   - Tap = open the existing bag page (createInventoryPage) in the same medium glass window it uses today.
     Nothing inside the bag changes. Keep the keyboard keys as they are now.
2. PHONE HOME = 8 APPS. Remove 'inventory' and 'settings' from APPS in src/ui/phone.ts.
   Order: wallet, shop, recipes, album / pets, gate, mail, support -> two rows of 4, top-aligned like today.
   Settings stays reachable only from #settings-button (already outside the phone; today it is in two places).
3. NO TEXT LABELS ON HUD BUTTONS (her rule 2026-11-04 23:04 "no label under the action button, for all actions",
   repeated by her 2026-11-07; the eat-from-tool-bar prompt broke it):
   - remove the visible mode label under the tool/food switch (.toolbar-mode__label "อาหาร" / "เครื่องมือ");
     the switch keeps only its icon (spoon_fork in tool mode, hoe in food mode).
   - remove the visible "กิน" label on the action button (eatLabel / .action-button__label); the button keeps the dish icon.
   - keep every aria-label. Do not add visible text to HUD buttons in future changes; icons only.
4. Commit fb050c5 (M7 visits) is not pushed yet: push it together with this change.

=== B ===
Seed bar (planning side, approved by her 2026-11-07). Mock on a real game capture: art-src/seed_bar_1107/seed_bar_S2_mock.png
(bottom row = new). Her problem: changing the seed type is slow (popup every time, seeds and fertilizer mixed, long list).

1. In tool mode, tapping the seed-bag slot (tool 4) now switches the WHOLE bar to a SEED BAR, the same way the
   food switch makes the food bar. Remove the seed-picker popup (createSeedPicker / .seed-picker*).
2. Seed bar = same tray, 5 slots, same look as the food bar:
   - items = every seed in the bag, then every fertilizer after the seeds (same bar; seeds in crops.json order,
     then fertilizer_2, fertilizer_3). Icon = the item's own bag icon (seed_<crop> / fertilizer art) at the same size
     the food bar uses, count ×N bottom-right like the food bar, no star badge for these items.
   - the › tab on the right end pages when there are more than 5. Keys 1-5 pick.
   - tapping a slot = gameState.setSelectedSeed(...) exactly like the old popup did; the chosen slot is pink.
   - the selected tool stays 'seeds' the whole time, so the action button plants / fertilizes as today.
3. The round switch on the left of the tray shows the hoe icon in seed mode (same as food mode). Tap = back to the
   tool bar with the seed-bag tool still selected. The food bar is only reached from the tool bar.
4. After planting, STAY in the seed bar (so she can plant many plots). When the chosen seed runs out, select the next
   item in the seed bar; if nothing is left, show empty slots and keep the bar open until she taps the switch.
5. No visible text anywhere on these buttons (her rule: HUD buttons are icons only); keep aria-labels.
6. The bag sticker from A sits at the right end of the tool bar in the seed bar too (after the › tab).

Follow CLAUDE.md: npm test, npm run validate, npm run test:e2e must pass. Then send screenshots from the REAL game
(desktop AND landscape phone size): yard in tool mode, food mode with a dish picked (action button visible), the bag
opened from the new button, the phone home with 8 apps, seed bar page 1 with a seed picked, seed bar page 2
(fertilizer), planting a plot from the seed bar. Tell me both commit hashes and push.
```
