# Zone-1 food update — spec for the code side (2026-11-08)

Everything in this file is approved by her (7–8 Nov 2026) unless it is marked **DEFAULT** (a planning-side default she has not seen yet — build it, it is easy to change) or **OPEN** (not decided — do not build). Source of truth for wording and numbers is `docs/GDD.md`; this file gathers the pieces in one place.

**Money units:** GDD numbers are ×1. **The game shows ×10.** Every price below is given in **game units (×10)** unless it says "GDD units".

**Art:** everything listed is in `art-src/`. Copy what you need into `public/assets/` (same pixel size, no scaling). Where art is missing, use the GDD placeholder rule (coloured box + name) and list it in your report.

**Not in code yet and NOT in this update** (they come with later milestones): gates' forage + rewards (M8, bamboo comes from gate 2), house interior, restaurant, player rank/EXP/skills/status window, daily quests + sugar stars. Where this update depends on them, use the **dev card** in the phone to give/unlock things for testing.

---

## 0. Phases (do them in this order, commit + report after each)

1. **Data + art:** new items, crops, fish, dishes, prices, names, recipe steps, icons, drink art swap, remove the mixing mode.
2. **Cooking window K2** + one-time cook + vessels + new cooking poses + yard campfire.
3. **Decorate-dish screen + toppings.**
4. **Workbench crafting + materials** (straw, banana rope, banana tree, bamboo via dev card) + bamboo cup + trays + drying tray + traps.
5. **Stations:** drying tray, shrimp/crab trap, stone mortar + pounding minigame.
6. **Arrange-a-set tab (จัดชุด)** + combos + set item art + big table + monsters eating sets + reputation counter.
7. **Shop (Geo Mart):** two new categories + new rows.
8. **Recipe sources** + monster tastes + dialogue merges.

---

## 1. Data + art

### 1.1 New ingredients / items
Icons: 32 px in `.../ingredients/<id>.png`, small in `.../ingredients_mini/ing_<id>.png`.

| id | Thai | value (game) | icon folder | how you get it |
|---|---|---|---|---|
| shrimp | กุ้ง | 150 | `art-src/dishes_1108/ingredients_final/` | fishing (rank F, see 1.3) + trap |
| crab | ปู | 250 | same | fishing (rank E) + trap |
| lime | มะนาว | 120 | same (+ crop art 1.2) | farm |
| coriander | ผักชี | 80 | same (+ crop art 1.2) | farm |
| butter | เนย | 200 (already in code) | same | Geo Mart / Mumu |
| kapi | กะปิ | 350 | same | drying tray only (never sold in shops) |
| dried_shrimp | กุ้งแห้ง | 150 | same | drying tray |
| dried_fish | ปลาแห้ง | 150 | `art-src/dishes_1108/groupB/final/` | drying tray |
| dried_chili | พริกแห้ง | 80 | same | drying tray |
| umami_powder | ผงนัว | 100 per spoon | same | mortar |
| chili_flakes | พริกป่น | 50 per spoon | same | mortar |
| ground_dried_shrimp | กุ้งแห้งป่น | 80 per spoon | same | mortar (not a topping) |
| fish_ball | ลูกชิ้นปลา | 80 each | `art-src/dishes_1108/mortar_A/final/` | mortar |
| shrimp_ball | ลูกชิ้นกุ้ง | 80 each | same | mortar |
| banana_leaf | ใบตอง | 10 | `art-src/dishes_1108/groupE/final/` | shake the banana tree |
| bait_chest | เหยื่อเรียกหีบ | — | `art-src/dishes_1108/groupE/final/items/` | Geo Mart (7.1) |
| rice_straw | ฟางข้าว | not sellable | `art-src/dishes_1108/groupC/final/` | rice harvest |
| banana_rope | เชือกกาบกล้วย | not sellable | same | banana tree |
| bamboo | ไม้ไผ่ | not sellable | **no art → placeholder** | gate 2 forage (M8) → dev card for now |
| cherry | เชอร์รี | 100 (already in code) | existing | Geo Mart random |
| cocoa | โกโก้ | **350** (was 150) | existing | zone-2 crop later; chests |
| cream / fizzy_water / slime_jelly_scrap | — | as in code | **no art → placeholder** | Mumu (cream/butter) · Bubble pet (fizzy water **and slime jelly scrap**) — pets come with M8 |

Do **not** add: moo deng (หมูเด้ง, removed from zone 1), pond clay, ferment jar, pickles, salted egg (all moved to zone 2). Vanilla stays unused.

Topping-only items (bought, see 3.3): fried_garlic, toasted_sesame, sweet_basil (ใบโหระพา), coconut_jelly, rainbow_sprinkles, whipped_cream. Icons: `art-src/topping_1108/topping_icons_1108/ingredients(_mini)/` (fried_garlic, toasted_sesame, coconut_jelly, rainbow_sprinkles, scallion_sliced). **No bag icon yet for sweet basil and whipped cream → placeholder.**

Seasonings: salt, sugar, fish sauce **buy price 10** each (GDD said 50 before — wrong).

### 1.2 New crops (crops.json)
| id | Thai | sold | grow days | regrow | seed bag | sell |
|---|---|---|---|---|---|---|
| lime | มะนาว | Geo Mart seeds, **every day** | 7 | every 3 days ×3 | 400 | 120 |
| coriander | ผักชี | Geo Mart seeds, every day | 3 | — | 80 | 80 |

Art: `art-src/dishes_1108/crops/` → `lime_stages_v3.png`, `coriander_stages_v3.png` (4 stages, 48×64), `icons/`, `icons_bag/`, `seeds/`. Favourite weather for these two: see GDD quality section (if missing there, leave unset).

The whole crop table in GDD now matches `crops.json`. Blueberry stays a normal shop crop (it already is in code).

### 1.3 Shrimp and crab in fish.json
Rows are in GDD "ปลา 8 ชนิดและเหยื่อ": shrimp rank F, all day, any weather, normal bait, 150 · crab rank E, 18:00–02:00, rain, normal bait, 250. Prices are approved; rank/hours/weather are drafts → **DEFAULT**.
- Add a `kind` to fish entries: fish / shrimp / crab / squid. Show them in the fish list with the ingredient icons.

### 1.4 Dishes (recipes.json) — 20 new + plain rice
Art: `art-src/dishes_1108/minis/{dishes,dishes_bag,mini16,tray_mini}/<id>.png`; fish_cake and grilled_meatball_skewer are in `art-src/dishes_1108/mortar_A/final/{...}/`. **Use the price column exactly** (rule: max(rank price, 2× ingredient value), rounded up to 5 GDD units).

| # | id | Thai | rank | category | ingredients | price | where cooked | counts as กับข้าว (set) |
|---|---|---|---|---|---|---|---|---|
| 1 | cabbage_crispy_shrimp | กะหล่ำปลีผัดน้ำปลากุ้งกรอบ | E | savory | cabbage · garlic · fish sauce · dried_shrimp | 1000 | campfire | yes |
| 2 | cucumber_salad | ยำแตงกวา | F | savory | cucumber · chili · lime · fish sauce · sugar | 650 | campfire | yes |
| 3 | squid_salad | ยำหมึกแซ่บ | E | savory | glow_squid · chili · lime · coriander · fish sauce | 1100 | campfire | yes |
| 4 | fish_rice_ball | ข้าวปั้นปลาย่าง | F | savory | rice · fish (any) · salt | 550 | campfire | no (has rice) |
| 5 | hor_mok | ห่อหมกปลาใบตอง | D | savory | fish (any) · egg · chili · coriander · banana_leaf | 1200 | pot_pan | yes |
| 6 | cabbage_shrimp_soup | แกงจืดกะหล่ำกุ้งสับ | E | savory (soup) | cabbage · shrimp · garlic · coriander · salt | 1150 | campfire | yes |
| 7 | grilled_shrimp | กุ้งเผา | F | savory | shrimp ×2 · salt | 650 | campfire | yes |
| 8 | garlic_shrimp | กุ้งทอดกระเทียม | E | savory | shrimp · garlic · salt | 600 | campfire | yes |
| 9 | steamed_crab | ปูนึ่งน้ำจิ้ม | D | savory | crab · chili · garlic · lime · coriander | 1250 | pot_pan | yes |
| 10 | mackerel_chili_dip | น้ำพริกปลาทู | E | savory (chili dip) | lost_mackerel only · chili · garlic · lime | 1100 | **mortar only** | yes |
| 11 | kapi_chili_dip | น้ำพริกกะปิ | E | savory (chili dip) | kapi · chili · garlic · lime · sugar | 1300 | **mortar only** | yes |
| 12 | fruit_veg_salad | สลัดผักผลไม้ | E | **sweet** | cabbage · carrot · cucumber · tomato · strawberry · sugar | 1600 | campfire | no |
| 13 | kaprao_shrimp | กะเพรากุ้ง | E | savory | basil · chili · garlic · shrimp · fish sauce | 800 | campfire | yes |
| 14 | lime_steamed_fish | ปลานึ่งมะนาว | D | savory | fish (any) · lime · garlic · chili · coriander | 1200 | pot_pan | yes |
| 15 | buttered_corn | ข้าวโพดคลุกเนย | F | sweet | corn · butter · salt | 800 | campfire | no |
| 16 | pumpkin_custard | ฟักทองสังขยา | D | sweet | pumpkin · egg · milk · sugar | 1400 | pot_pan | no |
| 17 | soy_milk | นมถั่วเหลือง | F | drink | soybean · sugar | 300 | campfire + bamboo cup | no |
| 18 | corn_milk | นมข้าวโพด | F | drink | corn · milk · sugar | 650 | campfire + bamboo cup | no |
| 19 | fish_cake | ทอดมันปลา | E | savory | fish (any) · egg · chili · coriander | 850 | **mortar only** | yes |
| 20 | grilled_meatball_skewer | ลูกชิ้นปิ้ง | F | savory (snack) | fish_ball or shrimp_ball ×2 · chili · sugar | 500 | campfire | no (snack) |
| + | plain_rice | ข้าวสวย | F | set part | rice | 300 | campfire | — (not counted as a recipe) |

- **fish (any)** = any entry of kind "fish", any rank (new any-rank fish group). Shrimp, crab and squid never count as "fish" (**DEFAULT** for squid). The existing `ing_fish_F` recipes (grilled_fish, fish_congee) stay "rank-F fish" but must also exclude shrimp/crab (shrimp is rank F). squid_salad = **any squid** (only glow_squid exists in zone 1). mackerel_chili_dip = lost_mackerel only.
- **Existing dishes that count as กับข้าว** (GDD): grilled_fish · boiled_egg · scallion_omelet. All other old dishes do not (home_kaprao, fish_congee, corn_egg_fried_rice have rice; baked_potato is a snack; tomato_soup, potato_carrot_stew are western; desserts/drinks).
- Existing recipe change (GDD 7 Nov): **baked_potato also needs banana_leaf ×1** (hor_mok too, above).
- Existing desserts: **choco_donut price 1650** (was 1250), **choco_macaron 2350** (was 2000). Other prices stay.
- Recipe count in zone 1 = 53 (food 32 + drinks 6 + desserts 15).
- Recipe steps (recipe_steps.json): write 3 short Thai steps for each new dish in the same tone as the existing ones.
- Thai names: column "Thai" above (also in GDD).

### 1.5 Drinks: new art for all 6 drinks
Replace the 4 existing drink images and add the 2 new ones in `public/assets/food/` (all 4 sizes) with `art-src/cook_ui_1108/drink_1108/drinks_cup_final/{dishes,dishes_bag,mini16,tray_mini}/` (warm_honey_milk, basil_tea, soy_milk, corn_milk, strawberry_juice, tomato_juice). Do NOT use the soy_milk/corn_milk files in `dishes_1108/minis/` (old).

### 1.6 Remove the mixing (experiment) mode everywhere
Remove `startExperiment`, its MYSTERY result and the experiment tab. Keep the mystery-food art/data. The GDD gauge penalty "happiness ≤ 30 → 15% mystery food when cooking" is **not built today and stays OPEN** — do not add it now.

---

## 2. Cooking window K2 + one-time cook
Full notes: `docs/cook_ui_k2_2026-11-08.md` (Thai). Mocks: `art-src/cook_ui_1108/k2_mock_v3.png`, `cook_start_v2.gif`, `cook_done.gif`, `decorate_mock_v2.png`; drinks tab `drink_1108/drink_k2_mock_v2.png`, `drink_pour_v2.gif`; real-game screenshots `real_cook_*.png`.

- **Layout:** 4 tabs (คาว · หวาน · เครื่องดื่ม · จัดชุด — จัดชุด replaces the mixing tab) · 3-column menu card grid, cookable first · a campfire scene in the middle with a thought bubble of the dish and the ingredient slots around the fire · bottom bar: − n + / what is missing / Start. Warm cream + wood colours, the same for every tab.
- **Campfire in the window** = empty campfire `fire/campfire_plain_final.png`; with the grill `fire/grill_G3_final.png`. **Yard campfire** = empty campfire `fire/campfire_yard_final.png` (63×52, no hanging pot).
- **Vessel by cooking method** (not by rank): old vessels by the campfire for F/E dishes, the bought pot/pan for rank D. Art: grill `fire/grill_G3_final.png` · old iron pan `vessels/iron_pan_old_final.png` · old clay pot `vessels/clay_pot_old_final.png` · wooden mixing bowl `vessels/mixing_bowl_final.png` · new pot/pan `public/assets/world/equipment/pot.png` `pan.png` · oven `public/assets/world/equipment/oven.png`.
  - grill: grilled_fish, baked_potato, grilled_corn, honey_apple_grill, grilled_shrimp, fish_rice_ball, grilled_meatball_skewer
  - old iron pan: home_kaprao, kaprao_shrimp, scallion_omelet, garlic_shrimp, cabbage_crispy_shrimp, buttered_corn, strawberry_skewer
  - old clay pot: boiled_egg, tomato_soup, cabbage_shrimp_soup, plain_rice, hot drinks (warm_honey_milk, basil_tea, soy_milk, corn_milk)
  - mixing bowl: cucumber_salad, squid_salad, fruit_veg_salad, cold drinks (strawberry_juice, tomato_juice)
  - new pot (D): fish_congee, potato_carrot_stew, strawberry_milk_pudding, hor_mok, steamed_crab, pumpkin_custard, lime_steamed_fish
  - new pan (D): corn_egg_fried_rice, honey_pancake
  - desserts: bowl = whip_cream_mumu, soda_jelly_dessert, soda_ice_cream · old clay pot = strawberry_jelly, caramel_pudding, berry_pudding, honey_macaron · new pot = cherry_cream_macaron, blueberry_macaron, cream_puff, choco_macaron · new pan = choco_donut, swiss_roll · oven = strawberry_parfait, choco_parfait
  - **Chili dips and fish cake are NOT made at the campfire** — only at the stone mortar (section 5.3). Remove them from the campfire list.
  - Every drink is poured into a bamboo cup (needs the bamboo cup, 4.2).
- **One cook = one time (decided 19:24):** press Start once = any number of dishes (up to ingredients), **time = the rank time once, not × count** (F 20 min, E 25 …; drinks 10). Bottom bar shows "ใช้ … · 20 นาที" and does not change with the count. Flow: Start → ingredients float into the vessel in the window 1–2 s → window closes → the heroine plays the cooking pose ~2–3 s (game clock runs fast) → all dishes come out (dish pop + stars) → decorate screen (section 3).
- **Cooking poses by method** (`art-src/cook_ui_1108/cook_anim/`). Every pose = intro frames played once, then a loop, during cooking. west = mirror of east.

| method | south | east | north |
|---|---|---|---|
| stir-fry (pan) | existing cook_campfire | existing | existing |
| boil (clay pot) | stir_v2_south_fixed/ | stir_v2_east_fixed/ | stir_v2_north_noladle/ |
| grill (skewer) | grill_mix/cook_grill_south/ | grill_mix/cook_grill_east/ | stir_v2_north_noladle/ |
| salad (bowl) | grill_mix/cook_mix_south/ | grill_mix/cook_mix_east/ | stir_v2_north_noladle/ |

  **DEFAULT:** desserts/drinks use the pose of their vessel (bowl → salad pose, clay pot / new pot → boil pose, pan → stir-fry pose, oven → boil pose).

---

## 3. Decorate screen + toppings
Mock: `art-src/cook_ui_1108/decorate_mock_v2.png`, animation mock `art-src/topping_1108/toppings3_drop_v3_bottle.gif`. GDD "ท็อปปิ้ง".

### 3.1 Screen
After dishes come out: "แต่งจาน · <dish name>", the dish in the middle with a soft shadow (no plate under it), stars under the dish, a **milk-bottle "amount" gauge** on the right (pink cap + bow, bubbles; mint normally, pink when over; a pink heart marks the limit), a row of toppings from the bag (cannot use = grey + reason label, e.g. "ซุป/แกงเท่านั้น"), buttons Skip / Done. Cooking several dishes at once = decorate once for all of them.

### 3.2 Rules
- Tap a topping once = one piece drops onto the dish = uses 1 item (powders = one sprinkle). Pieces are big and clear on the 48 px dish.
- Bonus by count: 1 / 2 / 3 pieces = sell price +10% / +20% / +30% and the same steps of extra affection. **The 4th piece passes the heart line = all topping bonus lost + "too much" face 😵.**
- umami_powder: counts as 1 piece but gives **+20%** (old rule); only one spoon per dish. On savory food monsters notice it: a small sparkle on the dish and a chance to say "นัวว~!".
- Topping types: savory / sweet / drink. Drinks may also take sweet toppings. Wrong type (savory on sweet/drink, sweet on savory) **can still be put on** but the monster makes a 🤢 face — **no affection loss, no money loss, just no bonus** (the piece does not count in the gauge). Exception: a monster whose favourite topping it is eats it happily (no 🤢, gets ×1.5).
- **Fish balls and shrimp balls only go on soups/curries** (blocked otherwise, grey + label). DEFAULT soups/curries: tomato_soup, cabbage_shrimp_soup, potato_carrot_stew, fish_congee.
- Favourite topping of a monster = affection ×1.5 + heart sparkle (on top of the steps).
- A dish keeps its toppings as data (sell price, affection, set rules use them). Show toppings only on 48 px views for now (small 16/9 px icons unchanged — OPEN how to show them small).
- 🤢 / 😵 = emoji bubble above the monster's head. **Bubble art not made → use a text/emoji placeholder.**
- Animations: pieces drop and squash (+ splash in soup); whipped cream drops and sticks; powders puff into specks with one sparkle that stays. **umami_powder (added 9 Nov 00:08, her pick):** its sparkle twinkles in a calm loop for as long as the dish shows it (dot → plus → big plus → shrink → tiny glints on a left/right speck → pause, ~1.8 s per loop), see `art-src/topping_1108/umami_twinkle_1109.gif` (frame timings in the GIF). Other powders keep the still sparkle.

### 3.3 The 14 toppings (zone 1)
| topping | type | comes from | on-dish sprite (`art-src/topping_1108/topping_icons_1108/on_dish/`) |
|---|---|---|---|
| ผงนัว umami powder | savory | mortar | umami_powder.png 🆕 |
| ต้นหอมซอย sliced scallion | savory | uses 1 scallion (crop) | scallion_sliced.png |
| กระเทียมเจียว fried garlic | savory | Geo Mart 50 | fried_garlic.png |
| พริกป่น chili flakes | savory | mortar | chili_flakes.png |
| งาคั่ว toasted sesame | savory | Geo Mart 50 | toasted_sesame.png |
| ลูกชิ้นปลา fish ball | savory, soup only | mortar | fish_ball.png 🆕 |
| ลูกชิ้นกุ้ง shrimp ball | savory, soup only | mortar | shrimp_ball.png |
| น้ำผึ้งราด honey | sweet | uses 1 honey | honey_drizzle.png |
| สตรอว์เบอร์รีหั่น strawberry | sweet | uses 1 strawberry | strawberry_slice.png |
| บลูเบอร์รี blueberry | sweet | uses 1 blueberry (crop) | blueberry.png |
| วิปครีม whipped cream | sweet | Geo Mart 100 | whipped_cream.png 🆕 |
| เม็ดสายรุ้ง rainbow sprinkles | sweet | Geo Mart 80 | rainbow_sprinkles.png |
| ใบโหระพา sweet basil | drink | Geo Mart 40 | basil_leaf.png |
| วุ้นมะพร้าว coconut jelly | drink | Geo Mart 60 | coconut_jelly.png |

🆕 = 3 sprites drawn today in the same style (her final look pending; use them). Do NOT use moo_deng.png. Gio reveals favourite toppings slowly in the news (e.g. "ผู้เฝ้าทุ่งชอบงาบนของหวาน แปลกจัง"). Favourite toppings per monster: GDD "ท็อปปิ้งที่ชอบ" (1 strawberry · 2 rainbow sprinkles · 3 sliced scallion · 4 fried garlic · 5 twin A chili flakes / twin B blueberry · 6 umami powder · 7 honey · 8 fish ball · 9 whipped cream · 10 toasted sesame).

---

## 4. Workbench crafting + materials
Design: `docs/crafting_design_2026-11-06.md`. Things are made where they are used; the **old workbench** (โต๊ะช่าง, "ของเก่า" in game — never "grandma's" before chapter 9) stands beside the house and opens a small window. **No workbench art yet → placeholder.**

### 4.1 Materials
The first time she gets each new material/ingredient (straw, rope, banana leaf, bamboo, shrimp, crab, dried things, kapi, balls, powders) the heroine says one short line from her own knowledge (never "grandma taught me"). Draft the Thai lines yourself and list them in your report for her review.
- **Rice straw:** harvesting 1 rice cell = +1 rice straw.
- **Banana tree** at the bottom corner of the base floor (GDD 6 Nov). Shake once a day = **banana leaf ×2 + banana rope ×1**. **No banana-tree art → placeholder.**
- **Bamboo:** gate-2 forage (M8). Until then: dev card "give bamboo".

### 4.2 Workbench recipes
| item | materials | gives | note |
|---|---|---|---|
| bamboo cup แก้วไม้ไผ่ | bamboo 1 (DEFAULT) | 1, **crafted once, used forever** (not consumed) | all drinks need it → drinks open after gate 2. No icon yet → placeholder |
| small woven tray ถาดเล็ก | banana rope 1 + rice straw 2 | 3 | consumed when a set is made |
| medium woven tray ถาดกลาง | bamboo 2 + rice straw 2 | 2 | consumed |
| big woven tray ถาดใหญ่ | bamboo 3 + rice straw 3 | 2 | consumed |
| drying tray ถาดตาก (#2–3) | bamboo 3 + rice straw 2 (DEFAULT) | 1 | max 3 in zone 1 |
| trap ลอบ (#2–3) | bamboo 2 + banana rope 2 (DEFAULT) | 1 | max 3 in zone 1 |

Tray art: `art-src/dishes_1108/groupD/final/items/{small,medium,big}_woven_tray.png` + `items_mini/`.

---

## 5. Stations

### 5.1 Drying tray (กระด้ง)
- First one: the heroine thinks of it herself after gate 2 ("มีไม้ไผ่แล้ว สานกระด้งตากกุ้งได้นี่นา" style line, her own knowledge). Until M8: dev card. More from the workbench, max 3.
- World art `art-src/dishes_1108/props/drying_tray_D.png`; draw small ingredient icons on it while drying. States mock `art-src/cook_ui_1108/dry_1108/dry_world_states.png`.
- Popup mock `art-src/cook_ui_1108/dry_1108/dry_popup.png`: choose what to dry, − n + stepper, "เก็บได้พรุ่งนี้ 06:00", button ตาก.
- Rules: dry in the daytime, **one kind per tray, up to 10 pieces**, ready next day 06:00. shrimp 1 → dried_shrimp 1 · fish 1 → dried_fish 1 · chili 1 → dried_chili 1 · **kapi = shrimp 2 + salt 1 → kapi 1** (made on the tray, no jar).

### 5.2 Shrimp/crab trap (ลอบ)
- First = the old trap at the dock (in game "ลอบเก่า"), usable from day 1 (no craft). More from the workbench after gate 2, max 3.
- Put in the water in the evening, collect next morning: **1 catch per trap per night**; shrimp 70% / crab 30%, weather has no effect (**DEFAULT**).
- Art `art-src/dishes_1108/props/trap_A.png` (on land) and `trap_A_in_water_noripple.png` (in water). The in-water sprite has no ripple: draw the ripple ring in code like the pond rocks (Pond.ts ~642, objects named `rock*` get ripple #beebe8 + a mask so sparkles/lilies do not cover it). Check in the real game that it does not look like it floats.

### 5.3 Stone mortar (ครกหินเก่า) + pounding minigame
- An old stone mortar found inside the house after gate 3 (in game: "ครกหินเก่า", owner never named). **Entry point is OPEN** (house interior not designed): for now open it from the dev card only.
- Art: `art-src/mortar_1108/final/stone_mortar.png`; minigame art `art-src/mortar_1108/mortar_1108b/mortar_nopestle.png` + script `pound_py.txt`; mock `pound_minigame.gif`.
- Screen: a big mortar in the middle (no heroine). **Rhythm ring:** a ring shrinks toward the mortar mouth; tap when it touches the edge = the pestle pounds "ตุ๊บ". 6 pounds per round; the ring takes **1.2 s** on the first pound and gets faster to **0.8 s** on the last. Perfect (±0.08 s) = 2 points, good (±0.18 s) = 1, miss = 0. Total out of 12: **≥10 = ★3 · 6–9 = ★2 · less = ★1**. Missing only lowers stars, nothing breaks. Final dish/item stars = the lower of the ingredient stars and the minigame stars.
- One round makes any number of batches (like cooking). Game time: chili dips + fish cake 25 min (rank E), balls/powders 15 min per round.
- Recipes at the mortar:
  - fish_ball: fish 1 + salt 1 → 2 · shrimp_ball: shrimp 1 + salt 1 → 2
  - **DEFAULT:** umami_powder: dried_shrimp 1 + dried_fish 1 → 3 spoons · chili_flakes: dried_chili 2 → 3 spoons · ground_dried_shrimp: dried_shrimp 1 → 2 spoons
  - mackerel_chili_dip, kapi_chili_dip, fish_cake (dishes, table 1.4)
- Finding the mortar also teaches the recipes **fish_cake** and **grilled_meatball_skewer** (her own knowledge, a short line).

---

## 6. Arrange a set (จัดชุด) + combos + reputation
GDD "ชุดข้าว / สำรับ". Mocks `art-src/cook_ui_1108/set_1108/set_free_mock.png`, `set_combo.gif`.

### 6.1 Tab
4th tab "จัดชุด" in the cooking window (replaces the removed mixing tab). Left = cooked food in the bag (กับข้าว first; things that are not กับข้าว show a 🤢 tag). Right = the chosen tray with free spots. Tap food → it floats onto the tray. "จัดชุด" button → one set item.
- **Free placement**, any food. Trays: **small 2 · medium 3 · large 4** pieces. The tray is consumed.
- Rice is optional; a free set with rice gets a bonus (below).
- Non-กับข้าว food can go in (joke 🤢, no penalty) except inside a combo.

### 6.2 Combos (secret, 15)
Table in GDD (search "สูตรคอมโบโซน 1"). Order does not matter; when several match, the more specific wins. First time: the set name pops + saved on a "ชุดที่เคยจัด" page in the recipe book. Gio hints undiscovered combos in the news, one at a time. Desserts/drinks inside a combo do not cause 🤢. Chili-dip combos only after gate 3; crab/shrimp combos need the trap.

### 6.3 Numbers
- Sell price of a set = sum of its dishes (stars first) × set bonus: free set ×1.0 · free set with rice ×1.1 · small combo ×1.2 · medium combo ×1.35 · large combo ×1.5 · any 🤢 piece inside = no set bonus (normal price).
- **A monster eating a set** (from the tower tray or the big table): affection = sum of every dish with its own taste (favourite ×3 / like ×1.5 / dislike ×0), **combo = ×1.2 more**. 🤢 pieces do not lower affection.

### 6.4 Where sets go
- **Small tray** set: on a tower-tray plate spot or a normal table. **Medium/large**: only on the **big table**.
- **Big table** (โต๊ะใหญ่) 96×41 `art-src/dishes_1108/groupD/final/world/big_table.png`: buy in Geo Mart "บ้าน&ฟาร์ม" **6000**, placed with arrange mode, holds 1 set. DEFAULT: visiting monsters can eat a set from it with the same rule as the tower tray.
- **Set item art = composite in code** (no per-set art): the tray image + `tray_mini` dish images placed on spots. Slot centres (fraction of the tray image): small (0.3,0.45) (0.7,0.45) · medium (0.3,0.38) (0.7,0.38) (0.5,0.68) · large (0.3,0.33) (0.7,0.33) (0.3,0.66) (0.7,0.66), dish centred on the spot, 1 px up. Reference script + mocks: `art-src/cook_ui_1108/set_1108/setitem/` (`setitem_py.txt`, `set_icons.png`, `set_scene.png`). On the tower tray the small set is shrunk to fit one plate spot (about 13 px).

### 6.5 Restaurant reputation (ชื่อเสียงร้าน) — counter only for now
One number, only goes up, shown as ★1–5. Thresholds: ★1 0 · ★2 150 · ★3 500 · ★4 1,200 · ★5 2,500.
- Sources **now**: combo set made small/medium/large **+5 / +10 / +15**, **first time a combo is found +30**.
- Sources that come with the restaurant (do not build now): dish sold +1, customer's favourite on the menu +3, good review +5, shop cuteness +1/day per 10.
- DEFAULT display: in the shop "สูตร" page header, e.g. "ชื่อเสียงร้าน ★2 · อีก 40 ถึง ★3" (always say how much is missing).
- Use: dessert recipes unlock by stars (8.1). Later: floor monsters need stars to visit the restaurant.

---

## 7. Shop (Geo Mart)
Today: 6 categories (แมวเลีย · เมล็ด · ปุ๋ย · สูตร · อุปกรณ์ · บ้าน&ฟาร์ม), random things live inside a category with the "วันนี้" tag. **There is no separate random category.** Add 2 categories, same layout as the seeds category (every-day rows on top, random "วันนี้" rows below). Category icons: reuse existing art (salt/milk icon, a topping icon).

### 7.1 New category "วัตถุดิบ"
- Every day, unlimited: salt · sugar · fish sauce (10 each). **Important: today the game sells no seasonings at all (only 2 each in the starter bag).**
- Every day, limited: milk 2 · butter 1 · honey 1 per day, **price ×2 before the matching pet** (milk 240 · butter 400 · honey 240), normal price after the pet.
- Random "วันนี้": cherry (some days, small stock, 100) · **bait_chest** (30% of days, max 5 per appearance, **10,000** each — demo value).
### 7.2 New category "ท็อปปิ้ง"
Random 2–3 kinds per day, 5–10 pieces each, "วันนี้" tag: fried garlic 50 · toasted sesame 50 · sweet basil 40 · coconut jelly 60 · rainbow sprinkles 80 · whipped cream 100.
### 7.3 Other categories
- Seeds: add lime 400 and coriander 80 to the every-day rows.
- Recipes: add an **"ขายถาวร" (permanent) row block above the random rows** (8.1).
- บ้าน&ฟาร์ม: big table 6000.
- Rename the equipment "เตาอบและครกหิน" → **"เตาอบและครกดินเผา"** (it is a different thing from the old stone mortar of 5.3; price/unlock unchanged).

### 7.4 Bait chest effect
With bait_chest on the rod: **30% chest per cast (night/rain 32%)**; no chest = a normal fish; chest tier odds unchanged.

---

## 8. Recipe sources + tastes + dialogue

### 8.1 Where zone-1 recipes come from (GDD "การได้สูตร")
- Known from the start (6): as in code. **plain_rice is also known from the start** (not counted in the 53).
- Day-4 tutorial quest: baked_potato (M9 — keep current behaviour).
- Gate secret (M8): honey_pancake (gate 5) · strawberry_milk_pudding (gate 9).
- **Shop permanent:** the heart menu of floors 2/3/7/8/10 appears **once you have met that monster** (not random) + fruit_veg_salad from the start (day-6 quest uses floor-1 favourite).
- **Shop random:** buttered_corn · grilled_shrimp · kaprao_shrimp.
- **Shop rank-special (rank E):** fish_rice_ball · mackerel_chili_dip · steamed_crab · lime_steamed_fish — they need player rank, which is not in code → **hide them for now**, no other way to get them.
- **Teacher monsters (only 3):** Mookmik at 25% affection → tomato_soup · Yai Bai Mai 25% → kapi_chili_dip, 50% → cabbage_shrimp_soup · Jao Tung Tong 25% → honey_apple_grill, 50% → strawberry_juice. Others teach nothing.
- **Fishing chests → recipe fragments:** every chest (wooden/silver/golden) gives 1 fragment until all 7 recipes are done; 2 fragments = 1 recipe: squid_salad · cabbage_crispy_shrimp · garlic_shrimp · hor_mok · corn_milk · pumpkin_custard · fish_congee. **fish_congee is rarer**, but after 8 chests in a row without its fragment the next chest gives it (like `pityAfter`). Gio hints once: "ได้ยินว่ามีม้วนสูตรลอยมากับน้ำ". Fragment item: reuse the recipe scroll icon.
- **Special quests → fragments** (cucumber_salad · soy_milk): needs the daily-quest system — not now.
- **Found with the mortar:** fish_cake · grilled_meatball_skewer.
- **Desserts = reputation rewards** (permanent in the shop once the star is reached): ★2 whip_cream_mumu · caramel_pudding · honey_macaron · strawberry_jelly / ★3 cream_puff · swiss_roll · soda_ice_cream · berry_pudding · blueberry_macaron / ★4 soda_jelly_dessert · cherry_cream_macaron · choco_donut / ★5 strawberry_parfait · choco_macaron · choco_parfait. Choco ones can be bought in zone 1 but need cocoa (chests / zone 2).
- Shop recipe price rule stays (dish price × 5).

### 8.2 Monster tastes (monsters.json)
Replace favourite / likes / dislikes / heart menu with GDD "รสนิยมอาหาร" (the table + the favourite-drink line + twin B line), and add `favouriteTopping` from "ท็อปปิ้งที่ชอบ". Floor 10 heart menu = strawberry_skewer 3★ (bronze).

### 8.3 Dialogue
Now merge from `docs/dialogue_zone1_draft.json` the lines held back on 7 Nov: favourite lines of puinun, popcorn, yaibaimai, wingwing, tubpong, and `gio.news[0]`.

---

## 9. OPEN (do not build)
- Mystery food when happiness ≤ 30 (1.6).
- Mortar entry point (house interior).
- How toppings show on 16/9 px icons.
- Rank-special recipes and special quests (need rank / daily quest systems).
- Restaurant reputation sources, monster friends (เพื่อนมอนสเตอร์), restaurant itself.

## 10. Art still missing (use placeholders, list them in your report)
workbench · banana tree · bamboo item · bamboo cup · cream / fizzy water / slime jelly scrap icons · sweet basil + whipped cream bag icons · 🤢 / 😵 bubbles · recipe fragment (reuse scroll).
