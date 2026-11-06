# Zone 1 menu expansion — DRAFT (planning, 2026-11-07)

Why (her words): "เราเป็นเกมเน้นทำอาหาร อย่างน้อยผู้เล่นก็ต้องเพลิดเพลิน" — zone-1 monsters rotate only 15 foods + 4 drinks.
Goal (my proposal, not confirmed): ~30 zone-1 menus, spread over ranks F/E/D so a new recipe unlocks every 1–2 days.

## Decided by her
- 2026-11-07 02:22: **shrimp and crab** are new catches. **Both can be caught with the rod** (added to the fish table), AND a new **shrimp/crab trap (ลอบดักกุ้งปู)** placed at the pond edge in the evening, collected next morning (random shrimp/crab).
  - Open: trap material (bamboo = only after gate 2 / twigs + rope = earlier; my default twigs + rope), how many traps, catch numbers, catch conditions (draft: shrimp rank F any weather; crab rank E, rain/night).
- Seeds: no new crop for now (default; she did not ask for one) — first give every existing crop a use (cabbage, cucumber, pumpkin, soybean are unused today).

## Candidate menus (waiting for her picks; prices/ranks drafted from GDD step 1 only after picks)
Savory (banana-leaf boat): cabbage stir-fry w/ fish sauce · cucumber salad · steamed egg w/ scallion · pumpkin milk soup · buttered corn · mashed potato · fried tofu (soybean) · grilled-fish rice ball · hor mok fish in banana leaf (uses the leaf from crafting) · cabbage + minced pork clear soup
Shrimp/crab: garlic fried shrimp · grilled shrimp · crab omelet · crab fried rice · steamed crab w/ chili-garlic dip
Sweet (no tray): honey steamed pumpkin · pumpkin in coconut-free milk syrup (แกงบวดแบบนม)
Drinks (bamboo cup): soy milk · corn milk · cucumber drink · pumpkin drink
Art: per menu 4 sizes (dish 48, bag, tray_mini, mini16) — AI the dish (~1 cr), hand-made minis (0 cr). Shrimp + crab icons ~2 cr; trap object ~1–2 cr.

## Her new ideas 2026-11-07 02:24 (design discussion, not decided yet)
- **Drying tray (ถาดตากแห้ง / กระด้งตาก)** in the yard, dry by day, collect next day: shrimp -> dried shrimp, fish -> dried fish, chili -> dried chili; shrimp + salt -> **kapi (กะปิ)**; dried shrimp + dried fish -> **ผงนัว** (umami powder).
- **ปลาทู**: use the existing "ปลาทูหลงทาง" (lost_mackerel, rank E, sunny) as a SPECIFIC ingredient (today all recipes take generic fish) -> needs species-specific ingredients in code.
- **น้ำพริก**: น้ำพริกกะปิ (kapi, chili, garlic, sugar), น้ำพริกปลาทู (mackerel, chili, garlic).
- **สำรับ (meal set)**: steamed rice + chili dip + soup (needs a "ข้าวสวย" component recipe).
- My proposal: 3 phases — 1) new menus + shrimp/crab + trap, 2) drying tray + processed ingredients + 2 chili dips, 3) meal sets.
- Asked her: ผงนัว role (N1 ingredient ⭐ / N2 seasoning that raises quality / N3 both); meal set (S1 cook components then "assemble" at the campfire ⭐ / S2 tray combo bonus); phasing.
- 2026-11-07 02:27 her rule: **meal sets (สำรับ) can ONLY be placed on a BIG TABLE** (not the tray). Existing art: only restaurant stump_table/stump_seat (too small). Lore link: the long table of chapter 5 / ending feast.
  Asked: table source (T1 shop บ้าน&ฟาร์ม ⭐ / T2 grandma's workbench / T3 reward), sets per table (K1 one ⭐ / K2 two). Also flagged: GDD 2026-11-07 01:35 says banana leaf is an ingredient ONLY in baked potato -> hor mok conflicts (H1 widen rule / H2 drop hor mok ⭐).
- 2026-11-07 02:35 her decision: **add 2 new crops: lime (มะนาว) and coriander (ผักชี)**. Details open (shop vs start, grow days, regrow — lime could be a regrowing bush like chili). Art per crop: stages sheet + produce icon + bag icon + seed packet (~2–4 cr per crop; seed packet from the existing template by hand).
- Banana tree ideas listed for her (not decided): banana fruit (กล้วยปิ้ง, กล้วยบวชชี, กล้วยตาก, นมกล้วย), banana blossom (ยำหัวปลี, side for น้ำพริก). She is brainstorming menus now — do not push decisions (her request 02:31).
- 2026-11-07 02:42 her ideas: **more squid types** — add หมึกกล้วย (squid) and หมึกยักษ์ (octopus / giant squid) next to the existing glow_squid, plus squid dishes. **Fermentation jars (โถหมัก)**: ปลาร้า, น้ำปลา (today a bought base ingredient), กิมจิ, "อะไรพวกนั้น".
  My notes for the talk: jar = slower processing station (several days) next to the drying tray (1 day). Possible jar products with zone-1 ingredients: ปลาร้า (fish+salt+rice), น้ำปลา (fish+salt), กิมจิ (cabbage+chili+garlic), ผักกาดดอง (cabbage), แตงกวาดอง (cucumber), ไข่เค็ม (egg+salt), กระเทียมดอง (garlic), มะนาวดอง (lime). Squid dish ideas: หมึกย่าง, ยำหมึก (lime+coriander), หมึกผัดกระเทียม, หมึกนึ่งมะนาว, ข้าวผัดหมึก, หมึกแห้ง (drying tray), หมึกผัดไข่เค็ม (jar salted egg).

## HER MENU LIST 2026-11-07 02:53 ("เอาแค่นี้ก่อน") — 18 menus + rice sets
Ingredients below are MY DRAFT for her review (not confirmed). Category = savory (leaf boat on the art) / sweet (no tray) / drink (bamboo cup) / dip.
| # | menu | draft ingredients | cat | needs |
|---|---|---|---|---|
| 1 | กะหล่ำปลีผัดน้ำปลากุ้งกรอบ | cabbage, garlic, fish sauce, shrimp | savory | shrimp |
| 2 | ยำแตงกวา | cucumber, chili, lime, fish sauce, sugar | savory | lime |
| 3 | ยำหมึกแซ่บ | squid, chili, lime, coriander, fish sauce | savory | squid species, lime, coriander |
| 4 | ข้าวโพดคลุกเนย | corn, butter, salt | sweet (snack) | — |
| 5 | ข้าวปั้นปลาย่าง | rice, fish, salt | savory | — |
| 6 | ห่อหมกปลาใบตอง | fish, egg, chili, coriander, banana leaf | savory | leaf rule widened (GDD 01:35 says leaf only in baked potato) |
| 7 | แกงจืดกะหล่ำหมูสับ | cabbage, minced pork, garlic, coriander, salt | savory (soup) | coriander |
| 8 | กุ้งเผา | shrimp ×2, salt | savory | shrimp |
| 9 | กุ้งทอดกระเทียม | shrimp, garlic, salt | savory | shrimp |
| 10 | ปูนึ่งน้ำจิ้ม | crab, chili, garlic, lime, coriander | savory | crab, lime, coriander |
| 11 | ฟักทองสังขยา | pumpkin, egg, milk, sugar | sweet | — |
| 12 | นมถั่วเหลือง | soybean, sugar | drink | — |
| 13 | นมข้าวโพด | corn, milk, sugar | drink | — |
| 14 | น้ำพริกปลาทู | mackerel (lost_mackerel only), chili, garlic, lime | dip | species-specific fish |
| 15 | น้ำพริกกะปิ | kapi, chili, garlic, lime, sugar | dip | kapi source (drying tray / jar / shop?) |
| 16 | สลัดผักผลไม้ | cabbage, carrot, cucumber, tomato, strawberry, honey | savory (salad) | — |
| 17 | กะเพรากุ้ง | basil, chili, garlic, shrimp, fish sauce | savory | shrimp |
| 18 | ปลานึ่งมะนาว | fish, lime, garlic, chili, coriander | savory | lime, coriander |
| + | ข้าวสวย (plain rice) | rice | base | for sets |
**Her idea: these dishes can be served as a SET with plain rice for extra money** ("จัดเซ็ทกับข้าวเปล่า +เงินได้"). Open: which dishes count as "กับข้าว", bonus size, does it apply to selling (Gio) / restaurant / monsters, relation to the big-table สำรับ.
Art: 18 menus + plain rice ≈ 19–38 cr (dish by AI, minis by hand).
- 2026-11-07 04:42 her decisions: banana leaf allowed in ห่อหมกปลาใบตอง too (GDD crafting note updated) · ยำหมึกแซ่บ = any squid · น้ำพริกปลาทู = lost_mackerel ONLY · กุ้งกรอบ in #1 = **dried shrimp from the drying tray**. Now discussing WHEN the drying tray and the jar unlock and WHY (story).
- 2026-11-07 04:50 correction: Yai Bai Mai ALREADY gives the compost bin (GDD line ~155, decided 04:49 in another chat) -> she cannot also give the jar. Drying tray proposal unchanged (craft from bamboo at grandma's workbench after gate 2). Jar giver options now discussed: Tubpong floor 8 ⭐ (lazy = "leave it and it gets tasty"), Puefaotung floor 10 ("ค่อยเป็นค่อยไป", but late), gate 7 stream with the pink salt, Gio's shop. If the jar comes late, kapi should be made on the drying tray.

## 2026-11-07 04:55–05:00 — คราฟเพิ่ม / จำนวนสูงสุด (กำลังคุย ยังไม่ตัดสิน)
- หลักที่เสนอ: อันแรกได้จากเรื่องราว แล้วปลดสูตรคราฟที่โต๊ะช่างของยาย และจำกัดจำนวนต่อโซน (ร่าง: ลอบ 3 = ไม้ไผ่ 3, ถาดตาก 3 = ไม้ไผ่ 4, โถ 3–4 ซื้อเพิ่มจากจีโอ หรือใช้ดินเหนียว)
- เธอสังเกต (04:58): "รู้สึกเราใช้แค่ไม้เนอะ" → วัตถุดิบคราฟซ้ำ ไม่หลากหลาย
- ไอเดียวัตถุดิบคราฟโซน 1 ที่เสนอ (ยังไม่เลือก): ฟางข้าว (ผลพลอยได้ตอนเกี่ยวข้าว), เชือกกาบกล้วย (จากต้นกล้วย), ดินเหนียวริมบ่อ (โถ), หินกรวดริมน้ำ, ด้ายหรือแหเก่าจากการตกปลา
- ✅ เธอเลือก (05:01): วัตถุดิบคราฟใหม่โซน 1 = **ฟางข้าว** (ของแถมตอนเกี่ยวข้าว) + **เชือกกาบกล้วย** (จากต้นกล้วย) + **ดินเหนียวริมบ่อ** (ทำให้โถหมักคราฟได้) ส่วนหินกรวดและด้าย/แหยังไม่เอา
  - ร่างสูตร (ยังไม่ตัดสิน): ลอบ = ไม้ไผ่ + เชือกกาบกล้วย · ถาดตาก = ไม้ไผ่ + ฟางข้าว · โถหมัก = ดินเหนียว แล้วเผาที่กองไฟ
  - ยังเปิดอยู่: จำนวนสูงสุดต่อโซน, ได้ดินเหนียวยังไง/ตอนไหน, อันแรกของแต่ละอย่างได้จากใคร
- ✅ เธอโอเค (05:04): **จำนวนสูงสุดในโซน 1 = อย่างละ 3** (ลอบ / ถาดตาก / โถหมัก) · **ดินเหนียว** ขุดริมบ่อได้หลังได้โถใบแรก
  - ต่อไป: อันแรกของแต่ละอย่างได้จากใคร (ลอบ: ของเก่ายายตั้งแต่ต้น? / ถาดตาก: คราฟหลังเกต 2? / โถ: Tubpong ⭐, Puefaotung, เกต 7, ร้านจีโอ)
- ✅ เธอโอเค (05:07): อันแรกของแต่ละอย่าง = **L1** ลอบเก่าของยายที่ท่าน้ำ ใช้ได้ตั้งแต่ต้นเกม (ใบที่ 2–3 คราฟหลังเกต 2) · **D1** ถาดตากใบแรกคราฟเองหลังเกต 2 แล้วยายสอน · **J1** โถหมักใบแรกเป็นของขวัญจากตุ๊บป่อง (ชั้น 8) · **กะปิทำบนถาดตาก** (ไม่ต้องรอโถ)
- ✅ เธอเลือก (05:09): **ผงนัว = N2 เครื่องปรุงเสริม** โรยเมนูไหนก็ได้ตอนทำเพื่อเพิ่มคุณภาพหรือราคา **ยกเว้นของหวานและเครื่องดื่ม** (เป็นระบบใหม่ ฝั่งโค้ดมีงานเพิ่ม)
  - ยังเปิด: ผลที่ได้ (ราคา/ความชอบ), ใช้กี่ช้อนต่อจาน, สลัดผักผลไม้นับเป็นของหวานไหม, มอนสเตอร์มีปฏิกิริยาไหม
- ✅ เธอโอเค (05:10) รายละเอียดผงนัว: **E1** ขายได้ราคาเพิ่ม (ร่าง +20% ต้องเทียบกับ GDD ก่อน) · **จานละ 1 ช้อน** ใช้ 1 ชิ้น โรยซ้ำไม่ได้ · **สลัดผักผลไม้นับเป็นของหวาน** (โรยไม่ได้) · **มอนสเตอร์รู้** มีประกายเล็ก ๆ บนจาน และมีโอกาสพูดว่า "นัวว~!" (เอฟเฟค 0–1 cr ต้องเสนอราคาก่อนทำ)
- 2026-11-07 05:12 เธอเพิ่ม: **ถาดอาหารใหญ่สำหรับวางเซ็ต** (เพิ่มจากโต๊ะใหญ่) · กำลังถามว่าถาดใหญ่ใช้กับเซ็ตไหน (ชุดข้าว หรือเป็นส่วนหนึ่งของสำรับบนโต๊ะใหญ่) · ข้อ 1–3 (2 ระดับ / S1 / T1) เธอยังไม่ได้ค้าน จะใช้ ⭐ ไว้ก่อน
- ✅ เธอโอเค (05:13): **B1 ถาดใหญ่เป็นส่วนหนึ่งของสำรับ** จัดกับข้าวลงถาดใหญ่ แล้วยกไปวางบนโต๊ะใหญ่ · ใช้ ⭐ ข้อ 1–3: **เซ็ต 2 ระดับ** (ชุดข้าวบนถาดหรือโต๊ะปกติ / สำรับบนโต๊ะใหญ่) · **S1** จัดเซ็ตที่กองไฟแล้วได้จานเดียว · **T1** ซื้อโต๊ะใหญ่ที่ร้านบ้านและฟาร์ม (K1 หนึ่งสำรับต่อโต๊ะ ยังเป็นร่าง)
  - ต่อไป: ถาดใหญ่ใช้แล้วหมดไป หรือใช้ซ้ำได้ และได้มาจากไหน
- ✅ เธอโอเค (05:20): **ถาดใหญ่ R1 ใช้แล้วหมด** (เป็นวัตถุดิบในสูตรสำรับ) · **F1 คราฟที่โต๊ะช่างของยาย** เป็นถาดไม้ไผ่สาน ใช้ไม้ไผ่ + ฟางข้าว คราฟครั้งเดียวได้หลายใบ · ภาพต้องดูเป็นของใช้ครั้งเดียว (ถาดสาน หรือกระทงใบตองใหญ่)

## 2026-11-07 05:21 — จัดความชอบของมอนสเตอร์ใหม่ทั้งโซน (เธอขอ)
- เธอ: "เมนูใหม่เยอะมาก เรามาเปลี่ยนความชอบกันใหม่ให้ทั่วถึง" → แทน W4/W5/W6 (วิ้งวิ้งจะได้ค่าใหม่ในรอบนี้)
- ผลต่อ prompt_zone1_fixes_2026-11-07.md: ข้อ W1 (วิ้งวิ้ง) และ B2 (แฝดน้อง likes) จะถูกแทนด้วยตารางใหม่ ส่วนบทแฝดน้องและ Q1 ยังใช้ได้
- ค่าปัจจุบัน (monsters.json): 11 ตัว (รวมแฝดน้อง) · โซน 1 มีอาหาร 12 + เครื่องดื่ม 3 · ในไฟล์มีของหวาน 15 อย่าง (มาการอง พาร์เฟต์ ฯลฯ) ที่ไม่ได้อยู่ในตารางโซน 1
- กติกาที่เสนอ (รอเธอดู): โปรดเป็นอาหารเท่านั้น · โปรดไม่ซ้ำกัน และคู่โปรด+เครื่องดื่มไม่ซ้ำกัน · ตัวชั้นต้นต้องได้โปรดที่ทำได้ทันตอนเจอ · ทุกเมนูมีคนชอบอย่างน้อย 1 ตัว · เข้ากับนิสัย/หน้าตา
- เธอเลือก M1 (05:28): ผมร่างทั้งตารางก่อน แล้วเธอแก้
- แก้ตัวเลขที่ผมพูดผิด: เมนูเดิม = อาหาร 14 + เครื่องดื่ม 4 = 18 (ไม่ใช่ 15) · เมนูใหม่ = อาหาร 16 + เครื่องดื่ม 2 · รวมอาหาร 30 ใส่ในช่องโปรด+ชอบ 33 ช่อง (ซ้ำได้ 3) · เครื่องดื่ม 6 ใช้เป็นเครื่องดื่มโปรด 11 ช่อง
- ข้อจำกัดที่ใช้ร่าง: เครื่องดื่มต้องรอหลังเกต 2 (แก้วไม้ไผ่) · แพนเค้ก = สูตรลับจากเกต 5 · พุดดิ้งนมสตรอว์เบอร์รี = สูตรลับจากเกต 9 (สายเรื่องต่อไปถึงผู้เฝ้าทุ่ง ชั้น 10) · กุ้งแห้ง/กะปิ ได้หลังเกต 2 · กุ้งปูได้ตั้งแต่ต้นเกม (ลอบ + เบ็ด) · คงโปรด/ไม่ชอบของแฝดไว้ (เกมทายแฝดใช้อยู่)

### DRAFT ตารางความชอบใหม่ v1 (05:3x) — รอเธอแก้
| ชั้น | ตัว | โปรด | เครื่องดื่มโปรด | ชอบ 1 | ชอบ 2 | ไม่ชอบ |
|---|---|---|---|---|---|---|
| 1 | ปุยนุ่น | สลัดผักผลไม้ 🆕 | น้ำสตรอว์เบอร์รี | ไม้เสียบสตรอว์เบอร์รี | ยำแตงกวา 🆕 | ปลาย่าง |
| 2 | ป๊อปคอร์น | ข้าวโพดคลุกเนย 🆕 | นมข้าวโพด 🆕 | ข้าวโพดย่าง | ข้าวผัดไข่ข้าวโพด | ซุปมะเขือเทศ |
| 3 | มุกมิก | ซุปมะเขือเทศ | น้ำมะเขือเทศ | สตูว์มันฝรั่งแครอท | กะหล่ำปลีผัดน้ำปลากุ้งกรอบ 🆕 | ไข่ต้ม |
| 4 | ตุ้มเตี้ย | มันฝรั่งอบ | นมอุ่นน้ำผึ้ง | ห่อหมกปลาใบตอง 🆕 | โจ๊กปลา | ไม้เสียบสตรอว์เบอร์รี |
| 5 | แฝดพี่ | ปลาย่าง | น้ำมะเขือเทศ | กะเพราบ้าน ๆ | กะเพรากุ้ง 🆕 | ข้าวโพดย่าง |
| 5 | แฝดน้อง | ข้าวโพดย่าง | นมอุ่นน้ำผึ้ง | กุ้งทอดกระเทียม 🆕 | ยำหมึกแซ่บ 🆕 | ปลาย่าง |
| 6 | ยายใบไม้ | น้ำพริกกะปิ 🆕 | ชาโหระพา | แกงจืดกะหล่ำหมูสับ 🆕 | ไข่ต้ม | ข้าวโพดย่าง |
| 7 | วิ้งวิ้ง | ฟักทองสังขยา 🆕 | น้ำสตรอว์เบอร์รี | แพนเค้กน้ำผึ้ง | ไม้เสียบสตรอว์เบอร์รี | ปลาย่าง |
| 8 | ตุ๊บป่อง | กุ้งเผา 🆕 | นมถั่วเหลือง 🆕 | ไข่เจียวต้นหอม | ข้าวปั้นปลาย่าง 🆕 | ไม้เสียบสตรอว์เบอร์รี |
| 9 | เจ้าทุ่งทอง | แพนเค้กน้ำผึ้ง | น้ำสตรอว์เบอร์รี | แอปเปิลน้ำผึ้งย่าง | ปูนึ่งน้ำจิ้ม 🆕 | มันฝรั่งอบ |
| 10 | ผู้เฝ้าทุ่ง | พุดดิ้งนมสตรอว์เบอร์รี | ชาโหระพา | น้ำพริกปลาทู 🆕 | ปลานึ่งมะนาว 🆕 | ข้าวผัดไข่ข้าวโพด |
- ครบ: อาหาร 30/30 · เครื่องดื่ม 6/6 · คู่โปรด+เครื่องดื่มไม่ซ้ำ · ซ้ำ 3 (ข้าวโพดย่าง แพนเค้ก ไม้เสียบสตรอว์เบอร์รี)
- โปรดเปลี่ยน 5 ตัว (ปุยนุ่น ป๊อปคอร์น ยายใบไม้ วิ้งวิ้ง ตุ๊บป่อง) → ต้องเขียนบทเมนูโปรดใหม่ 5 บท
- ⚠️ ปุยนุ่นชั้น 1: สลัดใช้ผัก/ผลไม้ร้าน 4 อย่าง อาจหนักสำหรับตัวแรก
- ✅ เธออนุมัติตาราง v1 ทั้งหมด (05:34) รวมสลัดของปุยนุ่น ("คนเล่นสมัยนี้ชอบ") · GDD ตารางรสนิยมอาหารอัปเดตแล้ว
- บทใหม่ใน docs/dialogue_zone1_draft.json: ปุยนุ่น "ส…สลัดผักผลไม้…!!" · ป๊อปคอร์น "ข้าวโพดคลุกเนย!! ของฉัน! จิ๊บ!" · ยายใบไม้ "น้ำพริกกะปิ…! รสนี้แหละจ้ะ" · วิ้งวิ้ง "ฟ…ฟักทองสังขยา…!" · ตุ๊บป่อง "กุ้งเผา!! อ๊บบบ" · จีโอ news "ได้ยินว่าปุยนุ่นแอบชอบสลัดผักผลไม้…" (src/data/dialogue.json ยังเป็นของเดิม รอส่งให้ฝั่งโค้ด)
- ⚠️ พบ: เมนูประจำใจของป๊อปคอร์น = ข้าวโพดย่าง ซ้ำกับช่องชอบใหม่ (ถามเธออยู่)
- ✅ (05:38) ป๊อปคอร์น ชอบ: ข้าวโพดย่าง → **ไข่ต้ม** (เมนูประจำใจข้าวโพดย่างไม่ซ้ำแล้ว) · ซ้ำในตารางตอนนี้ = ไข่ต้ม แพนเค้ก ถังหูลู่ (3) · ข้าวโพดย่างยังอยู่ที่โปรดของแฝด B
- เช็กบททั้งหมดใน dialogue_zone1_draft.json (05:38): ไม่มีบทไหนขัดกับตารางใหม่ · บทไม่ชอบทุกตัวยังตรง · เกมทายแฝด (ปลา/ข้าวโพด) ไม่กระทบ · GDD: แก้แนวคิดแฝด B "ชอบไข่ต้มเหมือนกัน" แล้ว
