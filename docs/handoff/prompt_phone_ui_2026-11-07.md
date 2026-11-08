# Phone UI — every page (her OK + her request for the prompt, 2026-11-07 05:54). Supersedes prompt_phone_ui_2026-11-06.md.

```
Phone UI redesign — all pages (approved by her 2026-11-06/07) + strawberry juice art.

Read first, in this order:
- docs/phone_ui_final_2026-11-07.md  (one table of every page, its shape and its mock)
- docs/phone_ui_2026-11-06.md        (case, glass frame, sizes, status bar, theme, home, bag, shop E)
- docs/album_2026-11-07.md, docs/pets_app_2026-11-07.md, docs/gate_app_2026-11-07.md, docs/mail_app_2026-11-07.md
- docs/handoff/phone_assets_manifest_2026-11-07.md  (art to copy into public/ + register)
Source of truth = the HTML mocks in art-src/phone_ui_1106/mock_src/ (open at 2796x1290) and the shots in
art-src/phone_ui_1106/shots/ (overview: phone_ui_overview_1107.png). Copy their CSS instead of re-inventing it.

1. Phone case: smartphone with a thin clear glass frame, real CSS curves, no crease (spec §1). Folded lock = lock_S3A.html.
2. Home = home_10apps.html: 10 apps (bag, wallet, shop, recipes, album, pets, gate, mail, support, settings),
   rows 4-4-2 centred. REMOVE the outfit app (ชุด) everywhere: outfits will live in a wardrobe later.
   Phone back decorating (case / charm / wallpaper) is ON HOLD: no new UI for it.
3. Medium glass window (~67% x 69%, two paper cards) for: bag (bag_status_A.html), wallet (wallet_e.html,
   Sugar Star icon = sugar_star at 2x beside numbers), shop (style E, shop_e_*.html, one category per page,
   items cheap -> expensive).
4. REAL BOOK apps: tapping the app opens a 2-page book over the dimmed game, NOT inside the phone window.
   Page = 297x268 UI px drawn at the world's integer scale (3 device px per art px on 2796x1290), cover,
   page stacks, spine shadow, gingham ribbons on the 4 outer corners, ✕ outside the cover. One family, colour per app:
   - Recipe book (brown, existing v4 art): recipe_book_spread2.html.
   - Album (pink): tabs จีโอ | มอนสเตอร์. Gio tab = 4 treat flavours from shop.treats + gio.album
     (album_book.html). Monster tab = the monster book (album_monsters*.html, album_twins_*.html):
     one page per zone, slot states 100% photo / visited silhouette / never met "?" / zone not open padlock,
     detail = big photo 2x, floor + kind + personality, affection bar, tastes as mini16 dish icons
     (unknown = "?" until served once or told by Gio's news), the monster's 100% line from the GDD.
     Twins (floor 5): one slot; single straw photo before the reveal, selfie photo + ขนฟาง|ขนม่วง switch after.
     Floors 11-100 padlocked for now. There is NO separate monster-book app.
   - Pets (mint): pets_book_bgB.html + pets_book_heal / _notmet / _locked.html. 15 pets in GDD gate order,
     status pills, right page = 253x100 home scene + info (living / under treatment / not met / locked).
   - Gate map (lavender): gate_book.html / gate_book_locked.html. INFO ONLY (entering stays at the plaza gate).
   - Mail (sea blue): mail_book.html + mail_papers.html (paper + ink by writer, same Mali font).
     Letter texts in the mocks are drafts: put them in src/i18n/th.json so she can rewrite them.
   Where the game system behind a book does not exist yet (pets, single gate menu, message bottles),
   build the page from static data (GDD tables -> src/data/*.json) and show the correct empty / locked states.
   Do not invent new mechanics. List which pages run on static data in your reply.
5. One-card apps over the dimmed game: support (support_card.html: her text exactly, NO payment button)
   and settings (settings_card.html: sound sliders with the paw knob = joystick_knob_paw as made,
   screen, play, and the dashed "สำหรับทดสอบ · เอาออกก่อนปล่อยจริง" box around the test buttons).
6. Art: copy and register everything in docs/handoff/phone_assets_manifest_2026-11-07.md. Integer
   nearest-neighbour scaling only; never resize a sprite file. All new player-facing text -> src/i18n/th.json.
7. Bag buttons: remove ใส่ถาดขาย AND กิน; keep เปิดหีบ / ทำเหยื่อ / ใช้แบบนี้.
8. Eating from the tool bar (her pick, mock art-src/phone_ui_1106/shots/eat_swap_B.png, notes art-src/phone_ui_1106/eat_slot/README.md):
   the bar stays 5 slots. A round switch on the left end of the tray flips the WHOLE bar tools <-> foods
   (tool mode: spoon_fork icon + label "อาหาร"; food mode: the hoe icon + label "เครื่องมือ").
   Food mode: the 5 slots = edible items in the bag (dishes_bag icon as made, count, star badge), a › tab on the
   right end pages to more foods, keys 1-5 pick in both modes. Picking a food puts it on the action button
   (its icon + label "กิน"); pressing eats it (the item count drops, normal eat effects).
   The girl eat animation (empty hands + the real dish overlaid per frame) comes in its own delivery from
   art-src/girl_eat_faint_1107/; if it is not in public/ yet, keep today's eat feedback and leave a hook for it.
9. Question: her screenshot (art-src/phone_ui_1106/mock_src/scene.png) shows black bars/circle on the left near the
   joystick. Is that debug UI? Tell me what it is before changing it.

Not in this change: crafting, bamboo cups, house interior / wardrobe, phone back decorating,
zone-1 monster sprites in the world (separate delivery).

Follow CLAUDE.md: npm test, npm run validate, npm run test:e2e must pass. Then send screenshots from the REAL game:
folded, home, bag, tool bar in food mode, shop, wallet, recipe book, album (both tabs), pets, gate, mail, support, settings — on desktop
AND a landscape phone size (2796x1290 or Playwright mobile landscape) — and push so she can try it on her phone.
```
