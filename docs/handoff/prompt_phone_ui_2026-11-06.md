# ON HOLD — DO NOT SEND. Her rule (2026-11-06 19:17): finish ALL phone UI first (app icons, every app page) and wait until SHE asks for the prompt. This draft is only a starting point.

```
Phone UI redesign (approved by her 2026-11-06) + strawberry juice art.

Read first: docs/phone_ui_2026-11-06.md (full spec). Source of truth = the HTML mocks it lists in
art-src/phone_ui_1106/mock_src/ (open them in a browser at 2796x1290) and the shots in art-src/phone_ui_1106/shots/.
The mocks are plain HTML/CSS, so copy the CSS (case, glass frame, cards, tape, stickers) instead of re-inventing it.

1. Phone = smartphone with a thin clear GLASS frame, no crease, no hinge (src/ui/phone.ts + src/ui/styles.css).
   - Sky wallpaper runs under the glass; the frame is a clear band with a sharp inner edge, no screen-edge line,
     white rim + top-left glint + short top-right reflection, lavender base thickness. Real CSS curves only.
2. Sizes: folded lock = the current small phone. Home and EVERY app open in ONE medium window
   (~67% x 69% of the viewport, 1860x896 on 2796x1290), centred: a status strip on top, then two paper cards on the sky.
   This replaces the 88% "big" app window. Opening = the phone grows smoothly into the medium window;
   fold = shrink back. Hide the HUD while it is open. The folded phone must not overlap "จัดวาง".
   Icons stay integer nearest-neighbour; keep the icon-to-window proportion of the mocks.
3. Theme "sticker planner": dotted paper cards, plum ink #8a5a7c, pink accent, titles on washi tape,
   no outline stroke on body text, die-cut sticker outlines.
   - Status bar (CSS): game time left (medium window only), NO-SIGNAL icon (4 faded bars + small pink ×,
     story: stuck in the tower) and a decorative battery pill on the right. Lock shows no-signal + battery only.
   - Lock: lock_S3A.html.
   - Home: home_status_A.html. 11 apps on round pastel sticker plates in rows 4-4-3 (wallet joins the grid,
     no dock; the old Gio grid widget is dropped, a mini Gio sits on the tasks card). Right card: date stamp,
     weekday, month, weather, week strip, today's tasks (paw stamp when done), stuck counter + floor ribbon.
   - Bag: bag_status_A.html (+ bag_B_mid_chest.html / bag_B_mid_produce.html for the button spot).
     Right card is info only. Keep ONE small button only for: chest = เปิดหีบ, produce = ทำเหยื่อ,
     cosmetics = ใช้แบบนี้. REMOVE the ใส่ถาดขาย button (selling = the ฝากจีโอขาย window).
     KEEP the กิน button for now (eating will move to a tool slot in a later change).
   - Other apps: same window and cards, keep their current inner content, just fit it. Tell me if one does not fit.
   - All new player-facing text goes to src/i18n/th.json.
4. Strawberry juice (new dish, art approved): copy the 4 files from art-src/strawberry_juice_1106/
   to the targets in its README, register them the same way as tomato_juice.
5. Question: her screenshot (art-src/phone_ui_1106/mock_src/scene.png) shows black bars/circle on the left
   (around the joystick). Is that debug UI? Tell me what it is before changing it.

Not in this change: crafting, bamboo cups, tool-slot eating, house interior, shop tab icons.

Follow CLAUDE.md: tests must pass (npm test, npm run validate, npm run test:e2e). Then send before/after
screenshots from the REAL game of 3 states — folded, home, bag — on desktop AND on a landscape phone size
(2796x1290 or the Playwright mobile landscape), and push so she can try it on her phone.
```
