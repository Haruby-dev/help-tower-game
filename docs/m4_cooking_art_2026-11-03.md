# M4 Cooking Art — 2026-11-03

Art for M4 (cooking at the campfire, recipe book, eating). All files are final pixel art. Load them with integer nearest-neighbour scaling only, and never scale an individual sprite.

## 1. Dish icons — `public/assets/food/dishes/<recipe_id>.png` (48×48)

The file name equals the id in `src/data/recipes.json`. Each icon sits on a 48×48 canvas with a transparent background.

| Group | Ids | Look |
|---|---|---|
| Savory, on a banana-leaf boat tray (there are no plates in the dungeon) | grilled_fish, boiled_egg, baked_potato, grilled_corn, home_kaprao, scallion_omelet, corn_egg_fried_rice, mystery_food | Leaf tray |
| Soups, in a coconut shell | tomato_soup, fish_congee, potato_carrot_stew | Coconut bowl |
| Sweets (no tray) | honey_pancake, honey_apple_grill, strawberry_milk_pudding, strawberry_skewer | Free-standing |
| Drinks | tomato_juice, basil_tea, warm_honey_milk | Bamboo cups (soft style; tea and honey milk have cute faces) |

Notes:
- `grilled_fish`: the fish has x_x eyes on purpose, because it is cooked.
- `boiled_egg`: uses the Pangpok egg design (bread-coloured shell with butter), the same egg as the ingredient.
- `mystery_food` is the result of a failed mix (balance.json `mystery`). Its id is `mystery_food`.
- Use the 48px icon for the "dish done" pop above the campfire (it replaces the pink placeholder box), the eat/serve card, and anywhere large.

## 2. Bag-size icons (fix for the 36px bag slot clipping)

The 48px icons are too large for the 36px bag slot. These smaller versions fit inside the slot like `farm/icons_bag`: each is tight-cropped and at most 32×32, so centre it in the slot.

- `public/assets/food/dishes_bag/<recipe_id>.png`: the 18 dishes and drinks above.
- `public/assets/food/desserts_bag/<food_icon>.png`: the 15 chest desserts (same names as `food/desserts/`, e.g. `food_slime1.png`).

Rule: a bag slot, toolbar slot or recipe-book row uses the `_bag` version, and a large card or pop-up uses the 48px version. See `docs/previews/m4_bag_icons.png`.

## 3. Ingredient icons — `public/assets/food/ingredients/<id>.png` (32×32)

The file name equals the key in `src/data/ingredients.json` (item id `ing_<id>`). These are already bag-size, so use them as-is in bag slots.

egg (Pangpok egg), pork (convenience-store minced pork pack), fish_F, milk (farm bottle with cloth cap), honey (honey pot with dipper), salt (shop salt jar), sugar (sugar-cube jar), fish_sauce (tall bottle with red cap), cherry, cocoa, golden_wheat, honey_apple.

These ingredient ids have no art yet and will come with the chest/dessert phase: cream, butter, slime_jelly_scrap, fizzy_water, vanilla. Keep the coloured placeholder for them.

Milk, honey and egg are styled as home/farm-made because later they come from pets (MooMoo, BumBum and Kai-Pok). Sea salt from the Salt Crab and pink rock salt will get their own icons when pets are built. The current `salt` is the shop salt.

## 4. Cooking animation — `public/assets/farm/anims/cook_{south,east,north}.png`

- Each sheet is 792×88, 9 frames of 88×88, in the same layout and anchor as `till_*` / `water_*`. West = east mirrored.
- The fire has been removed from the frames, because the real campfire object is in the world. The player holds a pan or bowl with steam, which reads as cooking at the campfire.
- Suggested playback:
  - Intro frames 0–3 play once (crouch down).
  - Frames 4–8 loop for the cooking time, about 8 fps.
  - At the end, play frames 3→0 once, then show the dish pop.
- Make the player face the campfire before playing.

## 5. Recipe book — SUPERSEDED by docs/m4_recipe_book_v3_2026-11-03.md (Recipe Book v3)

_The table below is the old v1 art, kept for history._

### v1 (old) — `public/assets/ui/book/`

| File | Size | Use |
|---|---|---|
| book_paper_tile.png | 32×32 | `#recipe-book` background, repeat (old cream paper with faint ruled lines) |
| book_entry_9slice.png | 16×16, slice 5 | `.book-entry` known recipe card (`border-image ... 5 fill`) |
| book_entry_locked_9slice.png | 16×16, slice 5 | `.book-entry.is-locked` (greyed paper) |
| book_tab.png / book_tab_active.png | 16×16, slice 5 | Book tabs (savory / sweet / drink). Active is pink. Text on the active tab is white. |
| book_star.png | 13×13 | Star stamp; replaces the "★" text. Draw `bestStars` copies. |
| book_star_empty.png | 13×13 | Optional empty slot (outline only) |
| book_unknown_dish.png | 32×32 | Covered dish with "?", the icon for locked recipes |
| book_note_9slice.png | 16×16, slice 4 | Grandma's note under kaprao (`.book-note`), green paper with tape |

Row layout used in the mock (`docs/previews/m4_recipe_book_mock.png`):
- Icon on the left: the `dishes_bag` version, centred in a 32px box.
- Name and ingredients on the right.
- Stars at the top right.
- Text colours: #5c3c2c (known) and #8d7a66 (locked).

## 6. Decisions confirmed (from the code report, 2026-11-03)

- **Campfire:** usable now; crafting it moves to M9.
- **Food stars:** normal = 1 star; happiness gauge ≥ 70 = 2 stars.
- **Starting drinks:** tomato juice, basil (kaprao) tea and warm honey milk. Strawberry juice waits for seeds in M6.
- **Game name:** Floor & Flavor is applied.
- **Code-side defaults accepted:**
  - Mystery food: happiness −5 when collected, fullness +5 when eaten.
  - Drinks: 10 minutes to make, fullness +10.
  - Drink recipes as listed in the code report.

## 7. Not included / still to do (art side)

- Drinks were redrawn in the soft style on 2026-11-03 (same file names).
- `strawberry_juice` has no icon yet; it comes with M6.
- Dessert-only ingredients (see §3).
