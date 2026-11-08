# Prompt for the code side — bag outside the phone + no text labels on HUD buttons (written 7 Nov 2026 21:5x, her OK on the mock 21:43; she sends it)

```
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

Follow CLAUDE.md: npm test, npm run validate, npm run test:e2e must pass. Then send screenshots from the REAL game
(desktop AND landscape phone size): yard in tool mode, yard in food mode with a dish picked (action button visible),
the bag opened from the new button, the phone home with 8 apps. Tell me the commit hash and push.
```

What it changes (for her): a pink backpack sticker at the right end of the tool bar opens the bag; the phone shows 8 apps (no bag, no settings inside); the food switch and the eat button show only pictures, no words.
