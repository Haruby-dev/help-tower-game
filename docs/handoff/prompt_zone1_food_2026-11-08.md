# Prompt to the code side — zone-1 food update (2026-11-08 23:5x)

Everything food-related approved 7–8 Nov 2026 in one spec: `docs/zone1_food_update_2026-11-08.md`. Replaces the "separate prompt will come" note in prompt_zone1_fixes_v2_2026-11-07.md.

```
Big zone-1 food update (all approved by her 7–8 Nov). The full spec is docs/zone1_food_update_2026-11-08.md — read it all first, then GDD sections it points to (GDD is the source of truth), docs/cook_ui_k2_2026-11-08.md and the addendum at the end of docs/economy_balance_2026-11-02.md.

Work in the 8 phases of section 0, in order. After EACH phase: run tests/validate, commit, and report to me with screenshots of what changed. Do not start the next phase before I say go.
1 data + art (new items/crops/shrimp+crab/20 dishes + plain rice with the exact prices, recipe steps, drink art swap, remove the mixing mode; the unhappy mystery-food penalty stays OPEN)
2 cooking window K2 (tabs คาว/หวาน/เครื่องดื่ม/จัดชุด) + one cook = one rank time + vessels by method + new cooking poses + empty yard campfire
3 decorate screen + 14 toppings (milk-bottle gauge, 🤢 = no bonus but no penalty, fish/shrimp balls soup only)
4 old workbench crafting + materials (straw from rice, banana tree, bamboo via dev card) + bamboo cup (once) + 3 trays + drying tray + trap
5 stations: drying tray, shrimp/crab trap (ripple like pond rocks), stone mortar + rhythm minigame (open it from the dev card only for now)
6 arrange-a-set tab + 15 secret combos + set item composite art + big table + monsters eating sets + reputation counter (combo sources only)
7 Geo Mart: new categories "วัตถุดิบ" and "ท็อปปิ้ง", seeds, permanent recipe rows, big table, rename to "เตาอบและครกดินเผา"
8 recipe sources (fishing-chest fragments with pity, teachers, permanent heart menus, desserts by reputation stars) + monster tastes + favourite toppings + the held-back dialogue lines

Rules:
- Money in GDD is x1, the game is x10. The spec gives game units. Use the spec prices exactly; put every number in data files.
- Do NOT build anything marked OPEN (section 9). DEFAULT items are approved to build.
- Things that need M8 gates/pets, house interior, restaurant, rank/EXP or daily quests are NOT part of this job; use the phone dev card to give/unlock what you need for testing (bamboo, drying tray #1, mortar, pets' cream/fizzy water).
- Missing art (section 10): use the GDD placeholder (coloured box + name) and list each placeholder in your report. Never call PixelLab at runtime. Copy art from art-src into public at the same pixel size, no scaling.
- In-game text never says "grandma's" (ของยาย) before chapter 9: the workbench, trap and mortar are "ของเก่า".
- Do not add moo deng, pond clay, the ferment jar, pickles or salted egg (moved out of zone 1).
- If anything in the spec conflicts with GDD or the current code, stop and ask me instead of guessing.
First commit: include my doc changes too (docs/GDD.md, docs/zone1_food_update_2026-11-08.md, docs/cook_ui_k2_2026-11-08.md, docs/economy_balance_2026-11-02.md, docs/handoff/, art-src/topping_1108/topping_icons_1108/on_dish/ new sprites).
```
