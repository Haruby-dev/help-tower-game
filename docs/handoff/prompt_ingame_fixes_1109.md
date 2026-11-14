# ข้อความส่งฝั่งโค้ด: แก้จากการเล่นเกมจริง 9 พ.ย. (รวมทีเดียว)

เธออนุมัติทุกข้อ 20:28–21:04 · รายละเอียด/หลักฐาน `docs/handoff/fix_list_ingame_1109.md` · คำใบ้จีโอ `docs/handoff/gio_recipe_hints_1109.md` · **สถานะ: 🟡 ให้เธอแล้ว รอส่ง**

```
In-game review fixes (played build 03eeee7 on the live site, new save, 9 Nov). All approved by her. One batch, please report back per section. Full notes: docs/handoff/fix_list_ingame_1109.md

Her rule behind section A: "the game is full of spoilers". The player must DISCOVER things. Never show what is not found yet, never show exact odds/percentages, never tell the player a choice is wrong before the result happens.

== A. Remove spoilers ==

A1. Shop > recipes, Gio's note (src/ui/shop.ts gioNoteOf, recipe branch): stop listing ingredients and counts. Use one vague hint per recipe from new keys shop.gnote_recipe.<id> (Thai text below). If a recipe has no key, show the generic line "สูตรนี้อร่อยนะ ลองดูสิ". Never fall back to the ingredient list.
  fruit_veg_salad: ผักกรอบหลายสีจากแปลง แล้วแอบหวานด้วยผลไม้แดง ๆ นิดนึง
  scallion_omelet: ทอดให้ฟูขอบกรอบ เค็มนิด ๆ แบบที่บ้านชอบทำ
  corn_egg_fried_rice: ข้าวผัดสีสดใส มีของเหลือง ๆ ส้ม ๆ เขียว ๆ เต็มกระทะ
  potato_carrot_stew: ต้มนาน ๆ ให้น้ำแดงอุ่น ๆ หอมจนหายเหนื่อย
  grilled_corn: ย่างไฟอ่อน ๆ แล้วโรยของหวานให้ไหม้นิด ๆ
  strawberry_skewer: เคลือบแก้วใส ๆ กัดแล้วดังกร๊อบ เมี้ยว
  buttered_corn: หอมมัน ๆ เค็มปลายลิ้น กินตอนร้อนอร่อยสุด
  grilled_shrimp: ของจากน้ำ ย่างไฟแรง ปรุงแค่นิดเดียวพอ
  kaprao_shrimp: เผ็ดหอมแบบกะเพราบ้าน ๆ แต่เปลี่ยนตัวเอกเป็นของจากน้ำ
  fish_rice_ball: ปั้นกลม ๆ พกไปไหนก็ได้ ข้างในมีของจากบ่อ
  steamed_crab: นึ่งเฉย ๆ ก็หวาน แต่น้ำจิ้มเปรี้ยวเผ็ดคือหัวใจ
  mackerel_chili_dip: ต้องใช้ปลาตัวที่หลงมาจากที่ไกล ๆ เท่านั้นนะ
  lime_steamed_fish: เปรี้ยวจี๊ดเผ็ดนิด ราดร้อน ๆ ตอนยกเสิร์ฟ
  whip_cream_mumu: ง่ายที่สุดในชั้นนี้ ตีให้ฟูจนเป็นภูเขาขาว ๆ
  caramel_pudding: นึ่งเบา ๆ ให้สั่นดุ๊กดิ๊ก ราดน้ำสีทองไหม้นิด ๆ
  honey_macaron: แป้งสีทองกรอบนอกนุ่มใน หวานแบบที่ผึ้งชอบ
  strawberry_jelly: ต้องมีของเด้งดึ๋งจากเพื่อนตัวนิ่ม ๆ ถึงจะเซ็ตตัว
  cream_puff: เปลือกพองกลวง ๆ แล้วอัดของนุ่ม ๆ เข้าไปจนแน่น
  swiss_roll: ม้วนแผ่นนุ่ม ๆ ให้เห็นลายวน มีผลไม้แดงแอบอยู่
  soda_ice_cream: เย็นฉ่ำแล้วซ่าเบา ๆ บนลิ้น เพื่อนตัวจิ๋วช่วยให้ซ่านะ
  berry_pudding: พุดดิ้งนุ่ม ๆ สีม่วงอ่อน กลิ่นผลไม้ลูกเล็ก
  blueberry_macaron: แป้งกรอบสีฟ้าม่วง หวานอมเปรี้ยวนิด ๆ
  soda_jelly_dessert: ใส ๆ ซ่า ๆ เด้ง ๆ มีลูกแดงจิ๋วลอยอยู่ข้างใน
  cherry_cream_macaron: ไส้นุ่มขาว ๆ กับลูกแดงจิ๋วตรงกลาง น่ารักจนไม่อยากกิน
  choco_donut: ทอดให้ฟู แล้วต้องหาของสีน้ำตาลเข้ม ๆ ที่หายากหน่อย
  strawberry_parfait: ซ้อนเป็นชั้น ๆ ในแก้วสูง ยิ่งหลายชั้นยิ่งดีใจ
  choco_macaron: ของน้ำตาลเข้มที่หายากกับไส้นุ่ม ๆ หรูสุดในร้าน
  choco_parfait: แก้วสูงสีเข้ม หวานด้วยของที่ผึ้งให้มา ปิดท้ายด้วยลูกแดงจิ๋ว

A2. Cooking > arrange-set tab (src/ui/setArrange.ts): remove the yuck warning completely while arranging: the red line set.yuck_warn, the is-yuck slot style and the emote_yuck icon on dishes. The player finds out only when a monster eats the set and makes the 🤢 face (that part stays). Note: the old text was also wrong (it said only desserts/drinks yuck; a one-plate dish like home_kaprao also yucks per spec 6.1).

A3. Decorate screen (src/ui/decorate.ts + cooking.css): do NOT signal "wrong topping type" in ANY way. Remove all four: the emote_yuck icon on the card (dk-card__yuck), the .dk-card.is-wrong pink background, the aria-label/tooltip text decorate.wrong_type, and the sort order that puts matching toppings first (renderTray rank). Sort cards in bag order instead. Cards that cannot be used (out of stock / 3 pieces reached) may still be grey with their existing reason text, that is about quantity, not a spoiler.

A4. Shop > fertilizer: remove the "เกร็ดจีโอ: ปุ๋ยกับดาว" card with the star odds (tipOf 'fertilizer' in shop.ts). The short note "ใส่แปลงผัก ผักได้ดาวมากขึ้น" is fine.

A5. Cooking window: remove the line cook.star_tip ("อารมณ์ดีตั้งแต่ 70 มีโอกาส 10% ได้ดาวเพิ่ม 1 ดวง"). Keep the mechanic, just do not tell the numbers.

A6. Phone > recipe book, savory/sweet/drink tabs (src/ui/recipeBook.ts, ORDER = all recipes): page only through KNOWN recipes. No "? ? ?" pages, no empty ingredient slots, no "ลายมือเขียนว่าใช้วัตถุดิบ N อย่าง". The page dots count known recipes only. A tab with nothing known shows a short empty line.

A7. Phone > recipe book > sets tab: show only combos already found. Do not list the 15 "? ? ?" rows or their tray sizes. Before the first combo, show one gentle line (e.g. "ยังไม่เคยจัดชุดลับเลย"). Also shorten book.sets_note so it does not explain the rule (remove "ครบถาดและตรงสูตรลับ ชื่อชุดจะเด้งขึ้น").

A8. Phone > pets book: show only pets already met. Do not list the 15 slots with their gate numbers (เกต 2 … เกต 53) or "จะเจอหลังเปิดเกต N".

A9. Phone > mail book: show only bottles already collected. No zone labels or "ตกได้จากบ่อ · โซน N · คิดถึงบ้าน −5" for bottles not found.

A10. Shop reviews (shop.review_by_*): a reviewer monster the player has NOT met yet must not be named. Use "ลูกค้าหอคอย" until that monster has been met (Gio's own reviews stay).

A11. Cooking window tabs: show the drink tab only after the player owns the first bamboo cup, and the arrange-set tab only after owning the first woven tray (any size). Until then the tabs are not shown at all.

Keep as is (her call): gate app headings, stone mortar showing its 6 recipes, random shop recipes whose ingredients are not obtainable yet (kaprao_shrimp on day 1 is OK), the test baits in the starting bag (but list them with the dev buttons as "remove before release").

== B. Bugs ==

B1. Gate 3 collision does not work at all (soft-lock). I walked through Mookmik, through the reward chest, and up through the top hedge into the tree row (tile rows 0-1), then could not walk back down: stuck inside the hedge until the 2-hour timer sent me home. Our gate3_map.json blocked cells are correct (rows 0-1 blocked). In GateScene.ts the run zones and addBody() zones are created with this.add.zone(...) and added to a physics staticGroup, but they seem to have no real body size. Please make sure every static zone gets a proper body (physics.add.existing(zone, true) or group.add then refresh), and add an e2e check: walk into owner/chest/top edge and confirm the player stops and can always walk back.

B2. Gate 3 reward chest is drawn as a 6-slot food tray, not a chest. Our sprite art-src/gate_maps_1109/gate3_final/sprites/gate_reward_chest.png (39x38) is correct and atlas boot_1 at 1730,434 holds the right pixels, so the key/frame mapping in game is wrong. Opening it works.

B3. Gate 3 kin rabbits wander outside wander_area [4.88,2.55,24.44,12.92] into the right/top-right hedges, and two sometimes stand on the same spot. Keep them inside the area and walkable cells (same collision as B1) and avoid overlapping.

B4. Arrange-set tab layout: "กลาง/ใหญ่: โต๊ะใหญ่" (set.big_table_note) overlaps the "ใหญ่ · 4" button; "ยังไม่มีถาดนี้ ทำได้ที่โต๊ะช่างเก่า" (set.no_tray) overflows its box. Fix layout at all zoom levels.

B5. Shop > บ้าน&ฟาร์ม: the big table row shows its name twice ("โต๊ะใหญ่ โต๊ะใหญ่ 6,000").

B6. Shop > อุปกรณ์ is an empty category on day 1. Hide a category chip while it has nothing to sell.

B7 (minor, dev only). Settings test buttons "ให้ถาดตากใบแรก" / "ให้โต๊ะใหญ่" could not be clicked while inside a gate. Not important.

Do not change anything else. When done, tell me which items need her to look in the real game.
```
