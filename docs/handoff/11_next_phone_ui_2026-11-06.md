# 11 — Phone / in-game UI overhaul (written 2026-11-06 16:50 by the planning/art chat, for the NEXT chat that takes over the PHONE UI work)

**LANGUAGE: reply to her in THAI in every message, no exceptions.**
Read first: `00_rules.md`, `04_us.md`, the end of `01_status.md`, this file.
Note: another chat is doing M7 monsters (floor 6 ยายใบไม้). This file is ONLY the phone/UI track.

## Why
She said the in-game UI looks "primary-school level" next to a free-GPT clock mock (smooth case, polished edges). Goal: a foldable "book phone" with a real case feel. Her brief: folded = sky dial/clock/message, cat clinging to the top corner; unfolded = opens sideways like a book (crease + hinge caps); home = apps LEFT, calendar/status RIGHT; bag = select LEFT, details RIGHT; check landscape mobile; nothing may overlap the "จัดวาง" button.

## What is APPROVED
1. **Folded phone = `lock6.html`** (CSS, smooth corners, not pixel case). She loves the bottom corner curve and the lavender shadow under the base. Case 476x596 screen-px (= 119x149 game px, 1 game px = 4 screen px on the 2796x1290 mock), left 1160 top 345. Peek cat `cat_peek2.png` (26x20, drawn from cat_calico) on the top edge. Date "อังคาร 4" + sun, big time, pill "แดดดี", one sleeping cat, message card (paw / text / arrow).
   Case CSS (copy exactly):
   ```
   .case{border-radius:72px;background:linear-gradient(135deg,#ffffff 0%,#fefcff 38%,#f6f1fd 70%,#ece4fa 100%);
    box-shadow: inset 5px 5px 0 #ffffff, inset -4px -5px 10px rgba(196,180,236,.55),
      0 8px 0 0 #d5c5f1, 0 11px 0 -2px #a892dc, 0 24px 26px -6px rgba(50,20,70,.38);}
   .screen{left:24px;top:24px;width:428px;height:536px;border-radius:48px;
    box-shadow:inset 0 2px 0 rgba(150,140,210,.16),inset 0 0 0 1px rgba(205,195,238,.45);}
   ```
   Pixel cases (case4/case5) were REJECTED as stair-stepped — keep the smooth curve.
2. **Unfolded small phone** (`open_tpl.html` / `open.py` -> `open_bag.html`): two lids 952x596 at left 922, crease at 475 px (3 px gradient), hinge caps top/bottom, screens radius l `48 16 16 48` / r `16 48 48 16`.
3. **Size rule (her pick A):** small phone for lock + home; APPS open as a BIG window ~88% of the screen with a little game scene visible behind (`big.py` -> `big_bag.html`, `big_shop.html`): 2460x1136 at left 168 top 64, radius 96, lids 1186 wide, crease 1228, fold/flip/close buttons INSIDE the right lid top-right (they clipped when outside). Bag = 7x5 slots of 144 px, icons 4x, detail icon 8x. Shop = awning, tabs, shelves, Gio + card. HUD hidden while an app is open.
4. She said the big window "looks empty, doesn't need to be that phone-like, I want fantasy + cute". I showed 3 directions (`shots/fan_A/B/C_half.png`: A storybook, B magic stall, C cloud). Then she said **"แบบนี้ไปก่อน"** = keep the plain `big_bag` look FOR NOW. Fantasy direction NOT chosen — offer it again later, don't force it.

## NEXT (in order)
1. **Home screen mock — she asked for it, NOT made yet.** Unfolded small phone (same case as open_tpl). LEFT lid: the 11 real sticker app icons at integer scale (2x or 3x) with Thai labels. RIGHT lid: date/calendar widget (เดือนที่ / วันนี้), งานวันนี้ checklist, ติดอยู่ในหอคอย counter (เดือน/วัน/ชม./ชั้น), maybe a small Gio/weather bit. Render with Playwright over `scene_clean.png` / `scene_nohud.png` at 2796x1290, send a real-size image + numbered options. If it looks small, also show an 88% big-window variant.
   - Real assets: `public/assets/ui/apps/app_*.png` (album 29x36, bag 33x31, gate 34x38, mail 35x36, outfit 22x35, pets 41x41, recipe 26x32, settings 36x36, shop 41x38, support 34x29, wallet 37x27), `public/assets/ui/phone_v3/` (weather_*, cat_*, wallpaper_sky(_wide), paw_button, note_card_9slice), `public/assets/portraits/portrait_girl_*.png` (41x30).
   - i18n keys (src/i18n/th.json): app.inventory กระเป๋า, app.wallet กระเป๋าเงิน, app.shop ร้านค้า, app.recipes สมุดสูตร, app.album อัลบั้ม, app.pets สัตว์เลี้ยง, app.gate เกต, app.mail จดหมาย, app.outfit ชุด, app.support เดฟ; tasks.title งานวันนี้; stuck.title ติดอยู่ในหอคอย; calendar.month เดือนที่; calendar.today วันนี้; phone.unfold กาง / phone.fold พับ / phone.flip พลิก.
   - Font: `mock_src/Mali-Bold.ttf`.
2. After she OKs home: write ONE code prompt for the phone redesign (lock6 CSS-look case — the code side must reproduce the smooth curve + lavender base shadow in Phaser (Graphics/9-slice at high res, NOT a stair-stepped pixel case), unfolded book layout, 88% app windows, hide HUD in apps, ask about the black debug bars seen in her screenshot). Require the code side to send before/after screenshots of 3 states (folded, home, bag) from the real game, on a landscape phone size too.
3. Strawberry juice art (approved, 0 cr) is in `art-src/strawberry_juice_1106/` (README has targets). It is a NEW dish — needs 4 files added. Bundle into the next code prompt.

## Files
- `art-src/phone_ui_1106/mock_src/` — all mock HTML + scripts (lock6.html approved, open_tpl.html, open.py, big.py, fantasy.py, case4/5.py rejected, peek2.py, scene.png = her screenshot, scene_clean.png = old lock inpainted, scene_nohud.png = HUD inpainted too, `a/` and `s/` = copies of game icons used by the mocks). Render: `node` + `require('playwright')`, viewport 2796x1290, open the html via file://.
- `art-src/phone_ui_1106/shots/` — what she saw: lock_before_after, v6_realsize (approved fold), fold_vs_open_realsize, full_folded, full_open_bag, big_bag_88pct (her "keep for now"), big_shop_88pct, fan_A/B/C.

## Still open from earlier (not phone)
- `prompt_shop_icons_2026-11-05.md` not done by the code side yet.
- Shop TAB icons: she called my 2x-downscaled ones "primary-school level" — redo properly (probably inside the new shop window design).
- Group-1 art still to make: buy-land / arrange action icons, album photo frame, Gio peddling mini scene + folding table.
PixelLab ~3,080 left (resets 2026-11-30). Phone work so far = 0 cr.
